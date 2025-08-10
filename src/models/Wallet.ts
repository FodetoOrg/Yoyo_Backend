
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./User";

// Wallet table
export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  balance: real('balance').notNull().default(0),
  totalEarned: real('total_earned').notNull().default(0), // Total money added to wallet
  totalSpent: real('total_spent').notNull().default(0), // Total money spent from wallet
  status: text('status').notNull().default('active'), // active, inactive, blocked
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
},
  (t) => ({
    userIdUnique: uniqueIndex("wallets_user_id_unique").on(t.userId), // keep name stable
  }));

// Define relationships
export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(walletTransactions),
}));

// Wallet transactions table
export const walletTransactions = sqliteTable('wallet_transactions', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').references(() => wallets.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // 'credit', 'debit'
  source: text('source').notNull(), // 'refund', 'payment', 'admin_credit', 'booking_payment'
  amount: real('amount').notNull(),
  balanceAfter: real('balance_after').notNull(),
  description: text('description').notNull(),
  referenceId: text('reference_id'), // booking_id, payment_id, refund_id
  referenceType: text('reference_type'), // 'booking', 'payment', 'refund'
  metadata: text('metadata'), // JSON for additional data
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships for wallet transactions
export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [walletTransactions.walletId],
    references: [wallets.id],
  }),
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
}));

// Export types
export type Wallet = InferSelectModel<typeof wallets>;
export type WalletTransaction = InferSelectModel<typeof walletTransactions>;




