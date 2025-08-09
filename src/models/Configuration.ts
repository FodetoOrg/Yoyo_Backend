
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Configuration table for storing app-level settings
export const configurations = sqliteTable('configurations', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(), // e.g., 'app_maintenance', 'panel_maintenance', etc.
  value: text('value').notNull(), // JSON string for complex values
  type: text('type').notNull(), // 'boolean', 'string', 'number', 'json', 'array'
  description: text('description'),
  category: text('category').notNull(), // 'app', 'payment', 'notification', 'ui'
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export type Configuration = typeof configurations.$inferSelect;
export type ConfigurationInsert = typeof configurations.$inferInsert;
