import { render } from '@testing-library/react';

import { McpServerStatus } from '@ui/types';

import ArchestraMcpServer from '.';

describe('ArchestraMcpServer', () => {
  it('renders the ArchestraMcpServer component', () => {
    const mockArchestraMcpServer = {
      id: 'archestra',
      name: 'Archestra.ai',
      createdAt: new Date().toISOString(),
      serverConfig: {
        command: '',
        args: [],
        env: {},
      },
      url: 'http://localhost:54587/mcp',
      client: null,
      tools: [],
      status: McpServerStatus.Connected,
      error: null,
      userConfigValues: {},
    };
    render(<ArchestraMcpServer archestraMcpServer={mockArchestraMcpServer} />);
  });
});
