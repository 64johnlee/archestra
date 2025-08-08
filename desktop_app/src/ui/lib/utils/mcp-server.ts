import type { McpServerToolsMap, ToolWithMcpServerInfo } from '@ui/types';

export const getToolsGroupedByServer = (tools: ToolWithMcpServerInfo[]) => {
  return tools.reduce((acc, tool) => {
    acc[tool.server.id] = [...(acc[tool.server.id] || []), tool];
    return acc;
  }, {} as McpServerToolsMap);
};
