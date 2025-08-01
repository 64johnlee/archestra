import { useChatStore } from '@/stores/chat-store';

import { useChatGPTChat } from './use-chatgpt-chat';
import { useOllamaChat } from './use-ollama-chat';

interface UseChatProviderOptions {
  model: string;
  sessionId?: string;
  initialMessages?: any[];
}

export function useChatProvider({ model, sessionId, initialMessages = [] }: UseChatProviderOptions) {
  const { selectedProvider, openaiApiKey } = useChatStore();

  const ollamaChat = useOllamaChat({
    model,
    sessionId,
    initialMessages,
  });

  const chatGPTChat = useChatGPTChat({
    model: selectedProvider === 'chatgpt' ? 'gpt-4o' : model,
    sessionId,
    initialMessages,
    apiKey: openaiApiKey || undefined,
  });

  // Return the appropriate chat hook based on selected provider
  if (selectedProvider === 'chatgpt') {
    return chatGPTChat;
  }

  return ollamaChat;
}
