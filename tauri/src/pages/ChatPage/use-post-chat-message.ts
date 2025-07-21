import { useState, useCallback, useEffect } from "react";
import { Ollama, Message as OllamaMessage } from "ollama/browser";
import { IChatMessage, MCPTool, ToolCallInfo } from "./types";
import { parseThinkingContent, markMessageAsCancelled } from "./utils";
import { useConnectorCatalog } from "../../hooks/use-connector-catalog";
import { useOllamaClient } from "../../hooks/llm-providers/ollama/use-ollama-client";

interface IArgs {
  ollamaClient: Ollama | null;
  mcpTools: MCPTool[];
  executeTool?: (serverName: string, toolName: string, args: any) => Promise<any>;
}

// TODO: remove these constants
export const CHAT_SCROLL_AREA_ID = "chat-scroll-area";
export const CHAT_SCROLL_AREA_SELECTOR = `#${CHAT_SCROLL_AREA_ID} [data-radix-scroll-area-viewport]`;

export function usePostChatMessage({ ollamaClient, mcpTools, executeTool }: IArgs) {
  const { ollamaClient: _ollamaClient, ollamaPort } = useOllamaClient()
  const { installedMcpServers } = useConnectorCatalog();
  const [chatHistory, setChatHistory] = useState<IChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  );
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Scroll to bottom when new messages are added or content changes
  const scrollToBottom = useCallback(() => {
    const scrollArea = document.querySelector(CHAT_SCROLL_AREA_SELECTOR);
    if (scrollArea) {
      scrollArea.scrollTo({
        top: scrollArea.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  // Trigger scroll after message changes
  const triggerScroll = useCallback(() => {
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [scrollToBottom]);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
  }, []);

  const cancelStreaming = useCallback(async () => {
    try {
      console.log("🛑 Cancelling streaming");

      if (abortController) {
        abortController.abort();
        setAbortController(null);
        console.log("✅ Streaming cancelled");
      }

      // Reset state immediately
      setIsChatLoading(false);
      setStreamingMessageId(null);

      // Clear any stuck execution states from the currently streaming message
      setChatHistory((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessageId ||
          msg.isStreaming ||
          msg.isToolExecuting
            ? {
                ...msg,
                isStreaming: false,
                isToolExecuting: false,
                isThinkingStreaming: false,
              }
            : msg,
        ),
      );
    } catch (error) {
      console.error("Failed to cancel streaming:", error);
      // Still reset state even if cancellation failed
      setIsChatLoading(false);
      setStreamingMessageId(null);

      setChatHistory((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessageId ||
          msg.isStreaming ||
          msg.isToolExecuting
            ? markMessageAsCancelled(msg)
            : msg,
        ),
      );
    }
  }, [abortController, streamingMessageId]);

  // Helper function to update streaming message content
  const updateStreamingMessage = useCallback((messageId: string, content: string) => {
    const parsed = parseThinkingContent(content);
    setChatHistory((prev) =>
      prev.map((msg) =>
        msg.id === messageId && msg.isStreaming
          ? {
              ...msg,
              content: parsed.response,
              thinkingContent: parsed.thinking,
              isThinkingStreaming: parsed.isThinkingStreaming,
            }
          : msg,
      ),
    );
    triggerScroll();
  }, [triggerScroll]);

  const sendChatMessage = useCallback(
    async (message: string, model: string) => {
      if (!message.trim() || !ollamaClient) return;

      setIsChatLoading(true);

      const userMsgId = Date.now().toString();
      const userMessage = {
        id: userMsgId,
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userMessage]);

      const aiMsgId = (Date.now() + 1).toString();
      const aiMessage = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        thinkingContent: "",
        timestamp: new Date(),
        isStreaming: true,
        isThinkingStreaming: false,
      };
      setChatHistory((prev) => [...prev, aiMessage]);
      setStreamingMessageId(aiMsgId);
      triggerScroll();

      try {
        // Check if the model supports tool calling
        const modelSupportsTools =
          model &&
          (model.includes("functionary") ||
            model.includes("mistral") ||
            model.includes("command") ||
            (model.includes("qwen") && !model.includes("0.6b")) || // qwen3:0.6b might not support tools
            model.includes("hermes") ||
            model.includes("llama3.1") || // llama3.1 has better tool support than 3.2
            model.includes("llama-3.1") ||
            model.includes("phi") ||
            model.includes("granite"));

        console.log("🔧 Tool calling debug:", {
          mcpToolsCount: installedMcpServers.length,
          modelSupportsTools,
          model,
          willUseMcpTools: installedMcpServers.length > 0 && modelSupportsTools,
        });

        // Add warning if tools are available but model doesn't support them
        if (mcpTools.length > 0 && !modelSupportsTools) {
          const warningMessage = {
            id: (Date.now() + Math.random()).toString(),
            role: "system",
            content: `⚠️ MCP tools are available but ${model} doesn't support tool calling. Consider using functionary-small-v3.2 or another tool-enabled model.`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, warningMessage]);
        }

        // Prepare chat history for Ollama SDK
        const ollamaMessages: OllamaMessage[] = [
          ...chatHistory
            .filter((msg) => msg.role === "user" || msg.role === "assistant")
            .map((msg) => ({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            })),
          { role: "user", content: message },
        ];

        // Convert MCP tools to Ollama tool format
        const tools = mcpTools.length > 0 && modelSupportsTools 
          ? mcpTools.map(mcpTool => ({
              type: 'function' as const,
              function: {
                name: `${mcpTool.serverName}_${mcpTool.tool.name}`,
                description: mcpTool.tool.description || `Tool from ${mcpTool.serverName}`,
                parameters: mcpTool.tool.inputSchema || {
                  type: 'object',
                  properties: {},
                  required: []
                }
              }
            }))
          : undefined;

        console.log("📡 Starting Ollama SDK streaming chat...");
        console.log("🔧 Tools available:", tools?.length || 0, tools?.map(t => t.function.name) || []);
        console.log("🔧 Full tools schema:", JSON.stringify(tools, null, 2));

        const controller = new AbortController();
        setAbortController(controller);

        const response = await ollamaClient.chat({
          model: model,
          messages: ollamaMessages,
          stream: true,
          tools: tools,
          options: {
            temperature: 0.7,
            top_p: 0.95,
            top_k: 40,
            num_predict: 32768,
          },
        });

        let accumulatedContent = "";
        let finalMessage: any = null;

        // Stream the initial response
        for await (const part of response) {
          if (controller.signal.aborted) {
            console.log("Streaming cancelled by user");
            break;
          }

          if (part.message?.content) {
            accumulatedContent += part.message.content;
            updateStreamingMessage(aiMsgId, accumulatedContent);
          }

          if (part.done) {
            finalMessage = part.message;
            console.log("🏁 Final message received:", JSON.stringify(finalMessage, null, 2));
            break;
          }
        }

        // Handle tool calls if present
        console.log("🔍 Checking for tool calls. finalMessage:", !!finalMessage, "tool_calls:", finalMessage?.tool_calls, "executeTool:", !!executeTool);
        if (finalMessage?.tool_calls && executeTool) {
          console.log("🔧 Tool calls received:", finalMessage.tool_calls);
          
          // Mark message as executing tools
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    isToolExecuting: true,
                    content: accumulatedContent,
                  }
                : msg,
            ),
          );

          // Execute tools and collect results
          const toolResults: ToolCallInfo[] = [];
          for (const toolCall of finalMessage.tool_calls) {
            try {
              const functionName = toolCall.function.name;
              const args = typeof toolCall.function.arguments === 'string' 
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;
              
              console.log("🚀 Executing tool:", functionName, "with args:", args);
              console.log("🔍 Available MCP tools:", mcpTools.map(t => `${t.serverName}_${t.tool.name}`));
              
              // Extract server name and tool name
              // Find the matching MCP tool to get the correct server name
              const matchingTool = mcpTools.find(tool => 
                `${tool.serverName}_${tool.tool.name}` === functionName
              );
              
              console.log("🎯 Matching tool found:", matchingTool);
              
              const serverName = matchingTool?.serverName || 'unknown';
              const toolName = matchingTool?.tool.name || functionName;
              
              console.log("🎯 Resolved server name:", serverName, "tool name:", toolName);
              
              // Execute the MCP tool
              const result = await executeTool(serverName, toolName, args);
              const toolResultContent = typeof result === 'string' ? result : JSON.stringify(result);
              
              toolResults.push({
                id: toolCall.id,
                serverName,
                toolName,
                arguments: args,
                result: toolResultContent,
                status: 'completed' as const,
                executionTime: 0,
                startTime: new Date(),
                endTime: new Date(),
              });
              
              // Add tool result to conversation
              ollamaMessages.push(finalMessage);
              ollamaMessages.push({
                role: 'tool',
                content: toolResultContent,
              });
              
            } catch (error) {
              console.error("❌ Tool execution error:", error);
              const errorMsg = error instanceof Error ? error.message : String(error);
              const errorFunctionName = toolCall.function.name;
              
              // Find the matching MCP tool to get the correct server name
              const errorMatchingTool = mcpTools.find(tool => 
                `${tool.serverName}_${tool.tool.name}` === errorFunctionName
              );
              
              const errorServerName = errorMatchingTool?.serverName || 'unknown';
              const errorToolName = errorMatchingTool?.tool.name || errorFunctionName;
                
              toolResults.push({
                id: toolCall.id,
                serverName: errorServerName,
                toolName: errorToolName,
                arguments: typeof toolCall.function.arguments === 'string' 
                  ? JSON.parse(toolCall.function.arguments)
                  : toolCall.function.arguments,
                result: '',
                error: errorMsg,
                status: 'error' as const,
                executionTime: 0,
                startTime: new Date(),
                endTime: new Date(),
              });
            }
          }
          
          // Update message with tool results
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    isToolExecuting: false,
                    toolCalls: toolResults,
                  }
                : msg,
            ),
          );

          // Get final response from model after tool execution
          if (toolResults.some(tr => tr.status === 'completed')) {
            console.log("🔄 Getting final response after tool execution...");
            
            const finalResponse = await ollamaClient.chat({
              model: model,
              messages: ollamaMessages,
              stream: true,
              options: {
                temperature: 0.7,
                top_p: 0.95,
                top_k: 40,
                num_predict: 32768,
              },
            });

            let finalContent = "";
            for await (const part of finalResponse) {
              if (controller.signal.aborted) break;
              
              if (part.message?.content) {
                finalContent += part.message.content;
                updateStreamingMessage(aiMsgId, accumulatedContent + "\n\n" + finalContent);
              }
              
              if (part.done) {
                setChatHistory((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMsgId
                      ? {
                          ...msg,
                          content: accumulatedContent + "\n\n" + finalContent,
                          isStreaming: false,
                          isThinkingStreaming: false,
                        }
                      : msg,
                  ),
                );
                break;
              }
            }
          }
        } else {
          // No tool calls, just finalize the message
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    isStreaming: false,
                    isThinkingStreaming: false,
                  }
                : msg,
            ),
          );
        }

        setStreamingMessageId(null);
        setAbortController(null);
      } catch (error: any) {
        console.error("Chat error:", error);

        // Handle abort specifically
        if (error.name === "AbortError" || abortController?.signal.aborted) {
          console.log("Streaming cancelled by user");
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? markMessageAsCancelled(msg) : msg,
            ),
          );
        } else {
          const errorMsg =
            error instanceof Error
              ? error.message
              : "An unknown error occurred";
          setChatHistory((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId
                ? {
                    ...msg,
                    content: `Error: ${errorMsg}`,
                    isStreaming: false,
                    isThinkingStreaming: false,
                  }
                : msg,
            ),
          );
        }
        setStreamingMessageId(null);
        setAbortController(null);
      }

      setIsChatLoading(false);
    },
    [ollamaPort, installedMcpServers, ollamaClient, mcpTools, chatHistory, updateStreamingMessage, triggerScroll, executeTool],
  );

  const isStreaming = streamingMessageId !== null;

  return {
    chatHistory,
    isChatLoading,
    isStreaming,
    sendChatMessage,
    clearChatHistory,
    cancelStreaming,
  };
}
