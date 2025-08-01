import { useChatStore } from '@/stores/chat-store';

import { getDefaultModel, useAIChat } from './use-ai-chat';
import { useOllamaChat } from './use-ollama-chat';

interface UseChatProviderOptions {
  model: string;
  sessionId?: string;
  initialMessages?: any[];
}

export function useChatProvider({ model, sessionId, initialMessages = [] }: UseChatProviderOptions) {
  const { selectedProvider, openaiApiKey, anthropicApiKey } = useChatStore();

  const ollamaChat = useOllamaChat({
    model,
    sessionId,
    initialMessages,
  });

  const aiChat = useAIChat({
    provider: selectedProvider === 'chatgpt' ? 'openai' : 'anthropic',
    model: model || (selectedProvider === 'chatgpt' ? getDefaultModel('openai') : getDefaultModel('anthropic')),
    sessionId,
    initialMessages,
    apiKey: selectedProvider === 'chatgpt' ? openaiApiKey || undefined : anthropicApiKey || undefined,
  });

  // Return the appropriate chat hook based on selected provider
  if (selectedProvider === 'chatgpt' || selectedProvider === 'claude') {
    return aiChat;
  }

  return ollamaChat;
}
