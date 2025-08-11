import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { users } from "./User";
import { paymentOrders } from "./PaymentOrder"; // Add this import

// Payment table
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  paymentOrderId: text('payment_order_id').references(() => paymentOrders.id), // Add this foreign key
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  paymentType: text('payment_type').notNull().default('full'), // 'full', 'advance', 'remaining'
  paymentMethod: text('payment_method'),
  paymentMode: text('payment_mode').notNull().default('offline'), // 'online', 'offline'
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpayOrderId: text('razorpay_order_id'),
  razorpaySignature: text('razorpay_signature'),
  offlinePaymentDetails: text('offline_payment_details'), // JSON for offline payment info
  receivedBy: text('received_by'), // Staff member who received offline payment
  receiptNumber: text('receipt_number'), // For offline payments
  walletAmountUsed: real('wallet_amount_used').default(0), // Amount paid using wallet
  actualPaymentAmount: real('actual_payment_amount'), // Amount paid through payment gateway after wallet deduction
  roomCharge: real('room_charge').default(0), // Base room charge
  gstAmount: real('gst_amount').default(0), // GST amount
  platformFee: real('platform_fee').default(0), // Platform fee amount
  discountAmount: real('discount_amount').default(0), // Coupon discount amount
  status: text('status').notNull().default('pending'), // pending, completed, failed, refund ,refund_completed
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
  paymentOrder: one(paymentOrders, { // Add this relationship
    fields: [payments.paymentOrderId],
    references: [paymentOrders.id],
  }),
}));

// Export type
export type Payment = InferSelectModel<typeof payments>;