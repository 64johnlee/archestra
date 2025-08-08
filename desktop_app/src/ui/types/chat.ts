import type { Chat as ServerChatRepresentation } from '@clients/archestra/api/gen';

import { type ToolCall } from './tools';

type ServerChatMessageRepresentation = ServerChatRepresentation['messages'][number];

export enum ChatMessageStatus {
  Submitted = 'submitted',
  Streaming = 'streaming',
  Ready = 'ready',
  Error = 'error',
}

export interface ChatMessage extends Omit<ServerChatMessageRepresentation, 'tool_calls'> {
  id: string;
  /**
   * toolCalls is a superset of the tool_calls field in the backend API
   */
  toolCalls: ToolCall[];
  thinkingContent: string;
  isStreaming: boolean;
  isToolExecuting: boolean;
  isThinkingStreaming: boolean;
}

export interface ChatWithMessages extends Omit<ServerChatRepresentation, 'messages'> {
  /**
   * messages is a superset of the messages field in the backend API
   */
  messages: ChatMessage[];
}

export { type ServerChatMessageRepresentation, type ServerChatRepresentation };
