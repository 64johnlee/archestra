import { UIMessage } from 'ai';

interface OtherMessageProps {
  message: UIMessage;
}

export default function OtherMessage({ message }: OtherMessageProps) {
  // Extract text content from parts
  const textContent = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { text: string }).text)
    .join('');

  return <div className="text-sm whitespace-pre-wrap">{textContent}</div>;
}
