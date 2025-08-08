import {
  type ChatWithMessages,
  type ParsedContent,
  type ServerChatWithMessagesRepresentation,
  type ServerToolCallRepresentation,
  type ToolCall,
  ToolCallStatus,
} from '@ui/types';

import { convertArchestraToolNameToServerAndToolName } from './tools';

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

const generateNewToolCallId = () => crypto.randomUUID();

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

export const initializeChat = (chat: ServerChatWithMessagesRepresentation): ChatWithMessages => {
  return {
    ...chat,
    messages: chat.messages.map((message) => {
      /**
       * TODO: message.content can be of the following type:
       *
       * (property) content: string | number | boolean | {
       * [key: string]: unknown;
       * } | unknown[]
       *
       * but parseThinkingContent expects a string, so we should really think carefully about what
       * we are doing here..
       */
      const { thinking, response } = parseThinkingContent(message.content as any);

      return {
        ...message,
        /**
         * TODO: what should this be?👇 message.tool_calls isn't actually a thing, if it's not
         * then do we actually need to have it on the ChatWithMessages type?
         *
         * or if it is, we're not properly typing it (should be typed going into and out of the database, such
         * that it trickles down into openapi codegen'd types...)
         */
        // toolCalls: initializeToolCalls(message.tool_calls || []),
        toolCalls: [] as ToolCall[],
        content: response,
        thinkingContent: thinking,
        isStreaming: false,
        isToolExecuting: false,
        isThinkingStreaming: false,
      };
    }),
  };
};
