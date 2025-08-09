
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { bookings } from "./Booking";
import { payments } from "./Payment";
import { wallets } from "./Wallet";

// Wallet Usage table
export const walletUsages = sqliteTable('wallet_usages', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  paymentId: text('payment_id').references(() => payments.id).notNull(),
  amountUsed: real('amount_used').notNull(),
  remainingWalletBalance: real('remaining_wallet_balance').notNull(),
  usageType: text('usage_type').notNull().default('payment'), // 'payment', 'refund_credit'
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const walletUsagesRelations = relations(walletUsages, ({ one }) => ({
  user: one(users, {
    fields: [walletUsages.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [walletUsages.walletId],
    references: [wallets.id],
  }),
  booking: one(bookings, {
    fields: [walletUsages.bookingId],
    references: [bookings.id],
  }),
  payment: one(payments, {
    fields: [walletUsages.paymentId],
    references: [payments.id],
  }),
}));

// Export type
export type WalletUsage = InferSelectModel<typeof walletUsages>;
