import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { McpServer } from '@clients/archestra/api/gen';

import { type Tool } from './tools';

export interface ToolWithMcpServerInfo extends Tool {
  server: {
    slug: string;
    name: string;
  };
  enabled: boolean;
}

export enum McpServerStatus {
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

/**
 * map of an mcp server slug to its tools
 */
export type McpServerToolsMap = Record<string, ToolWithMcpServerInfo[]>;

export interface ConnectedMcpServer extends McpServer {
  url: string;
  client: Client | null;
  tools: ToolWithMcpServerInfo[];
  status: McpServerStatus;
  error: string | null;
}
