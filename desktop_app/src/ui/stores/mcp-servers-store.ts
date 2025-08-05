import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { CallToolRequest, ClientCapabilities } from '@modelcontextprotocol/sdk/types';
import { create } from 'zustand';

import { getMcpServers, installMcpServer, startMcpServerOauth, uninstallMcpServer } from '@clients/archestra/api/gen';
import {
  McpServer,
  type McpServer as McpServerCatalogEntry,
  getSearch as searchCatalog,
} from '@clients/archestra/catalog/gen';
import config from '@ui/config';
import { getToolsGroupedByServer } from '@ui/lib/utils/mcp-server';
import { formatToolName } from '@ui/lib/utils/tools';
import { ConnectedMcpServer, McpServerStatus, McpServerToolsMap, ToolWithMcpServerName } from '@ui/types';

const ARCHESTRA_MCP_SERVER_NAME = 'archestra';

interface McpServersState {
  archestraMcpServer: ConnectedMcpServer | null;

  installedMcpServers: ConnectedMcpServer[];
  loadingInstalledMcpServers: boolean;
  errorLoadingInstalledMcpServers: string | null;

  connectorCatalog: McpServerCatalogEntry[];
  loadingConnectorCatalog: boolean;
  errorFetchingConnectorCatalog: string | null;

  installingMcpServerName: string | null;
  errorInstallingMcpServer: string | null;

  uninstallingMcpServerName: string | null;
  errorUninstallingMcpServer: string | null;

  selectedTools: ToolWithMcpServerName[];
  toolSearchQuery: string;
}

interface McpServersActions {
  loadInstalledMcpServers: () => Promise<void>;
  addMcpServerToInstalledMcpServers: (mcpServer: McpServer) => void;
  removeMcpServerFromInstalledMcpServers: (mcpServerName: string) => void;

  loadConnectorCatalog: () => Promise<void>;
  installMcpServerFromConnectorCatalog: (mcpServer: McpServerCatalogEntry) => Promise<void>;
  uninstallMcpServer: (mcpServerName: string) => Promise<void>;

  connectToArchestraMcpServer: () => Promise<void>;
  connectToMcpServer: (serverName: string, url: string) => Promise<Client | null>;

  executeTool: (serverName: string, request: CallToolRequest['params']) => Promise<any>;
  getAllAvailableTools: () => ToolWithMcpServerName[];
  getFilteredTools: () => ToolWithMcpServerName[];
  getAllAvailableToolsGroupedByServer: () => McpServerToolsMap;
  getFilteredToolsGroupedByServer: () => McpServerToolsMap;

  addSelectedTool: (tool: ToolWithMcpServerName) => void;
  removeSelectedTool: (tool: ToolWithMcpServerName) => void;

  setToolSearchQuery: (query: string) => void;
}

type McpServersStore = McpServersState & McpServersActions;

export function constructProxiedMcpServerUrl(mcpServerName: string) {
  return `${config.archestra.mcpProxyUrl}/${mcpServerName}`;
}

const configureMcpClient = async (
  clientName: string,
  clientUrl: string,
  clientCapabilities: ClientCapabilities
): Promise<Client | null> => {
  const client = new Client(
    {
      name: clientName,
      version: '1.0.0',
    },
    {
      capabilities: clientCapabilities,
    }
  );

  const transport = new StreamableHTTPClientTransport(new URL(clientUrl));

  await client.connect(transport);

  return client;
};

const initializeConnectedMcpServerTools = async (
  client: Client,
  serverName: string
): Promise<ToolWithMcpServerName[]> => {
  const { tools } = await client.listTools();
  return tools.map((tool) => ({
    ...tool,
    serverName,
    enabled: true,
  }));
};

export const useMcpServersStore = create<McpServersStore>((set, get) => ({
  // State
  archestraMcpServer: null,

  installedMcpServers: [],
  loadingInstalledMcpServers: false,
  errorLoadingInstalledMcpServers: null,

  connectorCatalog: [],
  loadingConnectorCatalog: false,
  errorFetchingConnectorCatalog: null,

  installingMcpServerName: null,
  errorInstallingMcpServer: null,

  uninstallingMcpServerName: null,
  errorUninstallingMcpServer: null,

  selectedTools: [],
  toolSearchQuery: '',

  // Actions
  loadInstalledMcpServers: async () => {
    try {
      set({
        loadingInstalledMcpServers: true,
        errorLoadingInstalledMcpServers: null,
      });

      const response = await getMcpServers();

      if ('data' in response && response.data) {
        // Add servers and connect to them
        for (const server of response.data) {
          get().addMcpServerToInstalledMcpServers(server);
        }
      } else if ('error' in response) {
        const errorMessage = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
        throw new Error(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ errorLoadingInstalledMcpServers: errorMessage });
    } finally {
      set({ loadingInstalledMcpServers: false });
    }
  },

  addMcpServerToInstalledMcpServers: (mcpServer: McpServer) => {
    set((state) => ({
      installedMcpServers: [
        ...state.installedMcpServers,
        {
          ...mcpServer,
          tools: [],
          url: constructProxiedMcpServerUrl(mcpServer.name),
          status: McpServerStatus.Connecting,
          error: null,
          client: null,
        },
      ],
    }));

    // Connect to the newly added server
    const newServer = get().installedMcpServers.find((s) => s.name === mcpServer.name);
    if (newServer) {
      get().connectToMcpServer(newServer.name, newServer.url);
    }
  },

  removeMcpServerFromInstalledMcpServers: (mcpServerName: string) => {
    // Close the client connection before removing
    const server = get().installedMcpServers.find((s) => s.name === mcpServerName);
    if (server?.client) {
      server.client.close();
    }

    set((state) => ({
      installedMcpServers: state.installedMcpServers.filter((mcpServer) => mcpServer.name !== mcpServerName),
    }));
  },

  loadConnectorCatalog: async () => {
    try {
      set({
        loadingConnectorCatalog: true,
        errorFetchingConnectorCatalog: null,
      });

      const response = await searchCatalog();

      if ('data' in response && response.data) {
        // Type assertion since the API doesn't return proper types yet
        const entries = response.data as McpServerCatalogEntry[];
        set({
          connectorCatalog: entries,
        });
      } else if ('error' in response) {
        throw new Error(response.error as string);
      }
    } catch (error) {
      set({ errorFetchingConnectorCatalog: error as string });
    } finally {
      set({ loadingConnectorCatalog: false });
    }
  },

  installMcpServerFromConnectorCatalog: async ({ oauth, name, id }: McpServerCatalogEntry) => {
    try {
      set({
        installingMcpServerName: name,
        errorInstallingMcpServer: null,
      });

      // Check if OAuth is required
      if (oauth?.required) {
        try {
          // Start OAuth flow
          const response = await startMcpServerOauth({
            body: { mcpConnectorId: id },
          });

          if ('data' in response && response.data) {
            // For OAuth connectors, the backend will handle the installation after successful auth
            alert(`OAuth setup started for ${name}. Please complete the authentication in your browser.`);
          } else if ('error' in response) {
            throw new Error(response.error as string);
          }
        } catch (error) {
          set({ errorInstallingMcpServer: error as string });
        }
      } else {
        const response = await installMcpServer({
          body: { mcpConnectorId: id },
        });

        if ('error' in response) {
          throw new Error(response.error as string);
        }

        // Refresh the MCP servers list
        await useMcpServersStore.getState().loadInstalledMcpServers();
      }
    } catch (error) {
      set({ errorInstallingMcpServer: error as string });
    } finally {
      set({ installingMcpServerName: null });
    }
  },

  uninstallMcpServer: async (mcpServerName: string) => {
    try {
      set({
        uninstallingMcpServerName: mcpServerName,
        errorUninstallingMcpServer: null,
      });

      const response = await uninstallMcpServer({
        path: { mcp_server_name: mcpServerName },
      });

      if ('error' in response) {
        throw new Error(response.error as string);
      }

      // Remove from MCP servers store
      useMcpServersStore.getState().removeMcpServerFromInstalledMcpServers(mcpServerName);
    } catch (error) {
      set({ errorUninstallingMcpServer: error as string });
    } finally {
      set({ uninstallingMcpServerName: null });
    }
  },

  connectToArchestraMcpServer: async () => {
    const MAX_RETRIES = 30;
    const RETRY_DELAY_MILLISECONDS = 1000;
    let retries = 0;

    const attemptConnection = async (): Promise<boolean> => {
      return true;
    };

    // Keep trying to connect until successful or max retries reached
    while (retries < MAX_RETRIES) {
      const connected = await attemptConnection();
      if (connected) {
        return;
      }

      retries++;
      if (retries < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MILLISECONDS));
      }
    }

    // If we've exhausted all retries, set error state
    set({
      archestraMcpServer: {
        name: ARCHESTRA_MCP_SERVER_NAME,
        id: 0,
        createdAt: new Date().toISOString(),
        serverConfig: {
          command: '',
          args: [],
          env: {},
        },
        url: config.archestra.mcpUrl,
        client: null,
        tools: [],
        status: McpServerStatus.Error,
        error: 'Failed to connect after maximum retries',
      },
    });
  },

  connectToMcpServer: async (serverName: string, url: string) => {
    if (!url) {
      set((state) => ({
        installedMcpServers: state.installedMcpServers.map((server) =>
          server.name === serverName
            ? {
                ...server,
                client: null,
                status: McpServerStatus.Error,
                error: 'No URL configured',
              }
            : server
        ),
      }));
      return null;
    }

    try {
      const client = await configureMcpClient(`${serverName}-client`, url, {
        tools: {},
      });

      if (!client) {
        return null;
      }

      // List available tools
      const tools = await initializeConnectedMcpServerTools(client, serverName);

      set(({ installedMcpServers }) => ({
        installedMcpServers: installedMcpServers.map((server) =>
          server.name === serverName
            ? {
                ...server,
                client,
                tools,
                status: McpServerStatus.Connected,
              }
            : server
        ),
      }));

      return client;
    } catch (error) {
      // Extract more detailed error information
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('HTTP 500')) {
          errorMessage = `Server error (500) - possible JSON-RPC format issue`;
        }
      }

      set((state) => ({
        installedMcpServers: state.installedMcpServers.map((server) =>
          server.name === serverName
            ? {
                ...server,
                client: null,
                status: McpServerStatus.Error,
                error: errorMessage,
              }
            : server
        ),
      }));
      return null;
    }
  },

  executeTool: async (serverName: string, toolCallRequest: CallToolRequest['params']) => {
    const { archestraMcpServer, installedMcpServers } = get();

    let client: Client | null = null;
    if (serverName === ARCHESTRA_MCP_SERVER_NAME && archestraMcpServer) {
      client = archestraMcpServer.client;
    } else {
      const server = installedMcpServers.find((s) => s.name === serverName);
      client = server?.client || null;
    }

    if (!client) {
      throw new Error(`No connection to server ${serverName}`);
    }

    try {
      const result = await client.callTool(toolCallRequest);
      return result;
    } catch (error) {
      throw error;
    }
  },

  getAllAvailableTools: () => {
    const { installedMcpServers } = get();
    return installedMcpServers.flatMap((server) => server.tools);
  },

  getFilteredTools: () => {
    const { toolSearchQuery, getAllAvailableTools } = get();
    const allAvailableTools = getAllAvailableTools();

    if (!toolSearchQuery.trim()) {
      return allAvailableTools;
    }

    const query = toolSearchQuery.toLowerCase();
    const filtered = allAvailableTools.filter(({ serverName, name, description }) => {
      const serverMatches = serverName.toLowerCase().includes(query);
      const toolNameMatches = name.toLowerCase().includes(query);
      const formattedNameMatches = formatToolName(name).toLowerCase().includes(query);
      const descriptionMatches = description?.toLowerCase().includes(query) || false;
      return serverMatches || toolNameMatches || formattedNameMatches || descriptionMatches;
    });

    return filtered;
  },

  getAllAvailableToolsGroupedByServer: () => getToolsGroupedByServer(get().getAllAvailableTools()),
  getFilteredToolsGroupedByServer: () => getToolsGroupedByServer(get().getFilteredTools()),

  addSelectedTool: (tool: ToolWithMcpServerName) => {
    set(({ selectedTools }) => {
      // if tool is not already in selectedTools, add it
      if (!selectedTools.some((t) => t.name === tool.name)) {
        return {
          selectedTools: [...selectedTools, tool],
        };
      }
      return { selectedTools };
    });
  },

  removeSelectedTool: (tool: ToolWithMcpServerName) => {
    set(({ selectedTools }) => ({
      selectedTools: selectedTools.filter((t) => t.name !== tool.name),
    }));
  },

  setToolSearchQuery: (query: string) => {
    set({ toolSearchQuery: query });
  },
}));

// Initialize connections on store creation
useMcpServersStore.getState().connectToArchestraMcpServer();
useMcpServersStore.getState().loadInstalledMcpServers();
useMcpServersStore.getState().loadConnectorCatalog();

// Cleanup on window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const store = useMcpServersStore.getState();
    store.archestraMcpServer?.client?.close();
    store.installedMcpServers.forEach((server) => server.client?.close());
  });
}
