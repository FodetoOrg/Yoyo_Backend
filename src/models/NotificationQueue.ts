import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";

// Notification Queue table (for reliable notification delivery)
export const notificationQueue = sqliteTable('notification_queue', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // 'push', 'email', 'sms', 'in_app'
  priority: integer('priority').notNull().default(5), // 1 = highest, 10 = lowest
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data'), // JSON string for additional data
  
  // Delivery channels
  pushToken: text('push_token'), // FCM token for push notifications
  email: text('email'), // Email address
  phone: text('phone'), // Phone number for SMS
  
  // Status tracking
  status: text('status').notNull().default('pending'), // pending, processing, sent, failed, cancelled
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  
  // Scheduling
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  processAfter: integer('process_after', { mode: 'timestamp' }).notNull().default(new Date()),
  
  // Results
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  failedAt: integer('failed_at', { mode: 'timestamp' }),
  error: text('error'),
  response: text('response'), // JSON string for provider response
  
  // Metadata
  source: text('source'), // 'booking', 'payment', 'admin', etc.
  sourceId: text('source_id'), // ID of the source entity
  batchId: text('batch_id'), // For batch processing
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Notification Templates table
export const notificationTemplates = sqliteTable('notification_templates', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(), // 'booking_confirmed', 'payment_success', etc.
  name: text('name').notNull(),
  description: text('description'),
  
  // Template content
  pushTitle: text('push_title'),
  pushBody: text('push_body'),
  emailSubject: text('email_subject'),
  emailHtml: text('email_html'),
  emailText: text('email_text'),
  smsText: text('sms_text'),
  inAppTitle: text('in_app_title'),
  inAppMessage: text('in_app_message'),
  
  // Settings
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(5),
  channels: text('channels').notNull().default('["in_app"]'), // JSON array
  
  // Variables (for template processing)
  variables: text('variables'), // JSON array of variable names
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// User Notification Preferences
export const userNotificationPreferences = sqliteTable('user_notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  
  // Channel preferences
  pushEnabled: integer('push_enabled', { mode: 'boolean' }).notNull().default(true),
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(true),
  smsEnabled: integer('sms_enabled', { mode: 'boolean' }).notNull().default(false),
  
  // Category preferences
  bookingNotifications: integer('booking_notifications', { mode: 'boolean' }).notNull().default(true),
  paymentNotifications: integer('payment_notifications', { mode: 'boolean' }).notNull().default(true),
  promotionalNotifications: integer('promotional_notifications', { mode: 'boolean' }).notNull().default(false),
  systemNotifications: integer('system_notifications', { mode: 'boolean' }).notNull().default(true),
  
  // Timing preferences
  quietHoursStart: text('quiet_hours_start').default('22:00'),
  quietHoursEnd: text('quiet_hours_end').default('08:00'),
  timezone: text('timezone').default('Asia/Kolkata'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const notificationQueueRelations = relations(notificationQueue, ({ one }) => ({
  user: one(users, {
    fields: [notificationQueue.userId],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

// Export types
export type NotificationQueue = InferSelectModel<typeof notificationQueue>;
export type NotificationTemplate = InferSelectModel<typeof notificationTemplates>;
export type UserNotificationPreferences = InferSelectModel<typeof userNotificationPreferences>;