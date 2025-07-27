import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { hotels } from "./Hotel";
import { rooms } from "./Room";
import { payments } from "./Payment";
import { reviews } from "./Review";
import { coupons } from "./Coupon";
import { bookingCoupons } from "./BookingCoupons";

// Booking table
export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  roomId: text('room_id').references(() => rooms.id).notNull(),
  checkInDate: integer('check_in_date', { mode: 'timestamp' }).notNull(),
  checkOutDate: integer('check_out_date', { mode: 'timestamp' }).notNull(),
  bookingType: text('booking_type').notNull().default('daily'), // 'daily' or 'hourly'
  totalHours: integer('total_hours'), // Only for hourly bookings
  guestCount: integer('guest_count').notNull().default(1),
  totalAmount: real('total_amount').notNull(),
  paymentMode: text('payment_mode').notNull().default('offline'), // 'online', 'offline'
  requiresOnlinePayment: integer('requires_online_payment', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pending'), // confirmed, cancelled, checked_in, completed
  paymentStatus: text('payment_status').notNull().default('pending'), // pending, completed, failed, refunded
  cancellationReason: text('cancellation_reason'),
  cancelledBy: text('cancelled_by'), // 'user' or 'hotel'
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  bookingDate: integer('booking_date', { mode: 'timestamp' }).notNull().default(new Date()),
  specialRequests: text('special_requests'),
  paymentDueDate: integer('payment_due_date', { mode: 'timestamp' }), // For offline payments
  advanceAmount: real('advance_amount').default(0), // For partial payments
  remainingAmount: real('remaining_amount').default(0), // For partial payments
  guestName: text('guest_name').notNull(),
  guestEmail: text('guest_email').notNull(),
  guestPhone: text('guest_phone').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  hotel: one(hotels, {
    fields: [bookings.hotelId],
    references: [hotels.id],
  }),
  room: one(rooms, {
    fields: [bookings.roomId],
    references: [rooms.id],
  }),
  payment: one(payments,{
    fields: [bookings.id],
    references: [payments.bookingId],
  }),
  review: one(reviews, {
    fields: [bookings.id],
    references: [reviews.bookingId],
  }),
  bookingCoupons: many(bookingCoupons),

}));

// Export type
export type Booking = InferSelectModel<typeof bookings>;