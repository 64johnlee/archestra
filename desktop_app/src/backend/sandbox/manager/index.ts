// import { mcpServersTable } from '@backend/database/schema/mcpServer';
import PodmanRuntime from '@backend/sandbox/podman/runtime';
import SandboxedMCP from '@backend/sandbox/sandboxedMCP';
import websocketService from '@backend/websocket';

// TODO: this should use the MCPServer model schema once we agree w/ Matvey what the catalog schema will look like
type InstalledMcpServer = {
  id: number;
  name: string;
  dockerImage: string;
  envVars: Record<string, string>;
};

class MCPServerSandboxManager {
  private podmanRuntime: InstanceType<typeof PodmanRuntime>;
  private mcpServerIdToSandboxedMCPMap: Map<number, SandboxedMCP> = new Map();

  onSandboxStartupSuccess: () => void = () => {};
  onSandboxStartupError: (error: Error) => void = () => {};

  constructor() {
    this.podmanRuntime = new PodmanRuntime(
      this.onPodmanMachineInstallationSuccess.bind(this),
      this.onPodmanMachineInstallationError.bind(this)
    );
  }

  private async getInstalledMcpServers(): Promise<InstalledMcpServer[]> {
    // TODO: uncomment this out once we agree w/ Matvey what the catalog schema will look like
    // const mcpServers = await MCPServer.getAll();
    return [
      {
        id: 1,
        name: 'Grafana',
        dockerImage: 'mcp/grafana',
        envVars: {
          GRAFANA_URL: 'http://localhost:3000',
          GRAFANA_API_KEY: '1234567890',
        },
      },
      {
        id: 2,
        name: 'GitHub',
        dockerImage: 'ghcr.io/github/github-mcp-server',
        envVars: {
          GITHUB_PERSONAL_ACCESS_TOKEN: '1234567890',
        },
      },
    ];
  }

  private async onPodmanMachineInstallationSuccess() {
    console.log('Podman machine installation successful. Starting all installed MCP servers...');

    const mcpServers = await this.getInstalledMcpServers();
    const totalServers = mcpServers.length;
    let successfulServers = 0;
    let failedServers = 0;

    // Start all servers in parallel
    const startPromises = mcpServers.map(async (mcpServer) => {
      websocketService.broadcast({
        type: 'sandbox-mcp-server-starting',
        payload: { serverName: mcpServer.name },
      });

      try {
        await this.startServer(mcpServer);
        successfulServers++;
        websocketService.broadcast({
          type: 'sandbox-mcp-server-started',
          payload: { serverName: mcpServer.name },
        });
      } catch (error) {
        failedServers++;
        websocketService.broadcast({
          type: 'sandbox-mcp-server-failed',
          payload: {
            serverName: mcpServer.name,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    });

    const results = await Promise.allSettled(startPromises);

    // Broadcast completion
    websocketService.broadcast({
      type: 'sandbox-startup-completed',
      payload: { totalServers, successfulServers, failedServers },
    });

    // Check for failures
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      console.error(`Failed to start ${failures.length} MCP server(s):`);
      failures.forEach((failure, index) => {
        console.error(`  - ${(failure as PromiseRejectedResult).reason}`);
      });
      this.onSandboxStartupError(new Error(`Failed to start ${failures.length} MCP server(s)`));
      return;
    }

    console.log('All MCP server containers started successfully');
    this.onSandboxStartupSuccess();
  }

  private onPodmanMachineInstallationError(error: Error) {
    this.onSandboxStartupError(new Error(`There was an error starting up podman machine: ${error.message}`));
  }

  async startServer(mcpServer: InstalledMcpServer) {
    const sandboxedMCP = new SandboxedMCP(mcpServer.dockerImage, mcpServer.envVars);

    this.mcpServerIdToSandboxedMCPMap.set(mcpServer.id, sandboxedMCP);
    await sandboxedMCP.start();
  }

  /**
   * Start the archestra podman machine and all installed MCP server containers
   */
  startAllInstalledMcpServers() {
    websocketService.broadcast({
      type: 'sandbox-startup-started',
      payload: {},
    });
    this.podmanRuntime.ensureArchestraMachineIsRunning();
  }

  /**
   * Stop the archestra podman machine (which will stop all installed MCP server containers)
   */
  turnOffSandbox() {
    this.podmanRuntime.stopArchestraMachine();
  }

  proxyRequestToMcpServerContainer(mcpServerId: number, request: any) {
    const sandboxedMCP = this.mcpServerIdToSandboxedMCPMap.get(mcpServerId);
    if (!sandboxedMCP) {
      throw new Error(`MCP server with id ${mcpServerId} not found`);
    }
    return sandboxedMCP.proxyRequestToContainer(request);
  }
}

export default new MCPServerSandboxManager();
