import {
  type ChatWithMessages,
  type ServerChatRepresentation,
  type ServerToolCallRepresentation,
  type ToolCall,
  ToolCallStatus,
} from '@ui/types';

import { convertArchestraToolNameToServerAndToolName } from './tools';

interface ParsedContent {
  thinking: string;
  response: string;
  isThinkingStreaming: boolean;
}

export function checkModelSupportsTools(model: string): boolean {
  return (
    model.includes('functionary') ||
    model.includes('mistral') ||
    model.includes('command') ||
    (model.includes('qwen') && !model.includes('0.6b')) ||
    model.includes('hermes') ||
    model.includes('llama3.1') ||
    model.includes('llama-3.1') ||
    model.includes('phi') ||
    model.includes('granite')
  );
}

export function addCancellationText(content: string): string {
  return content.includes('[Cancelled]') ? content : content + ' [Cancelled]';
}

export function parseThinkingContent(content: string): ParsedContent {
  if (!content) {
    return { thinking: '', response: '', isThinkingStreaming: false };
  }

  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;

  let thinking = '';
  let response = content;
  let isThinkingStreaming = false;

  const completedMatches = [...content.matchAll(thinkRegex)];
  const completedThinking = completedMatches.map((match) => match[1]).join('\n\n');

  let contentWithoutCompleted = content.replace(thinkRegex, '');

  const incompleteMatch = contentWithoutCompleted.match(/<think>([\s\S]*)$/);

  if (incompleteMatch) {
    const incompleteThinking = incompleteMatch[1];
    const beforeIncomplete = contentWithoutCompleted.substring(0, contentWithoutCompleted.indexOf('<think>'));

    thinking = completedThinking ? `${completedThinking}\n\n${incompleteThinking}` : incompleteThinking;
    response = beforeIncomplete.trim();
    isThinkingStreaming = true;
  } else {
    thinking = completedThinking;
    response = contentWithoutCompleted.trim();
    isThinkingStreaming = false;
  }

  return {
    thinking,
    response,
    isThinkingStreaming,
  };
}

export const generateNewToolCallId = () => crypto.randomUUID();

export const initializeToolCalls = (toolCalls: ServerToolCallRepresentation[]): ToolCall[] => {
  return toolCalls.map((toolCall) => {
    const [serverName, toolName] = convertArchestraToolNameToServerAndToolName(toolCall.function.name);
    return {
      ...toolCall,
      id: generateNewToolCallId(),
      serverName,
      name: toolName,
      arguments: toolCall.function.arguments as Record<string, any>,
      result: '',
      error: '',
      status: ToolCallStatus.Pending,
      executionTime: 0,
      startTime: null,
      endTime: null,
    };
  });
};

export const generateNewMessageId = () => crypto.randomUUID();

export const generateNewMessageCreatedAt = () => crypto.randomUUID();

export const initializeChat = (chat: ServerChatRepresentation): ChatWithMessages => {
  return {
    ...chat,
    /**
     * TODO: update/remove these.. what should these actual types be?
     *
     * I think we need to update the content "json" type in
     * desktop_app/src/backend/database/schema/messages.ts
     * to be more strongly typed (see some of the other schema files in desktop_app/src/backend/database/schema
     * for examples of how we do this)
     *
     * The benefit of this is that that strongly typed value than trickles down into zod schemas, into our
     * openapi schema, and finally as codegen'd typescript types that we can then use here properly
     */
    messages: (chat.messages || []).map((message: any) => {
      const { thinking, response } = parseThinkingContent(message.content);

      return {
        ...message,
        id: generateNewMessageId(),
        toolCalls: initializeToolCalls(message.tool_calls || []),
        content: response,
        thinkingContent: thinking,
        isStreaming: false,
        isToolExecuting: false,
        isThinkingStreaming: false,
      };
    }),
  };
};
