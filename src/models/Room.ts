
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { hotels } from "./Hotel";
import { bookings } from "./Booking";
import { roomImages } from "./RoomImage";

// Room table
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  maxGuests: integer('max_guests').notNull().default(1),
  pricePerNight: real('price_per_night').notNull(),
  pricePerHour: real('price_per_hour'), // For hourly bookings
  roomType: text('room_type').notNull(), // e.g., deluxe, standard, suite
  amenities: text('amenities'), // Stored as JSON string
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  hotel: one(hotels, {
    fields: [rooms.hotelId],
    references: [hotels.id],
  }),
  bookings: many(bookings),
  images: many(roomImages),
}));

// Export type
export type Room = InferSelectModel<typeof rooms>;

export {}