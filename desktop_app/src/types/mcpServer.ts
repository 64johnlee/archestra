/**
 * NOTE: we can get rid of this once we have the MCP catalog setup
 *
 * Sync with Matvey :)
 */
export interface ConnectorCatalogEntry {
  id: string;
  title: string;
  description: string;
  image: string | null;
  category: string;
  tags: string[];
  author: string;
  version: string;
  homepage: string;
  repository: string;
  oauth?: {
    provider: string;
    required: boolean;
  };
  server_config: {
    transport: string;
    command: string;
    args: string[];
    env: Record<string, string>;
  };
}

export type ServerConfig = {
  command: string;
  args: string[];
  env: Record<string, string>;
};
