import React from 'react';
import { TestChat } from './TestChat';

export function App() {
  return (
    <div>
      <TestChat serverPort={3456} />
    </div>
  );
}