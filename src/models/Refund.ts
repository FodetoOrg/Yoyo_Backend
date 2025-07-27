
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { users } from "./User";
import { payments } from "./Payment";

// Refund table
export const refunds = sqliteTable('refunds', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  originalPaymentId: text('original_payment_id').references(() => payments.id),
  userId: text('user_id').references(() => users.id).notNull(),
  refundType: text('refund_type').notNull(), // 'cancellation', 'no_show', 'admin_refund'
  originalAmount: real('original_amount').notNull(),
  cancellationFeeAmount: real('cancellation_fee_amount').notNull().default(0),
  refundAmount: real('refund_amount').notNull(),
  cancellationFeePercentage: integer('cancellation_fee_percentage').notNull().default(0),
  refundReason: text('refund_reason').notNull(),
  status: text('status').notNull().default('pending'), // pending, processed, failed, rejected
  refundMethod: text('refund_method'), // 'razorpay', 'bank_transfer', 'cash'
  razorpayRefundId: text('razorpay_refund_id'),
  processedBy: text('processed_by'), // Admin/staff who processed the refund
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  rejectionReason: text('rejection_reason'),
  bankDetails: text('bank_details'), // JSON for bank transfer details
  expectedProcessingDays: integer('expected_processing_days').default(7),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const refundsRelations = relations(refunds, ({ one }) => ({
  booking: one(bookings, {
    fields: [refunds.bookingId],
    references: [bookings.id],
  }),
  originalPayment: one(payments, {
    fields: [refunds.originalPaymentId],
    references: [payments.id],
  }),
  user: one(users, {
    fields: [refunds.userId],
    references: [users.id],
  }),
}));

// Export type
export type Refund = InferSelectModel<typeof refunds>;
