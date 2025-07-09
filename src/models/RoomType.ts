import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { rooms } from "./Room";

// Room Types table
export const roomTypes = sqliteTable('room_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active, inactive
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const roomTypesRelations = relations(roomTypes, ({ many }) => ({
  rooms: many(rooms),
}));

// Export type
export type RoomType = InferSelectModel<typeof roomTypes>;