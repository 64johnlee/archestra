import type { Chat as BaseChat } from '@clients/archestra/api/gen';

import { type ToolCall } from './tools';

type BaseChatMessage = BaseChat['messages'][number];

export enum ChatMessageStatus {
  Submitted = 'submitted',
  Streaming = 'streaming',
  Ready = 'ready',
  Error = 'error',
}

export interface ChatMessage extends Omit<BaseChatMessage, 'tool_calls'> {
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

export interface ChatWithMessages extends Omit<BaseChat, 'messages'> {
  /**
   * messages is a superset of the messages field in the backend API
   */
  messages: ChatMessage[];
}
