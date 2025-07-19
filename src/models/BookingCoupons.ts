import { InferSelectModel, relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { coupons } from "./Coupon";

export const bookingCoupons = sqliteTable('booking_coupons', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  couponId: text('coupon_id').references(() => coupons.id).notNull(),
  discountAmount: real('discount_amount').notNull(),
  appliedAt: integer('applied_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const bookingCouponsRelations = relations(bookingCoupons, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingCoupons.bookingId],
    references: [bookings.id],
  }),
  coupon: one(coupons, {
    fields: [bookingCoupons.couponId],
    references: [coupons.id],
  }),
}));

export type BookingCoupon = InferSelectModel<typeof bookingCoupons>;