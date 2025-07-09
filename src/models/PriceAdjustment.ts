import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

// Price adjustments table
export const priceAdjustments = sqliteTable('price_adjustments', {
  id: text('id').primaryKey(),
  cities: text('cities'), // JSON array of city IDs
  hotels: text('hotels'), // JSON array of hotel IDs
  roomTypes: text('room_types'), // JSON array of room type IDs
  adjustmentType: text('adjustment_type').notNull(), // percentage, fixed
  adjustmentValue: real('adjustment_value').notNull(),
  reason: text('reason'),
  effectiveDate: integer('effective_date', { mode: 'timestamp' }).notNull(),
  expiryDate: integer('expiry_date', { mode: 'timestamp' }),
  status: text('status').notNull().default('active'), // active, inactive, expired
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Export type
export type PriceAdjustment = InferSelectModel<typeof priceAdjustments>;