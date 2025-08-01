'use client';

import { FileText } from 'lucide-react';
import React, { useCallback } from 'react';

import ToolPill from '@/components/ToolPill';
import {
  AIInput,
  AIInputButton,
  AIInputModelSelect,
  AIInputModelSelectContent,
  AIInputModelSelectItem,
  AIInputModelSelectTrigger,
  AIInputModelSelectValue,
  AIInputSubmit,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
} from '@/components/kibo/ai-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AI_PROVIDERS } from '@/hooks/use-ai-chat';
import { cn } from '@/lib/utils/tailwind';
import { useChatStore } from '@/stores/chat-store';
import { useDeveloperModeStore } from '@/stores/developer-mode-store';
import { useMCPServersStore } from '@/stores/mcp-servers-store';
import { useOllamaStore } from '@/stores/ollama-store';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop: () => void;
}

export default function ChatInput({ input, handleInputChange, handleSubmit, isLoading, stop }: ChatInputProps) {
  const { selectedTools } = useMCPServersStore();
  const { isDeveloperMode, toggleDeveloperMode } = useDeveloperModeStore();
  const { selectedProvider, selectedAIModel, setSelectedAIModel } = useChatStore();
  const { installedModels, loadingInstalledModels, loadingInstalledModelsError, selectedModel, setSelectedModel } =
    useOllamaStore();

  // Determine which models to show based on provider
  const isOllama = selectedProvider === 'ollama';
  const aiProviderKey = selectedProvider === 'chatgpt' ? 'openai' : selectedProvider === 'claude' ? 'anthropic' : null;
  const aiProviderModels = aiProviderKey ? Object.entries(AI_PROVIDERS[aiProviderKey].models) : [];

  // Use appropriate model and setter based on provider
  const currentModel = isOllama ? selectedModel : selectedAIModel || '';
  const handleModelChange = isOllama ? setSelectedModel : setSelectedAIModel;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <TooltipProvider>
      <AIInput onSubmit={handleSubmit} className="bg-inherit">
        <div className={cn('flex flex-wrap gap-2 p-3 pb-0')}>
          {selectedTools.map((tool, index) => (
            <ToolPill key={`${tool.serverName}-${tool.toolName}-${index}`} tool={tool} />
          ))}
        </div>
        <AIInputTextarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="What would you like to know?"
          disabled={isOllama ? !selectedModel : false}
          minHeight={48}
          maxHeight={164}
        />
        <AIInputToolbar>
          <AIInputTools>
            <AIInputModelSelect
              value={currentModel}
              onValueChange={handleModelChange}
              disabled={isOllama && (loadingInstalledModels || !!loadingInstalledModelsError)}
            >
              <AIInputModelSelectTrigger>
                <AIInputModelSelectValue
                  placeholder={
                    isOllama
                      ? loadingInstalledModels
                        ? 'Loading models...'
                        : loadingInstalledModelsError
                          ? 'Error loading models'
                          : installedModels.length === 0
                            ? 'No models found'
                            : 'Select a model'
                      : 'Select a model'
                  }
                />
              </AIInputModelSelectTrigger>
              <AIInputModelSelectContent>
                {isOllama
                  ? installedModels.map((model) => (
                      <AIInputModelSelectItem key={model.name} value={model.name}>
                        {model.name}
                      </AIInputModelSelectItem>
                    ))
                  : aiProviderModels.map(([modelKey, modelConfig]) => (
                      <AIInputModelSelectItem key={modelKey} value={modelKey}>
                        {modelConfig.displayName}
                      </AIInputModelSelectItem>
                    ))}
              </AIInputModelSelectContent>
            </AIInputModelSelect>
            <Tooltip>
              <TooltipTrigger asChild>
                <AIInputButton onClick={toggleDeveloperMode} className={isDeveloperMode ? 'bg-primary/20' : ''}>
                  <FileText size={16} />
                </AIInputButton>
              </TooltipTrigger>
              <TooltipContent>
                <span>Toggle system prompt</span>
              </TooltipContent>
            </Tooltip>
          </AIInputTools>
          <AIInputSubmit onClick={isLoading ? stop : undefined} disabled={!input.trim() && !isLoading} />
        </AIInputToolbar>
      </AIInput>
    </TooltipProvider>
  );
}
