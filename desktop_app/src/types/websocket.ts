export interface ChatTitleUpdatedPayload {
  chat_id: number;
  title: string;
}

export interface SandboxPodmanRuntimeProgressPayload {
  percentage: number;
  message?: string;
}

export interface SandboxMcpServerStartingPayload {
  serverName: string;
}

export interface SandboxMcpServerStartedPayload {
  serverName: string;
}

export interface SandboxMcpServerFailedPayload {
  serverName: string;
  error: string;
}

export interface SandboxStartupCompletedPayload {
  totalServers: number;
  successfulServers: number;
  failedServers: number;
}

// WebSocket message types with discriminated union
export type WebSocketMessage =
  | { type: 'chat-title-updated'; payload: ChatTitleUpdatedPayload }
  | { type: 'echo'; payload: any }
  | { type: 'sandbox-startup-started'; payload: {} }
  | { type: 'sandbox-podman-runtime-progress'; payload: SandboxPodmanRuntimeProgressPayload }
  | { type: 'sandbox-base-image-fetch-started'; payload: {} }
  | { type: 'sandbox-base-image-fetch-completed'; payload: {} }
  | { type: 'sandbox-mcp-server-starting'; payload: SandboxMcpServerStartingPayload }
  | { type: 'sandbox-mcp-server-started'; payload: SandboxMcpServerStartedPayload }
  | { type: 'sandbox-mcp-server-failed'; payload: SandboxMcpServerFailedPayload }
  | { type: 'sandbox-startup-completed'; payload: SandboxStartupCompletedPayload };
