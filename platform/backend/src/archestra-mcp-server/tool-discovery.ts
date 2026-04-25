import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  TOOL_RUN_TOOL_SHORT_NAME,
  TOOL_SEARCH_TOOLS_SHORT_NAME,
} from "@shared";
import { z } from "zod";
import { filterToolNamesByPermission } from "@/archestra-mcp-server/rbac";
import { handleDelegation } from "@/archestra-mcp-server/delegation";
import mcpClient from "@/clients/mcp-client";
import logger from "@/logging";
import { ToolModel } from "@/models";
import {
  catchError,
  defineArchestraTool,
  defineArchestraTools,
  errorResult,
  structuredSuccessResult,
} from "./helpers";
import type { ArchestraContext } from "./types";

// === Constants ===

/**
 * Maximum number of tools returned by search_tools
 */
const MAX_SEARCH_RESULTS = 50;

// === Schemas ===

const SearchToolsArgsSchema = z
  .object({
    query: z
      .string()
      .describe(
        "Search query to filter tools by name or description. Case-insensitive partial match.",
      ),
  })
  .strict();

const SearchToolsResultSchema = z
  .object({
    tools: z
      .array(
        z.object({
          name: z.string().describe("Full tool name."),
          title: z.string().describe("Human-readable tool title."),
          description: z
            .string()
            .describe("Tool description summarizing what it does."),
          inputSchema: z
            .any()
            .describe("JSON Schema for the tool's input parameters."),
        }),
      )
      .describe("Array of matching tools."),
    total: z
      .number()
      .int()
      .describe("Total number of tools matching the query."),
    searchedAt: z
      .string()
      .describe("ISO timestamp of when the search was performed."),
  })
  .strict();

const RunToolArgsSchema = z
  .object({
    toolName: z
      .string()
      .describe(
        "The exact name of the tool to execute. For Archestra built-in tools, use the short name (e.g., 'todo_write'). For delegation tools, use the full delegation tool name. For MCP server tools, use the tool name as shown in the MCP server's tools/list.",
      ),
    args: z
      .record(z.unknown())
      .optional()
      .describe("Arguments to pass to the tool."),
  })
  .strict();

const RunToolResultSchema = z
  .object({
    success: z.literal(true).describe("Whether the tool executed successfully."),
    toolName: z.string().describe("The name of the tool that was executed."),
    result: z.unknown().describe("The result returned by the tool."),
  })
  .strict();

// === Tool Implementations ===

/**
 * search_tools: Discovers and searches tools assigned to the current agent.
 *
 * Searches across:
 * - Built-in Archestra platform tools
 * - Installed MCP server tools
 * - Agent delegation tools
 *
 * Results are filtered by RBAC permissions.
 */
async function handleSearchTools(
  args: z.infer<typeof SearchToolsArgsSchema>,
  context: ArchestraContext,
): Promise<CallToolResult> {
  const { query } = args;
  const { agent: contextAgent, organizationId, userId } = context;

  if (!organizationId) {
    return errorResult("Organization ID is required to search tools.");
  }

  try {
    // Get all tools assigned to this agent
    const allAgentTools = await ToolModel.getMcpToolsByAgent(contextAgent.id);

    // Get all Archestra built-in tools (lazy import to avoid circular dependency)
    const { getArchestraMcpTools } = await import("@/archestra-mcp-server");
    const archestraTools = getArchestraMcpTools();
    const archestraToolNames = new Set(archestraTools.map((t) => t.name));

    // Combine: DB tools + built-in tools (deduplicated by name)
    const combinedTools: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      meta?: Record<string, unknown>;
      isBuiltIn: boolean;
    }> = [];

    const seenNames = new Set<string>();

    // Add DB tools
    for (const tool of allAgentTools) {
      if (!seenNames.has(tool.name)) {
        seenNames.add(tool.name);
        combinedTools.push({
          name: tool.name,
          description: tool.description || "",
          parameters: (tool.parameters as Record<string, unknown>) || {},
          meta: tool.meta as Record<string, unknown> | undefined,
          isBuiltIn: archestraToolNames.has(tool.name),
        });
      }
    }

    // Add built-in tools that might not be in DB yet
    for (const tool of archestraTools) {
      if (!seenNames.has(tool.name)) {
        seenNames.add(tool.name);
        combinedTools.push({
          name: tool.name,
          description: tool.description || "",
          parameters: tool.inputSchema as Record<string, unknown>,
          meta: tool._meta as Record<string, unknown> | undefined,
          isBuiltIn: true,
        });
      }
    }

    // Apply RBAC filtering
    const permittedNames = await filterToolNamesByPermission(
      combinedTools.map((t) => t.name),
      userId,
      organizationId,
    );

    // Filter by query and RBAC
    const queryLower = query.toLowerCase();
    const matchingTools = combinedTools
      .filter((t) => permittedNames.has(t.name))
      .filter(
        (t) =>
          t.name.toLowerCase().includes(queryLower) ||
          t.description.toLowerCase().includes(queryLower),
      )
      .slice(0, MAX_SEARCH_RESULTS);

    const result = {
      tools: matchingTools.map((t) => ({
        name: t.name,
        title: t.name
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        description: t.description,
        inputSchema: t.parameters,
      })),
      total: matchingTools.length,
      searchedAt: new Date().toISOString(),
    };

    logger.debug(
      {
        agentId: contextAgent.id,
        query,
        totalMatched: matchingTools.length,
      },
      "search_tools: query completed",
    );

    return structuredSuccessResult(result, `Found ${matchingTools.length} tool(s) matching "${query}"`);
  } catch (error) {
    return catchError(error, "searching tools");
  }
}

/**
 * run_tool: Universal dispatcher for executing any assigned tool by name.
 *
 * Handles:
 * - Archestra built-in tools (built-in platform tools)
 * - Agent delegation tools (agent-to-agent delegation)
 * - MCP server tools (third-party MCP server tools)
 *
 * Prevents self-invocation (an agent cannot call a delegation tool pointing to itself).
 */
async function handleRunTool(
  args: z.infer<typeof RunToolArgsSchema>,
  context: ArchestraContext,
): Promise<CallToolResult> {
  const { toolName, args: toolArgs = {} } = args;
  const { agent: contextAgent, organizationId, userId } = context;

  if (!toolName) {
    return errorResult("toolName is required.");
  }

  try {
    // Prevent self-invocation: check if this is a delegation tool pointing back to the same agent
    const delegationTools = await ToolModel.getDelegationToolsByAgent(
      contextAgent.id,
    );
    for (const dt of delegationTools) {
      if (dt.tool.name === toolName && dt.targetAgent.id === contextAgent.id) {
        logger.warn(
          { agentId: contextAgent.id, toolName },
          "run_tool: self-invocation blocked",
        );
        return errorResult(
          `Self-invocation blocked: ${toolName} delegates back to the current agent.`,
        );
      }
    }

    // Determine tool type and execute (lazy import to avoid circular dependency)
    const archestraModule = await import("@/archestra-mcp-server");
    const archestraTools = archestraModule.getArchestraMcpTools();
    const archestraToolNames = new Set(archestraTools.map((t) => t.name));

    let result: CallToolResult;

    if (archestraToolNames.has(toolName)) {
      // Archestra built-in tool
      result = await archestraModule.executeArchestraTool(toolName, toolArgs, context);
    } else {
      // Check if it's a delegation tool
      const isDelegation = delegationTools.some((dt) => dt.tool.name === toolName);
      if (isDelegation) {
        // Delegation tool - delegate to handleDelegation
        result = await handleDelegation(
          toolName,
          { message: (toolArgs as { message?: string }).message || "" },
          context,
        );
      } else {
        // MCP server tool - call via mcpClient
        try {
          const callResult = await mcpClient.executeToolCall(
            {
              id: `run_tool_${Date.now()}`,
              name: toolName,
              arguments: toolArgs as Record<string, string>,
            },
            contextAgent.id,
            context.tokenAuth,
          );
          );
          result = { content: callResult as CallToolResult["content"] };
        } catch (callError) {
          logger.error(
            { err: callError, toolName },
            "run_tool: MCP tool call failed",
          );
          return errorResult(
            `Tool "${toolName}" call failed: ${callError instanceof Error ? callError.message : String(callError)}`,
          );
        }
      }
    }

    logger.info(
      { agentId: contextAgent.id, toolName, success: !("error" in result) },
      "run_tool: execution completed",
    );

    return result;
  } catch (error) {
    return catchError(error, `running tool ${toolName}`);
  }
}

// === Export Tools ===

export const toolEntries = defineArchestraTools([
  defineArchestraTool({
    shortName: TOOL_SEARCH_TOOLS_SHORT_NAME,
    title: "Search Tools",
    description:
      "Search across all tools available to this agent. Use this to discover tools by name or description when you need to perform a task but don't know which tool to use. Searches built-in platform tools, MCP server tools, and agent delegation tools.",
    schema: SearchToolsArgsSchema,
    outputSchema: SearchToolsResultSchema,
    annotations: {
      destructive: false,
      idempotent: true,
      dependencies: [],
    },
    handler: handleSearchTools,
  }),
  defineArchestraTool({
    shortName: TOOL_RUN_TOOL_SHORT_NAME,
    title: "Run Tool",
    description:
      "Execute any tool by its exact name. Use this as a universal dispatcher for tools discovered via search_tools, or for directly calling known tools. Supports Archestra built-in tools, agent delegation tools, and MCP server tools. Prevents self-invocation (an agent cannot call a delegation tool pointing to itself).",
    schema: RunToolArgsSchema,
    outputSchema: RunToolResultSchema,
    annotations: {
      destructive: false,
      idempotent: false,
      dependencies: [],
    },
    handler: handleRunTool,
  }),
]);

export const tools = toolEntries as unknown as ReturnType<
  typeof defineArchestraTools
>;
