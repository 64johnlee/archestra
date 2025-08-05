import { McpServer } from '@archestra/types';
import { McpServerModel } from '@backend/models';
import PodmanContainer from '@backend/sandbox/podman/container';
import PodmanRuntime from '@backend/sandbox/podman/runtime';
import websocketService from '@backend/websocket';

class McpServerSandboxManager {
  private podmanRuntime: InstanceType<typeof PodmanRuntime>;
  private mcpServerNameToPodmanContainerMap: Map<string, PodmanContainer> = new Map();

  onSandboxStartupSuccess: () => void = () => {};
  onSandboxStartupError: (error: Error) => void = () => {};

  constructor() {
    this.podmanRuntime = new PodmanRuntime(
      this.onPodmanMachineInstallationSuccess.bind(this),
      this.onPodmanMachineInstallationError.bind(this)
    );
  }

  private async onPodmanMachineInstallationSuccess() {
    console.log('Podman machine installation successful. Starting all installed MCP servers...');

    const installedMcpServers = await McpServerModel.getAll();
    const totalServers = installedMcpServers.length;
    let successfulServers = 0;
    let failedServers = 0;

    // Start all servers in parallel
    const startPromises = installedMcpServers.map(async (mcpServer) => {
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

  async startServer({ name, serverConfig }: McpServer) {
    console.log(`Starting MCP server ${name} with server config: ${JSON.stringify(serverConfig)}`);

    const container = new PodmanContainer(name, serverConfig);
    await container.startOrCreateContainer();

    this.mcpServerNameToPodmanContainerMap.set(name, container);
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

  proxyRequestToMcpServerContainer(mcpServerName: string, request: any) {
    const podmanContainer = this.mcpServerNameToPodmanContainerMap.get(mcpServerName);
    if (!podmanContainer) {
      throw new Error(`MCP server with name ${mcpServerName} not found`);
    }
    return podmanContainer.proxyRequestToContainer(request);
  }
}

export default new McpServerSandboxManager();
