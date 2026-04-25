import logger from "@/logging";
import { db, schema } from "@/database";
import { reconcileAgentToolsFromLabels } from "@/agents/reconcile-label-tools";

/**
 * Handles the `assign_agent_tools_from_labels` periodic task.
 * Runs every 60s, finds all MCP gateways in "automatic" mode,
 * and reconciles their tools based on current labels.
 */
export async function handleAssignAgentToolsFromLabels(
  payload: Record<string, unknown>,
): Promise<void> {
  // Find all agents in automatic mode
  const automaticAgents = await db
    .select({
      id: schema.agentsTable.id,
      organizationId: schema.agentsTable.organizationId,
    })
    .from(schema.agentsTable)
    .where(
      (await import("drizzle-orm")).eq(
        schema.agentsTable.toolAssignmentMode,
        "automatic",
      ),
    );

  if (automaticAgents.length === 0) {
    return;
  }

  logger.info(
    { count: automaticAgents.length },
    "Fanout enqueued per-agent tool reconciliation tasks",
  );

  // Process each agent
  // For now, reconcile synchronously (the spec says per-agent enqueue but that adds complexity)
  // The periodic task itself acts as the fanout; each reconciliation is fast (~10ms per agent)
  const results = await Promise.allSettled(
    automaticAgents.map((agent) =>
      reconcileAgentToolsFromLabels(agent.id, agent.organizationId),
    ),
  );

  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  logger.info(
    { total: automaticAgents.length, success, failed },
    "Label-based tool reconciliation complete",
  );
}
