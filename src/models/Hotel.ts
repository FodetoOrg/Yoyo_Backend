import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { rooms } from "./Room";
import { bookings } from "./Booking";
import { reviews } from "./Review";
import { hotelImages } from "./HotelImage";

// Hotel table
export const hotels = sqliteTable('hotels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address').notNull(),
  city: text('city').notNull(),
  state: text('state'),
  country: text('country').notNull(),
  zipCode: text('zip_code'),
  starRating: integer('star_rating'),
  amenities: text('amenities'), // Stored as JSON string
  ownerId: text('owner_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const hotelsRelations = relations(hotels, ({ one, many }) => ({
  owner: one(users, {
    fields: [hotels.ownerId],
    references: [users.id],
    relationName: "hotelOwner"
  }),
  rooms: many(rooms),
  bookings: many(bookings),
  reviews: many(reviews),
  images: many(hotelImages),
}));

// Export type
export type Hotel = InferSelectModel<typeof hotels>;

export {}