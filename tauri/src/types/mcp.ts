export interface MCPTool {
  serverName: string;
  tool: {
    name: string;
    description?: string;
    inputSchema: any;
  };
}

export interface MCPServer {
  name: string;
  url: string;
  client: any | null;
  tools: any[];
  status: 'connecting' | 'connected' | 'error';
  error?: string;
}