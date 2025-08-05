import { FastifyPluginAsync } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod/v4';

import McpServerModel, { selectMcpServerSchema } from '@backend/models/mcpServer';

// Request schemas
const installRequestSchema = z.object({
  mcpConnectorId: z.string(),
});

const startOAuthRequestSchema = z.object({
  mcpConnectorId: z.string(),
});

// Response schemas
const mcpServerResponseSchema = selectMcpServerSchema;
const mcpServersListResponseSchema = z.array(mcpServerResponseSchema);
const successResponseSchema = z.object({ success: z.boolean() });
const errorResponseSchema = z.object({ error: z.string() });
const authUrlResponseSchema = z.object({ authUrl: z.string() });

// Request params schemas
const uninstallParamsSchema = z.object({
  mcpServerName: z.string(),
});

// Type exports
type InstallRequestBody = z.infer<typeof installRequestSchema>;
type StartOAuthRequestBody = z.infer<typeof startOAuthRequestSchema>;
type UninstallParams = z.infer<typeof uninstallParamsSchema>;

const mcpServerRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Get all installed MCP servers
   */
  fastify.get(
    '/api/mcp_server',
    {
      schema: {
        operationId: 'getMcpServers',
        description: 'Get all installed MCP servers',
        tags: ['MCP Server'],
        response: {
          200: zodToJsonSchema(mcpServersListResponseSchema as any),
        },
      },
    },
    async (request, reply) => {
      try {
        const servers = await McpServerModel.getInstalledMcpServers();
        return reply.send(servers);
      } catch (error) {
        console.error('Failed to load installed MCP servers:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * Install MCP server (from catalog)
   */
  fastify.post<{
    Body: InstallRequestBody;
  }>(
    '/api/mcp_server/install',
    {
      schema: {
        operationId: 'installMcpServer',
        description: 'Install MCP server from catalog',
        tags: ['MCP Server'],
        body: zodToJsonSchema(installRequestSchema as any),
        response: {
          200: zodToJsonSchema(successResponseSchema as any),
        },
      },
    },
    async (request, reply) => {
      try {
        const { mcpConnectorId } = request.body;

        if (!mcpConnectorId) {
          return reply.code(400).send({ error: 'mcpConnectorId is required' });
        }

        await McpServerModel.saveMcpServerFromCatalog(mcpConnectorId);
        return reply.code(200).send({ success: true });
      } catch (error: any) {
        console.error('Failed to install MCP server from catalog:', error);

        if (error.message?.includes('not found in catalog')) {
          return reply.code(404).send({ error: error.message });
        }

        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * Uninstall MCP server
   */
  fastify.delete<{
    Params: UninstallParams;
  }>(
    '/api/mcp_server/:mcpServerName',
    {
      schema: {
        operationId: 'uninstallMcpServer',
        description: 'Uninstall MCP server',
        tags: ['MCP Server'],
        params: zodToJsonSchema(uninstallParamsSchema as any),
        response: {
          200: zodToJsonSchema(successResponseSchema as any),
          400: zodToJsonSchema(errorResponseSchema as any),
          500: zodToJsonSchema(errorResponseSchema as any),
        },
      },
    },
    async (request, reply) => {
      try {
        const { mcpServerName } = request.params;

        if (!mcpServerName) {
          return reply.code(400).send({ error: 'mcpServerName is required' });
        }

        await McpServerModel.uninstallMcpServer(mcpServerName);
        return reply.code(200).send({ success: true });
      } catch (error) {
        console.error('Failed to uninstall MCP server:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * Start MCP server OAuth flow
   */
  fastify.post<{
    Body: StartOAuthRequestBody;
  }>(
    '/api/mcp_server/start_oauth',
    {
      schema: {
        operationId: 'startMcpServerOauth',
        description: 'Start MCP server OAuth flow',
        tags: ['MCP Server'],
        body: zodToJsonSchema(startOAuthRequestSchema as any),
        response: {
          200: zodToJsonSchema(authUrlResponseSchema as any),
          400: zodToJsonSchema(errorResponseSchema as any),
          500: zodToJsonSchema(errorResponseSchema as any),
        },
      },
    },
    async (request, reply) => {
      try {
        const { mcpConnectorId } = request.body;

        if (!mcpConnectorId) {
          return reply.code(400).send({ error: 'mcpConnectorId is required' });
        }

        // TODO: Implement OAuth flow with the oauth proxy service
        return reply.send({ authUrl: `https://oauth-proxy.archestra.ai/auth/${mcpConnectorId}` });
      } catch (error) {
        console.error('Failed to start MCP server OAuth:', error);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
};

export default mcpServerRoutes;
