import { eq } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

import db from '@backend/database';
import { mcpServersTable } from '@backend/database/schema/mcpServer';
import { ExternalMcpClientModel } from '@backend/models';

// Database schemas
export const insertMcpServerSchema = createInsertSchema(mcpServersTable);
export const selectMcpServerSchema = createSelectSchema(mcpServersTable);

export default class McpServer {
  static async create(data: typeof mcpServersTable.$inferInsert) {
    return db.insert(mcpServersTable).values(data).returning();
  }

  static async getAll() {
    return db.select().from(mcpServersTable);
  }

  static async getById(id: (typeof mcpServersTable.$inferSelect)['id']) {
    return db.select().from(mcpServersTable).where(eq(mcpServersTable.id, id));
  }

  /**
   * Get installed MCP servers
   */
  static async getInstalledMcpServers() {
    return await this.getAll();
  }

  /**
   * Save MCP server from catalog
   */
  static async saveMcpServerFromCatalog(connectorId: string) {
    /**
     * TODO: use archestra catalog codegen'd client to fetch the catalog entry
     */
    // const catalogEntry = CATALOG.find((entry) => entry.id === connectorId);

    if (!catalogEntry) {
      throw new Error(`MCP connector ${connectorId} not found in catalog`);
    }

    const now = new Date();
    const [server] = await db
      .insert(mcpServersTable)
      .values({
        name: catalogEntry.title,
        serverConfig: catalogEntry.server_config,
        createdAt: now.toISOString(),
      })
      .onConflictDoUpdate({
        target: mcpServersTable.name,
        set: {
          serverConfig: catalogEntry.server_config,
        },
      })
      .returning();

    // Sync all connected external MCP clients after installing
    await ExternalMcpClientModel.syncAllConnectedExternalMcpClients();

    return server;
  }

  /**
   * Uninstall MCP server
   */
  static async uninstallMcpServer(name: string) {
    await db.delete(mcpServersTable).where(eq(mcpServersTable.name, name));

    // Sync all connected external MCP clients after uninstalling
    await ExternalMcpClientModel.syncAllConnectedExternalMcpClients();
  }
}
