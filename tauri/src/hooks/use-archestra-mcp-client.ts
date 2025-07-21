// import { useEffect, useState, useCallback } from 'react';

const MCP_SERVER_URL = "http://localhost:54587";

export function useArchestraMcpClient() {
  // TODO: Implement MCP client, use @modelcontextprotocol/sdk package
  const isLoadingMcpTools = false;
  const mcpTools: any[] = [];

  return {
    MCP_SERVER_URL,
    isLoadingMcpTools,
    mcpTools,
    executeTool: async () => {},
  };
}
