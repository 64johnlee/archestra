import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import CloudProviderModel, {
  CloudProviderWithConfigSchema,
  SupportedCloudProviderModelSchema,
  SupportedCloudProviderSchema,
} from '@backend/models/cloudProvider';

/**
 * Register our zod schemas into the global registry, such that they get output as components in the openapi spec
 * https://github.com/turkerdev/fastify-type-provider-zod?tab=readme-ov-file#how-to-create-refs-to-the-schemas
 */
z.globalRegistry.add(CloudProviderWithConfigSchema, { id: 'CloudProviderWithConfig' });
z.globalRegistry.add(SupportedCloudProviderSchema, { id: 'SupportedCloudProviders' });
z.globalRegistry.add(SupportedCloudProviderModelSchema, { id: 'SupportedCloudProviderModel' });

const cloudProviderRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/api/cloud-providers/available', {
    schema: {
      operationId: 'getAvailableCloudProviders',
      description: 'Get all available cloud providers with configuration status',
      tags: ['Cloud Providers'],
      response: {
        200: z.array(CloudProviderWithConfigSchema),
      },
    },
    handler: async (_request, reply) => {
      const providers = await CloudProviderModel.getAllProvidersWithConfig();
      return reply.send(providers);
    },
  });

  fastify.post(
    '/api/cloud-providers',
    {
      schema: {
        operationId: 'configureCloudProvider',
        description: 'Configure a cloud provider with API key',
        tags: ['Cloud Providers'],
        body: z.object({
          type: SupportedCloudProviderSchema,
          apiKey: z.string(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async ({ body: { type, apiKey } }, reply) => {
      await CloudProviderModel.upsert(type, apiKey);
      return reply.send({ success: true });
    }
  );

  fastify.delete(
    '/api/cloud-providers/:type',
    {
      schema: {
        operationId: 'deleteCloudProvider',
        description: 'Remove cloud provider configuration',
        tags: ['Cloud Providers'],
        params: z.object({
          type: SupportedCloudProviderSchema,
        }),
        response: {
          200: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    async ({ params: { type } }, reply) => {
      await CloudProviderModel.delete(type);
      return reply.send({ success: true });
    }
  );

  fastify.get(
    '/api/cloud-providers/models',
    {
      schema: {
        operationId: 'getCloudProviderModels',
        description: 'Get all available models from configured providers',
        tags: ['Cloud Providers'],
        response: {
          200: z.array(SupportedCloudProviderModelSchema),
        },
      },
    },
    async (_request, reply) => {
      const models = await CloudProviderModel.getAvailableModels();
      return reply.send(models);
    }
  );
};

export default cloudProviderRoutes;
