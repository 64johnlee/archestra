import React from 'react';
import { TestChat } from './TestChat';
import { Button } from '../components/ui/button';

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="mb-8">
        <Button>Click me</Button>
      </div>
      <TestChat serverPort={3456} />
    </div>
  );
}