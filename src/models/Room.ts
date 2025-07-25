
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { hotels } from "./Hotel";
import { roomTypes } from "./RoomType";
import { bookings } from "./Booking";
import { roomImages } from "./RoomImage";
import { roomHourlyStays } from "./RoomHourlyStay";

// Room table
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  roomNumber: text('room_number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  roomTypeId: text('room_type_id').references(() => roomTypes.id),
  type: text('type'), // For backward compatibility if roomTypeId is not used
  maxGuests: integer('max_guests').notNull().default(1),
  capacity: integer('capacity').notNull().default(1), // Alternative to maxGuests
  bedType: text('bed_type'), // single, double, queen, king
  size: real('size'), // in square feet
  floor: integer('floor'),
  pricePerNight: real('price_per_night').notNull(),
  pricePerHour: real('price_per_hour'), // For hourly bookings
  isHourlyBooking: integer('is_hourly_booking', { mode: 'boolean' }).notNull().default(false),
  isDailyBooking: integer('is_daily_booking', { mode: 'boolean' }).notNull().default(true),
  amenities: text('amenities'), // Stored as JSON string
  status: text('status').notNull().default('available'), // available, occupied, maintenance, out_of_order
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const roomsRelations = relations(rooms, ({ one, many }) => ({
  hotel: one(hotels, {
    fields: [rooms.hotelId],
    references: [hotels.id],
  }),
  roomType: one(roomTypes, {
    fields: [rooms.roomTypeId],
    references: [roomTypes.id],
  }),
  bookings: many(bookings),
  images: many(roomImages),
  hourlyStays: many(roomHourlyStays),
}));

// Export type
export type Room = InferSelectModel<typeof rooms>;

export {}