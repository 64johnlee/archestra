import { useCallback, useRef, useState } from 'react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface UseOllamaChatOptions {
  model: string;
  sessionId?: string;
  initialMessages?: Message[];
}

export function useOllamaChat({ model, sessionId, initialMessages = [] }: UseOllamaChatOptions) {
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
        abortControllerRef.current = new AbortController();

        const response = await fetch(`http://localhost:54587/llm/ollama/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [...messages, userMessage],
            session_id: sessionId,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setStatus('streaming');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    assistantMessage += data.message.content;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];

                      if (lastMessage?.role === 'assistant') {
                        lastMessage.content = assistantMessage;
                      } else {
                        newMessages.push({
                          id: `${Date.now()}-assistant`,
                          role: 'assistant',
                          content: assistantMessage,
                        });
                      }

                      return newMessages;
                    });
                  }
                } catch (e) {
                  console.error('Failed to parse line:', line, e);
                }
              }
            }
          }
        }

        setStatus('ready');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Chat error:', error);
          setStatus('error');
        }
      }
    },
    [messages, model, sessionId]
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
