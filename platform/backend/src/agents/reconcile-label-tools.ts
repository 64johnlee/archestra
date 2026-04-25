import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "@/database";
import { AgentToolModel } from "@/models";

/**
 * Reconciles an MCP gateway's tool assignments based on label matching.
 *
 * Flow:
 * 1. Get agent's label key:value pairs from agent_labels table
 * 2. Find all catalog entries (in same org) whose mcp_catalog_labels JSONB
 *    shares at least one (key, value) pair with the agent
 * 3. Collect all tool IDs from those catalogs
 * 4. Diff against existing dynamic agent_tools rows for this agent
 * 5. Remove rows that no longer match, add new ones
 */
export async function reconcileAgentToolsFromLabels(
  agentId: string,
  organizationId: string,
): Promise<{ added: number; removed: number }> {
  // 1. Get agent's label set
  const agentLabels = await db
    .select({
      key: schema.labelKeysTable.key,
      value: schema.labelValuesTable.value,
    })
    .from(schema.agentLabelsTable)
    .innerJoin(
      schema.labelKeysTable,
      eq(schema.agentLabelsTable.keyId, schema.labelKeysTable.id),
    )
    .innerJoin(
      schema.labelValuesTable,
      eq(schema.agentLabelsTable.valueId, schema.labelValuesTable.valueId),
    )
    .where(eq(schema.agentLabelsTable.agentId, agentId));

  // 2. Get all catalogs in org
  const catalogs = await db
    .select({
      id: schema.internalMcpCatalogTable.id,
      labels: schema.internalMcpCatalogTable.mcpCatalogLabels,
    })
    .from(schema.internalMcpCatalogTable)
    .where(eq(schema.internalMcpCatalogTable.organizationId, organizationId));

  // 3. Match catalogs by label overlap
  const agentLabelSet = new Set(
    agentLabels.map((l) => `${l.key}:${l.value}`),
  );

  const matchedCatalogIds: string[] = [];
  for (const cat of catalogs) {
    const catLabels = cat.labels ?? [];
    const catLabelSet = new Set(
      (catLabels as Array<{ key: string; value: string }>).map(
        (l) => `${l.key}:${l.value}`,
      ),
    );

    const hasOverlap = [...agentLabelSet].some((l) =>
      catLabelSet.has(l),
    );
    if (hasOverlap) {
      matchedCatalogIds.push(cat.id);
    }
  }

  // 4. Get tools from matched catalogs
  if (matchedCatalogIds.length === 0) {
    return removeAllDynamicTools(agentId);
  }

  const toolsInMatchedCatalogs = await db
    .select({ id: schema.toolsTable.id })
    .from(schema.toolsTable)
    .where(
      and(
        eq(schema.toolsTable.catalogId, schema.internalMcpCatalogTable.id),
        inArray(schema.internalMcpCatalogTable.id, matchedCatalogIds),
      ),
    );

  const targetToolIds = [
    ...new Set(toolsInMatchedCatalogs.map((t) => t.id)),
  ];

  // 5. Diff against existing dynamic rows
  const existingDynamic = await db
    .select({
      id: schema.agentToolsTable.id,
      toolId: schema.agentToolsTable.toolId,
    })
    .from(schema.agentToolsTable)
    .where(
      and(
        eq(schema.agentToolsTable.agentId, agentId),
        eq(schema.agentToolsTable.credentialResolutionMode, "dynamic"),
      ),
    );

  const existingDynamicToolIds = new Set(
    existingDynamic.map((r) => r.toolId),
  );

  const toRemove = existingDynamic.filter(
    (r) => !targetToolIds.includes(r.toolId),
  );
  const toAdd = targetToolIds.filter(
    (id) => !existingDynamicToolIds.has(id),
  );

  // 6. Remove stale rows
  if (toRemove.length > 0) {
    await db
      .delete(schema.agentToolsTable)
      .where(
        and(
          eq(schema.agentToolsTable.agentId, agentId),
          inArray(
            schema.agentToolsTable.id,
            toRemove.map((r) => r.id),
          ),
        ),
      );
  }

  // 7. Add new rows
  if (toAdd.length > 0) {
    await AgentToolModel.bulkCreate(
      toAdd.map((toolId) => ({
        agentId,
        toolId,
        mcpServerId: null,
        credentialResolutionMode: "dynamic",
      })),
    );
  }

  return { added: toAdd.length, removed: toRemove.length };
}

async function removeAllDynamicTools(
  agentId: string,
): Promise<{ added: number; removed: number }> {
  const existingDynamic = await db
    .select({ id: schema.agentToolsTable.id })
    .from(schema.agentToolsTable)
    .where(
      and(
        eq(schema.agentToolsTable.agentId, agentId),
        eq(schema.agentToolsTable.credentialResolutionMode, "dynamic"),
      ),
    );

  if (existingDynamic.length === 0) {
    return { added: 0, removed: 0 };
  }

  await db
    .delete(schema.agentToolsTable)
    .where(
      and(
        eq(schema.agentToolsTable.agentId, agentId),
        inArray(
          schema.agentToolsTable.id,
          existingDynamic.map((r) => r.id),
        ),
      ),
    );

  return { added: 0, removed: existingDynamic.length };
}
