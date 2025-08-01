import { Settings } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type LLMProvider, useChatStore } from '@/stores/chat-store';

import { ApiKeyDialog } from './ApiKeyDialog';

export function ProviderSelector() {
  const { selectedProvider, setSelectedProvider, openaiApiKey, anthropicApiKey } = useChatStore();
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);

  const handleProviderChange = (value: LLMProvider) => {
    setSelectedProvider(value);
    if (value === 'chatgpt' && !openaiApiKey) {
      setShowApiKeyDialog(true);
    } else if (value === 'claude' && !anthropicApiKey) {
      setShowApiKeyDialog(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Provider:</span>
        <Select value={selectedProvider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ollama">Ollama</SelectItem>
            <SelectItem value="chatgpt">ChatGPT</SelectItem>
            <SelectItem value="claude">Claude</SelectItem>
          </SelectContent>
        </Select>
        {(selectedProvider === 'chatgpt' || selectedProvider === 'claude') && (
          <Button variant="ghost" size="icon" onClick={() => setShowApiKeyDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ApiKeyDialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog} />
    </>
  );
}
