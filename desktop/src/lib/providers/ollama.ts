// This file is kept for potential future use with Vercel AI SDK
// Currently using custom useOllamaChat hook instead
import { createOllama } from 'ollama-ai-provider';

export const ollama = createOllama({
  baseURL: 'http://localhost:54587/llm/ollama/api',
});
