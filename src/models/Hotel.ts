import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";
import { rooms } from "./Room";
import { bookings } from "./Booking";
import { reviews } from "./Review";
import { hotelImages } from "./HotelImage";
import { cities } from "./cities";

// Hotel table
export const hotels = sqliteTable("hotels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  zipCode: text("zip_code"),
  starRating: text("star_rating"),
  amenities: text("amenities"), // Stored as JSON string
  ownerId: text("owner_id").references(() => users.id),
  mapCoordinates: text("map_coordinates").notNull().default('17.4065,78.4772'),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
});

export const hotelCities = sqliteTable("hotel_cities", {
  id: text("id").primaryKey(),
  hotelId: text("hotel_id").references(() => hotels.id),
  cityId: text("city_id").references(() => cities.id),
});

export const hotelUsers = sqliteTable("hotel_users", {
  id: text("id").primaryKey(),
  hotelId: text("hotel_id").references(() => hotels.id),
  userId: text("user_id").references(() => users.id),
});

// Define relationships
export const hotelsRelations = relations(hotels, ({ one, many }) => ({
  owner: one(users, {
    fields: [hotels.ownerId],
    references: [users.id],
    relationName: "hotelOwner",
  }),
  rooms: many(rooms),
  bookings: many(bookings),
  reviews: many(reviews),
  images: many(hotelImages),
  city: one(hotelCities, {
    fields: [hotels.id],
    references: [hotelCities.hotelId],
    relationName: "hotelCity",
  }),
}));

export const hotelUsersRelations = relations(hotelUsers, ({ one }) => ({
  user: one(users, {
    fields: [hotelUsers.userId],
    references: [users.id],
    relationName: "hotelUser",
  }),
}));
// Export type
export type Hotel = InferSelectModel<typeof hotels>;

export {};
