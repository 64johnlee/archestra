import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { openai } from '@ai-sdk/openai';
import { type UIMessage, convertToModelMessages, streamText } from 'ai';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createOllama } from 'ollama-ai-provider';

interface StreamRequestBody {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  messages: Array<any>;
  apiKey?: string;
  sessionId?: string;
}

export default async function llmRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: StreamRequestBody }>(
    '/api/llm/stream',
    async (request: FastifyRequest<{ Body: StreamRequestBody }>, reply: FastifyReply) => {
      const { messages } = request.body;

      console.log('LLM stream request:', request.body);
      console.log(convertToModelMessages(messages));
      let messages2 = convertToModelMessages(messages);
      console.log(messages2[0].content);
      try {
        // Create the stream
        const result = streamText({
          model: openai('gpt-4o'),
          messages: messages2,
        });

        // Here is how to read the response
        // const reader = result.textStream.getReader();
        // while (true) {
        //   const { done, value } = await reader.read();
        //   if (done) {
        //     break;
        //   }
        //   console.log(value);
        // }

        return reply.send(result.toUIMessageStreamResponse());
      } catch (error) {
        fastify.log.error('LLM streaming error:', error);
        return reply.code(500).send({
          error: 'Failed to stream response',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
