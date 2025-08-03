import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'openapi.json',
  output: {
    path: 'src/ui/lib/clients/api/gen',
    clean: true,
    format: 'prettier',
    indexFile: true,
    tsConfigPath: 'tsconfig.json',
  },
  /**
   * See here for why we need this, basically to configure the baseUrl of the API
   * https://heyapi.dev/openapi-ts/clients/fetch#runtime-api
   */
  plugins: [
    {
      name: '@hey-api/client-fetch',
      runtimeConfigPath: './src/backend/lib/clients/libpod/client.ts',
    },
  ],
});
