import { UIMessage } from 'ai';

import { AIResponse } from '@ui/components/kibo/ai-response';

interface AssistantMessageProps {
  message: UIMessage;
}

export default function AssistantMessage({ message }: AssistantMessageProps) {
  // Extract text content from parts
  const textContent = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { text: string }).text)
    .join('');

  return (
    <div className="relative">
      <AIResponse>{textContent}</AIResponse>
    </div>
  );
}
