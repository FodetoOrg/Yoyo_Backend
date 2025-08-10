import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { hotels } from "./Hotel";
import { bookings } from "./Booking";

// Hotel Reviews table (enhanced)
export const hotelReviews = sqliteTable('hotel_reviews', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  bookingId: text('booking_id').references(() => bookings.id),
  
  // Ratings (1-5 scale)
  overallRating: real('overall_rating').notNull(),
  cleanlinessRating: real('cleanliness_rating'),
  serviceRating: real('service_rating'),
  locationRating: real('location_rating'),
  valueForMoneyRating: real('value_for_money_rating'),
  amenitiesRating: real('amenities_rating'),
  
  // Review content
  title: text('title'),
  comment: text('comment'),

  
  // Review metadata
  stayDate: integer('stay_date', { mode: 'timestamp' }),
  roomType: text('room_type'),
  
  // Moderation
  isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
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