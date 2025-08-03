import { PodmanContainer, PodmanImage } from '@backend/sandbox/podman';

export default class SandboxedMCP {
  private imageName: string;
  private envVars: Record<string, string>;

  constructor(imageName: string, envVars: Record<string, string>) {
    this.imageName = imageName;
    this.envVars = envVars;
  }

  async start() {
    console.log(`Starting MCP server ${this.imageName}`);

    const image = new PodmanImage(this.imageName);
    await image.pullImage();

    const container = new PodmanContainer(this.imageName, this.envVars);
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
