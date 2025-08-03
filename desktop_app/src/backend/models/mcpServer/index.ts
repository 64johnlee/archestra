import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import path from 'path';

import db from '@backend/database';
import { mcpServersTable } from '@backend/database/schema/mcpServer';
import type { ConnectorCatalogEntry } from '@types';

export class MCPServer {
  // Cache for the catalog to avoid reading file multiple times
  private static catalogCache: ConnectorCatalogEntry[] | null = null;

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
   * Get MCP connector catalog
   */
  static async getMcpConnectorCatalog(): Promise<ConnectorCatalogEntry[]> {
    if (this.catalogCache) {
      return this.catalogCache;
    }

    try {
      const catalogPath = path.join(__dirname, 'catalog.json');
      const catalogContent = await readFile(catalogPath, 'utf-8');
      this.catalogCache = JSON.parse(catalogContent);
      return this.catalogCache!;
    } catch (error) {
      console.error('Failed to load MCP connector catalog:', error);
      return [];
    }
  }

  /**
   * Save MCP server from catalog
   */
  static async saveMcpServerFromCatalog(connectorId: string) {
    const catalog = await this.getMcpConnectorCatalog();
    const catalogEntry = catalog.find((entry) => entry.id === connectorId);

    if (!catalogEntry) {
      throw new Error(`MCP connector ${connectorId} not found in catalog`);
    }

    const now = new Date();
    const [server] = await db
      .insert(mcpServersTable)
      .values({
        name: catalogEntry.title,
        serverConfig: catalogEntry.server_config,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: mcpServersTable.name,
        set: {
          serverConfig: catalogEntry.server_config,
          updatedAt: now,
        },
      })
      .returning();

    // Sync all connected external MCP clients after installing
    const { ExternalMcpClient } = await import('@backend/models/externalMcpClient');
    await ExternalMcpClient.syncAllConnectedExternalMcpClients();

    return server;
  }

  /**
   * Uninstall MCP server
   */
  static async uninstallMcpServer(name: string) {
    await db.delete(mcpServersTable).where(eq(mcpServersTable.name, name));

    // Sync all connected external MCP clients after uninstalling
    const { ExternalMcpClient } = await import('@backend/models/externalMcpClient');
    await ExternalMcpClient.syncAllConnectedExternalMcpClients();
  }
}
