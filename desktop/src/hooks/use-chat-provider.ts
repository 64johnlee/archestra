import { useChatStore } from '@/stores/chat-store';

import { useAIChat } from './use-ai-chat';
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
    model: selectedProvider === 'chatgpt' ? 'gpt-4o' : 'claude-3-5-sonnet-20241022',
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
