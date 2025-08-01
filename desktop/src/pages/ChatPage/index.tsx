import { useChat } from '@ai-sdk/react';
import { useCallback, useEffect } from 'react';

import { useChatStore } from '@/stores/chat-store';
import { useOllamaStore } from '@/stores/ollama-store';

import ChatHistory from './ChatHistory';
import ChatInput from './ChatInput';
import SystemPrompt from './SystemPrompt';

interface ChatPageProps {}

export default function ChatPage(_props: ChatPageProps) {
  const { getCurrentChat, createNewChat } = useChatStore();
  const { selectedModel } = useOllamaStore();
  const currentChat = getCurrentChat();

  // Ensure we have a chat session
  useEffect(() => {
    if (!currentChat) {
      createNewChat();
    }
  }, [currentChat, createNewChat]);

  // Simple approach: use fetch to send messages
  const { messages, setMessages, stop } = useChat({
    initialMessages: currentChat?.messages || [],
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!currentChat || !selectedModel) return;

      // Add user message
      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content,
      };
      setMessages([...messages, userMessage]);

      // Add placeholder assistant message
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: '',
      };
      setMessages([...messages, userMessage, assistantMessage]);

      try {
        // Call the Ollama API directly
        const response = await fetch('http://localhost:54587/llm/ollama/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: currentChat.session_id,
            model: selectedModel,
            messages: [...messages, userMessage],
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        let accumulatedContent = '';
        const decoder = new TextDecoder();

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
                  accumulatedContent += data.message.content;
                  setMessages((msgs) =>
                    msgs.map((msg) => (msg.id === assistantMessage.id ? { ...msg, content: accumulatedContent } : msg))
                  );
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    },
    [currentChat, selectedModel, messages, setMessages]
  );

  const isLoading = false; // You could track this with state if needed

  return (
    <div className="flex flex-col h-full gap-2 max-w-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden max-w-full">
        <ChatHistory messages={messages as any} />
      </div>
      <SystemPrompt />
      <div className="flex-shrink-0">
        <ChatInput onSendMessage={sendMessage} isLoading={isLoading} stop={stop} />
      </div>
    </div>
  );
}
