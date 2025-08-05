import { PodmanContainer } from '@backend/sandbox/podman';

export default class SandboxedMCP {
  private mcpServerName: string;
  private command: string;
  private args: string[];
  private envVars: Record<string, string>;

  constructor(mcpServerName: string, command: string, args: string[], envVars: Record<string, string>) {
    this.mcpServerName = mcpServerName;
    this.command = command;
    this.args = args;
    this.envVars = envVars;
  }

  async start() {
    console.log(`Starting MCP server ${this.mcpServerName} with command: ${this.command} ${this.args.join(' ')}`);

    const container = new PodmanContainer(this.mcpServerName, this.command, this.args, this.envVars);
    await container.startOrCreateContainer();
  }

  /**
   * NOTE: this isn't fully implemented/tested yet, just a placeholder for now 😅
   *
   * Need to figure out how to properly proxy stdio to the container..
   */
  proxyRequestToContainer(request: any) {
    console.log('Proxying request to MCP server', request);
  }
}
