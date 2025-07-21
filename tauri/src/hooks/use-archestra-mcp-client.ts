import { useEffect, useState, useCallback } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fetch } from '@tauri-apps/plugin-http';
import type { MCPTool, MCPServer } from '../types/mcp';

const MCP_SERVER_URL = "http://localhost:54587";

export function useArchestraMcpClient() {
  const [isLoadingMcpTools, setIsLoadingMcpTools] = useState(true);
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);

  const connectToServer = useCallback(async (serverName: string, url: string) => {
    console.log(`Connecting to MCP server: ${serverName} at ${url}`);
    
    try {
      const transport = new StreamableHTTPClientTransport(new URL(url), {
        fetch: fetch
      });
      
      const client = new Client({
        name: "archestra-ai-client",
        version: "1.0.0",
      }, {
        capabilities: {
          tools: {}
        }
      });

      console.log(`Connecting client to ${serverName}...`);
      await client.connect(transport);
      console.log(`Successfully connected to ${serverName}`);
      
      // List available tools
      console.log(`Listing tools for ${serverName}...`);
      const { tools } = await client.listTools();
      console.log(`Found ${tools.length} tools for ${serverName}:`, tools);
      
      setMcpServers(prev => prev.map(server => 
        server.name === serverName 
          ? { ...server, client, tools, status: 'connected' as const }
          : server
      ));

      // Add tools to the global tools list
      const serverTools: MCPTool[] = tools.map(tool => ({
        serverName,
        tool: {
          ...tool,
          inputSchema: tool.inputSchema || {}
        }
      }));

      setMcpTools(prev => [
        ...prev.filter(t => t.serverName !== serverName),
        ...serverTools
      ]);

      return client;
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverName}:`, error);
      
      // Extract more detailed error information
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('HTTP 500')) {
          errorMessage = `Server error (500) - possible JSON-RPC format issue`;
        }
      }
      
      setMcpServers(prev => prev.map(server => 
        server.name === serverName 
          ? { ...server, client: null, status: 'error' as const, error: errorMessage }
          : server
      ));
      return null;
    }
  }, []);

  const initializeMcpServers = useCallback(async () => {
    setIsLoadingMcpTools(true);
    
    // Define known MCP server endpoints
    const serverEndpoints = [
      { name: 'Archestra MCP', url: `${MCP_SERVER_URL}/mcp` },
      { name: 'Context7', url: `${MCP_SERVER_URL}/proxy/Context7` },
    ];

    // Initialize server states
    setMcpServers(serverEndpoints.map(endpoint => ({
      name: endpoint.name,
      url: endpoint.url,
      client: null,
      tools: [],
      status: 'connecting' as const,
    })));

    // Connect to all servers in parallel
    const connectionPromises = serverEndpoints.map(endpoint => 
      connectToServer(endpoint.name, endpoint.url)
    );

    await Promise.allSettled(connectionPromises);
    setIsLoadingMcpTools(false);
  }, [connectToServer]);

  const executeTool = useCallback(async (serverName: string, toolName: string, args: any) => {
    const server = mcpServers.find(s => s.name === serverName);
    if (!server?.client) {
      throw new Error(`No connection to server ${serverName}`);
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    } catch (error) {
      console.error(`Failed to execute tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }, [mcpServers]);

  useEffect(() => {
    initializeMcpServers();
    
    // Cleanup function to disconnect clients
    return () => {
      mcpServers.forEach(server => {
        if (server.client) {
          server.client.close();
        }
      });
    };
  }, []);

  return {
    MCP_SERVER_URL,
    isLoadingMcpTools,
    mcpTools,
    mcpServers,
    executeTool,
    refreshServers: initializeMcpServers,
  };
}
