
import { InferSelectModel, relations } from "drizzle-orm";
import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";
import { hotels } from "./Hotel";
import { rooms } from "./Room";
import { bookings } from "./Booking";

// Addon table
export const addons = sqliteTable("addons", {
  id: text("id").primaryKey(),
  hotelId: text("hotel_id").references(() => hotels.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  price: real("price").notNull(),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
});

// Room-Addon mapping table
export const roomAddons = sqliteTable("room_addons", {
  id: text("id").primaryKey(),
  roomId: text("room_id").references(() => rooms.id).notNull(),
  addonId: text("addon_id").references(() => addons.id).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
});

// Booking-Addon mapping table (for selected addons in bookings)
export const bookingAddons = sqliteTable("booking_addons", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  addonId: text("addon_id").references(() => addons.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  totalPrice: real("total_price").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
});

// Define relationships
export const addonsRelations = relations(addons, ({ one, many }) => ({
  hotel: one(hotels, {
    fields: [addons.hotelId],
    references: [hotels.id],
  }),
  roomAddons: many(roomAddons),
  bookingAddons: many(bookingAddons),
}));

export const roomAddonsRelations = relations(roomAddons, ({ one }) => ({
  room: one(rooms, {
    fields: [roomAddons.roomId],
    references: [rooms.id],
  }),
  addon: one(addons, {
    fields: [roomAddons.addonId],
    references: [addons.id],
  }),
}));

export const bookingAddonsRelations = relations(bookingAddons, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingAddons.bookingId],
    references: [bookings.id],
  }),
  addon: one(addons, {
    fields: [bookingAddons.addonId],
    references: [addons.id],
  }),
}));

// Export types
export type Addon = InferSelectModel<typeof addons>;
export type RoomAddon = InferSelectModel<typeof roomAddons>;
export type BookingAddon = InferSelectModel<typeof bookingAddons>;

export {};
