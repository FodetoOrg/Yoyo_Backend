
import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { rooms } from "./Room";

// Room Hourly Stay table
export const roomHourlyStays = sqliteTable('room_hourly_stays', {
  id: text('id').primaryKey(),
  roomId: text('room_id').references(() => rooms.id).notNull(),
  hours: integer('hours').notNull(), // 3, 6, 12 etc
  price: real('price').notNull(),
  name: text('name').notNull(), // "3 Hour Stay", "6 Hour Stay"
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const roomHourlyStaysRelations = relations(roomHourlyStays, ({ one }) => ({
  room: one(rooms, {
    fields: [roomHourlyStays.roomId],
    references: [rooms.id],
  }),
}));

// Export type
export type RoomHourlyStay = InferSelectModel<typeof roomHourlyStays>;

export {}
