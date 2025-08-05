import type { McpServerToolsMap, ToolWithMcpServerName } from '@ui/types';

export const getToolsGroupedByServer = (tools: ToolWithMcpServerName[]) => {
  return tools.reduce((acc, tool) => {
    acc[tool.serverName] = [...(acc[tool.serverName] || []), tool];
    return acc;
  }, {} as McpServerToolsMap);
};
