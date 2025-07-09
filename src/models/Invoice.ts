import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { users } from "./User";
import { hotels } from "./Hotel";

// Invoice table
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  amount: real('amount').notNull(),
  tax: real('tax').notNull().default(0),
  totalAmount: real('total_amount').notNull(),
  status: text('status').notNull().default('pending'), // pending, paid, overdue, cancelled
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),
  paidDate: integer('paid_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const invoicesRelations = relations(invoices, ({ one }) => ({
  booking: one(bookings, {
    fields: [invoices.bookingId],
    references: [bookings.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  hotel: one(hotels, {
    fields: [invoices.hotelId],
    references: [hotels.id],
  }),
}));

// Export type
export type Invoice = InferSelectModel<typeof invoices>;