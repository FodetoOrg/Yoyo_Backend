import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { hotels } from "./Hotel";

// Revenue records table
export const revenueRecords = sqliteTable('revenue_records', {
  id: text('id').primaryKey(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  period: text('period').notNull(), // YYYY-MM format
  totalRevenue: real('total_revenue').notNull(),
  commissionRate: real('commission_rate').notNull(),
  commissionAmount: real('commission_amount').notNull(),
  payableAmount: real('payable_amount').notNull(),
  status: text('status').notNull().default('pending'), // pending, paid, overdue
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  paidDate: integer('paid_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const revenueRecordsRelations = relations(revenueRecords, ({ one }) => ({
  hotel: one(hotels, {
    fields: [revenueRecords.hotelId],
    references: [hotels.id],
  }),
}));

// Export type
export type RevenueRecord = InferSelectModel<typeof revenueRecords>;