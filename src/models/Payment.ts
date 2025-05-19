import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { users } from "./User";

// Payment table
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  paymentMethod: text('payment_method'),
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpaySignature: text('razorpay_signature'),
  status: text('status').notNull().default('pending'), // pending, completed, failed, refunded
  transactionDate: integer('transaction_date', { mode: 'timestamp' }).notNull().default(new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

// Export type
export type Payment = InferSelectModel<typeof payments>; 