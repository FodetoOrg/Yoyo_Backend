import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { hotels } from "./Hotel";

// Hotel Images table
export const hotelImages = sqliteTable('hotel_images', {
  id: text('id').primaryKey(),
  hotelId: text('hotel_id').references(() => hotels.id).notNull(),
  url: text('url').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const hotelImagesRelations = relations(hotelImages, ({ one }) => ({
  hotel: one(hotels, {
    fields: [hotelImages.hotelId],
    references: [hotels.id],
  }),
}));

// Export type
export type HotelImage = InferSelectModel<typeof hotelImages>; 