
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { hotels } from "./Hotel";
import { bookings } from "./Booking";

// Hotel Reviews table (simplified)
export const hotelReviews = sqliteTable('hotel_reviews', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  bookingId: text('booking_id').references(() => bookings.id).notNull(),
  
  // Single rating (1-5 scale)
  rating: real('rating').notNull(),
  
  // Review content
  comment: text('comment'),
  
  // Review metadata
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(true),
  isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(true),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const hotelReviewsRelations = relations(hotelReviews, ({ one }) => ({
  user: one(users, {
    fields: [hotelReviews.userId],
    references: [users.id],
  }),
  hotel: one(hotels, {
    fields: [hotelReviews.hotelId],
    references: [hotels.id],
  }),
  booking: one(bookings, {
    fields: [hotelReviews.bookingId],
    references: [bookings.id],
  }),
}));

// Export type
export type HotelReview = InferSelectModel<typeof hotelReviews>;
