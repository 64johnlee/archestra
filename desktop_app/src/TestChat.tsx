import React from 'react';
import { useChat } from '@ai-sdk/react';

export function TestChat({ serverPort }: { serverPort: number }) {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: `/api/chat`
  });
  const [provider, setProvider] = React.useState('openai');
  
  return (
    <div className="w-full max-w-2xl mx-auto p-4 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      <div className="mb-4">
        <select 
          value={provider} 
          onChange={(e) => setProvider(e.target.value)}
          className="w-full p-2 border rounded bg-white dark:bg-gray-800 text-black dark:text-white"
        >
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama</option>
        </select>
      </div>
      
      <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={`p-3 rounded ${
            m.role === 'user' 
              ? 'bg-blue-100 dark:bg-blue-900 ml-auto max-w-[80%]' 
              : 'bg-gray-100 dark:bg-gray-800 mr-auto max-w-[80%]'
          }`}>
            <div className="font-semibold text-black dark:text-white">{m.role}:</div>
            <div className="text-black dark:text-white">{m.content}</div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Say something..."
          className="flex-1 p-2 border rounded bg-white dark:bg-gray-800 text-black dark:text-white"
        />
        <button 
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
}