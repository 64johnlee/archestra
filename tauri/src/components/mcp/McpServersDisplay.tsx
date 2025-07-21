import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { 
  Server, 
  Wrench, 
  ChevronDown, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  RefreshCw 
} from "lucide-react";
import type { MCPTool, MCPServer } from "../../types/mcp";

interface McpServersDisplayProps {
  mcpServers: MCPServer[];
  mcpTools: MCPTool[];
  isLoading: boolean;
  onRefresh: () => void;
}

export default function McpServersDisplay({ 
  mcpServers, 
  mcpTools, 
  isLoading, 
  onRefresh 
}: McpServersDisplayProps) {
  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: MCPServer['status']) => {
    switch (status) {
      case 'connecting':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500">Connecting</Badge>;
      case 'connected':
        return <Badge variant="outline" className="text-green-600 border-green-500">Connected</Badge>;
      case 'error':
        return <Badge variant="outline" className="text-red-600 border-red-500">Error</Badge>;
    }
  };

  const getToolsByServer = (serverName: string) => {
    return mcpTools.filter(tool => tool.serverName === serverName);
  };

  return (
    <Collapsible defaultOpen>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-0 h-auto"
            >
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                MCP Servers & Tools
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  disabled={isLoading}
                  className="h-8 px-2"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <ChevronDown className="h-4 w-4" />
              </div>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {mcpServers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No MCP servers configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mcpServers.map((server) => {
                  const serverTools = getToolsByServer(server.name);
                  
                  return (
                    <Card key={server.name} className="border-l-4 border-l-blue-500/20">
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          {/* Server Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(server.status)}
                              <h4 className="font-medium">{server.name}</h4>
                              {getStatusBadge(server.status)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {serverTools.length} tool{serverTools.length !== 1 ? 's' : ''}
                            </div>
                          </div>

                          {/* Server URL */}
                          <div className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                            {server.url}
                          </div>

                          {/* Error Message */}
                          {server.status === 'error' && server.error && (
                            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded border border-red-200 dark:border-red-800">
                              Error: {server.error}
                            </div>
                          )}

                          {/* Tools List */}
                          {serverTools.length > 0 && (
                            <div className="space-y-2">
                              <h5 className="text-sm font-medium flex items-center gap-1">
                                <Wrench className="h-3 w-3" />
                                Available Tools
                              </h5>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {serverTools.map((toolItem) => (
                                  <div
                                    key={`${toolItem.serverName}-${toolItem.tool.name}`}
                                    className="p-2 border rounded-md bg-background/50 hover:bg-background transition-colors"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="min-w-0 flex-1">
                                        <div className="font-mono text-sm font-medium truncate">
                                          {toolItem.tool.name}
                                        </div>
                                        {toolItem.tool.description && (
                                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {toolItem.tool.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No Tools Message */}
                          {server.status === 'connected' && serverTools.length === 0 && (
                            <div className="text-sm text-muted-foreground italic">
                              No tools available from this server
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            {mcpServers.length > 0 && (
              <div className="border-t pt-3 mt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Total: {mcpServers.length} server{mcpServers.length !== 1 ? 's' : ''}, {mcpTools.length} tool{mcpTools.length !== 1 ? 's' : ''}
                  </span>
                  <span>
                    {mcpServers.filter(s => s.status === 'connected').length} connected
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}