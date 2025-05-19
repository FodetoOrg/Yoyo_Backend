import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { rooms } from "./Room";

// Room Images table
export const roomImages = sqliteTable('room_images', {
  id: text('id').primaryKey(),
  roomId: text('room_id').references(() => rooms.id).notNull(),
  url: text('url').notNull(),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const roomImagesRelations = relations(roomImages, ({ one }) => ({
  room: one(rooms, {
    fields: [roomImages.roomId],
    references: [rooms.id],
  }),
}));

// Export type
export type RoomImage = InferSelectModel<typeof roomImages>; 