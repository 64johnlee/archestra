import { sql } from 'drizzle-orm';
import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { chatsTable } from './chat';

export const messagesTable = sqliteTable('messages', {
  id: int().primaryKey({ autoIncrement: true }),
  chatId: int('chat_id')
    .notNull()
    .references(() => chatsTable.id, { onDelete: 'cascade' }),
  role: text().notNull(), // 'user' | 'assistant' | 'system'
  content: text().notNull(), // JSON stringified UIMessage
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
});