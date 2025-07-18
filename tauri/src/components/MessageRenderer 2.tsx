import { useState } from "react";

interface MessageRendererProps {
  content: string;
  role: string;
  isStreaming?: boolean;
}

interface ParsedContent {
  text: string;
  thinkBlocks: { id: number; content: string }[];
}

function parseThinkBlocks(content: string): ParsedContent {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const thinkBlocks: { id: number; content: string }[] = [];
  let id = 0;
  
  // Extract think blocks
  let match;
  while ((match = thinkRegex.exec(content)) !== null) {
    thinkBlocks.push({
      id: id++,
      content: match[1].trim()
    });
  }
  
  // Remove think blocks from main text
  const cleanText = content.replace(thinkRegex, '').trim();
  
  return { text: cleanText, thinkBlocks };
}

export default function MessageRenderer({ content, role, isStreaming }: MessageRendererProps) {
  const [expandedThinks, setExpandedThinks] = useState<Set<number>>(new Set());
  
  const toggleThink = (id: number) => {
    const newExpanded = new Set(expandedThinks);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedThinks(newExpanded);
  };

  if (role !== "assistant") {
    return <div className="message-content">{content}</div>;
  }

  const parsed = parseThinkBlocks(content);
  
  return (
    <div className="message-content">
      {/* Render think blocks */}
      {parsed.thinkBlocks.map((block) => (
        <div key={block.id} className="think-block">
          <button
            className="think-toggle"
            onClick={() => toggleThink(block.id)}
          >
            <span className="think-icon">🤔</span>
            <span className="think-label">
              {expandedThinks.has(block.id) ? "Hide reasoning" : "Show reasoning"}
            </span>
            <span className="think-arrow">
              {expandedThinks.has(block.id) ? "▼" : "▶"}
            </span>
          </button>
          {expandedThinks.has(block.id) && (
            <div className="think-content">
              <div className="think-header">Model's internal reasoning:</div>
              <div className="think-text">{block.content}</div>
            </div>
          )}
        </div>
      ))}
      
      {/* Render main response */}
      {parsed.text && (
        <div className="response-text">
          {parsed.text}
          {isStreaming && <span className="streaming-cursor">|</span>}
        </div>
      )}
      
      {/* Show cursor if streaming and no text yet */}
      {isStreaming && !parsed.text && !parsed.thinkBlocks.length && (
        <span className="streaming-cursor">|</span>
      )}
    </div>
  );
} 