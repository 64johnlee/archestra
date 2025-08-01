import { createOllama } from 'ollama-ai-provider';

export const ollama = createOllama({
  baseURL: 'http://localhost:54587/llm/ollama/api',
});
