import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { bookings } from "./Booking";
import { payments } from "./Payment";

// Payment Orders table (for Razorpay orders)
export const paymentOrders = sqliteTable('payment_orders', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  razorpayOrderId: text('razorpay_order_id').notNull().unique(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('created'), // created, attempted, paid, failed, cancelled
  receipt: text('receipt').notNull(),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Payment Webhooks table (for tracking webhook events)
export const paymentWebhooks = sqliteTable('payment_webhooks', {
  id: text('id').primaryKey(),
  razorpayEventId: text('razorpay_event_id').notNull().unique(),
  event: text('event').notNull(), // payment.captured, payment.failed, etc.
  paymentId: text('payment_id'),
  orderId: text('order_id'),
  signature: text('signature').notNull(),
  payload: text('payload').notNull(), // JSON string
  processed: integer('processed', { mode: 'boolean' }).notNull().default(false),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  error: text('error'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Admin Payments table (for hotel payments and refunds)
export const adminPayments = sqliteTable('admin_payments', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'hotel_payment', 'user_refund'
  fromUserId: text('from_user_id').references(() => users.id), // Super admin
  toUserId: text('to_user_id').references(() => users.id), // Hotel admin or user
  hotelId: text('hotel_id'),
  bookingId: text('booking_id').references(() => bookings.id),
  revenueRecordId: text('revenue_record_id'),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  method: text('method').notNull(), // 'bank_transfer', 'upi', 'razorpay_payout'
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  reference: text('reference'), // Bank reference or transaction ID
  reason: text('reason'),
  metadata: text('metadata'), // JSON string for additional data
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const paymentOrdersRelations = relations(paymentOrders, ({ one, many }) => ({
  booking: one(bookings, {
    fields: [paymentOrders.bookingId],
    references: [bookings.id],
  }),
  user: one(users, {
    fields: [paymentOrders.userId],
    references: [users.id],
  }),
  payments: many(payments),
}));

export const adminPaymentsRelations = relations(adminPayments, ({ one }) => ({
  fromUser: one(users, {
    fields: [adminPayments.fromUserId],
    references: [users.id],
    relationName: 'adminPaymentFrom',
  }),
  toUser: one(users, {
    fields: [adminPayments.toUserId],
    references: [users.id],
    relationName: 'adminPaymentTo',
  }),
  booking: one(bookings, {
    fields: [adminPayments.bookingId],
    references: [bookings.id],
  }),
}));

// Export types
export type PaymentOrder = InferSelectModel<typeof paymentOrders>;
export type PaymentWebhook = InferSelectModel<typeof paymentWebhooks>;
export type AdminPayment = InferSelectModel<typeof adminPayments>;