import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { useCallback, useRef, useState } from 'react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface UseChatGPTChatOptions {
  model: string;
  sessionId?: string;
  initialMessages?: Message[];
  apiKey?: string;
}

export function useChatGPTChat({ model, sessionId, initialMessages = [], apiKey }: UseChatGPTChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [status, setStatus] = useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: Message | string) => {
      const userMessage: Message =
        typeof message === 'string'
          ? { id: Date.now().toString(), role: 'user', content: message }
          : { ...message, id: message.id || Date.now().toString() };

      // Add user message to state
      setMessages((prev) => [...prev, userMessage]);
      setStatus('submitted');

      try {
        // https://ai-sdk.dev/docs/getting-started/nodejs - example
        if (!apiKey) {
          throw new Error('OpenAI API key is required. Please set your API key in the settings.');
        }

        abortControllerRef.current = new AbortController();

        // Create OpenAI provider with direct API access
        const openai = createOpenAI({
          apiKey: apiKey,
          baseURL: 'https://api.openai.com/v1', // Direct to OpenAI API
        });

        // Context to send to the model
        const allMessages = [...messages, userMessage];

        // Create streaming response
        setStatus('streaming');
        const result = streamText({
          model: openai(model || 'gpt-4o'),
          messages: allMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          abortSignal: abortControllerRef.current.signal,
        });
        console.log(result.toUIMessageStreamResponse());

        // Create assistant message placeholder
        const assistantMessageId = `${Date.now()}-assistant`;
        let assistantContent = '';

        // Process the stream
        for await (const chunk of result.textStream) {
          assistantContent += chunk;
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];

            // Update existing assistant message if it's the current streaming message,
            // otherwise create a new assistant message
            if (lastMessage?.role === 'assistant' && lastMessage.id === assistantMessageId) {
              lastMessage.content = assistantContent;
            } else {
              newMessages.push({
                id: assistantMessageId,
                role: 'assistant',
                content: assistantContent,
              });
            }

            return newMessages;
          });
        }

        setStatus('ready');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Chat error:', error);
          setStatus('error');
        }
      }
    },
    [messages, model, sessionId, apiKey]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus('ready');
    }
  }, []);

  return {
    messages,
    sendMessage,
    status,
    stop,
    isLoading: status === 'submitted' || status === 'streaming',
  };
}
