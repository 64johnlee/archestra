import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChatStore } from '@/stores/chat-store';

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const { selectedProvider, openaiApiKey, anthropicApiKey, setOpenAIApiKey, setAnthropicApiKey } = useChatStore();
  const currentApiKey = selectedProvider === 'chatgpt' ? openaiApiKey : anthropicApiKey;
  const [apiKey, setApiKey] = useState(currentApiKey || '');

  const handleSave = () => {
    if (selectedProvider === 'chatgpt') {
      setOpenAIApiKey(apiKey);
    } else if (selectedProvider === 'claude') {
      setAnthropicApiKey(apiKey);
    }
    onOpenChange(false);
  };

  const providerName = selectedProvider === 'chatgpt' ? 'OpenAI' : 'Anthropic';
  const placeholder = selectedProvider === 'chatgpt' ? 'sk-...' : 'sk-ant-...';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{providerName} API Key</DialogTitle>
          <DialogDescription>
            Enter your {providerName} API key to use {selectedProvider === 'chatgpt' ? 'ChatGPT' : 'Claude'}. Your key
            will be stored locally and sent directly to {providerName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="api-key" className="text-right">
              API Key
            </Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={placeholder}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
