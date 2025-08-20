
import { InferSelectModel, relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";

// Web Push Subscriptions table
export const webPushSubscriptions = sqliteTable('web_push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dhKey: text('p256dh_key').notNull(),
  authKey: text('auth_key').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Define relationships
export const webPushSubscriptionsRelations = relations(webPushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [webPushSubscriptions.userId],
    references: [users.id],
  }),
}));

// Export type
export type WebPushSubscription = InferSelectModel<typeof webPushSubscriptions>;
