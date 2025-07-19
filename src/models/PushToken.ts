
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";

// Push Tokens table for device token management
export const pushTokens = sqliteTable('push_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  pushToken: text('push_token').notNull().unique(),
  deviceId: text('device_id').notNull().unique(),
  platform: text('platform').notNull(), // 'ios', 'android', 'web'
  deviceInfo: text('device_info'), // JSON string with device details
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastUsed: integer('last_used', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Define relationships
export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id],
  }),
}));

// Export type
export type PushToken = InferSelectModel<typeof pushTokens>;
