import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";
import { cities } from "./cities";
import { hotels } from "./Hotel";
import { roomTypes } from "./RoomType";
import { users } from "./User";
import { bookings } from "./Booking";

// Coupons table
export const coupons = sqliteTable('coupons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description'),
  discountType: text('discount_type').notNull(), // percentage, fixed
  discountValue: real('discount_value').notNull(),
  maxDiscountAmount: real('max_discount_amount'),
  minOrderAmount: real('min_order_amount').default(0),
  validFrom: integer('valid_from', { mode: 'timestamp' }).notNull(),
  validTo: integer('valid_to', { mode: 'timestamp' }).notNull(),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').notNull().default(0),
  priceIncreasePercentage: real('price_increase_percentage').default(0),
  applicableBookingTypes: text('applicable_booking_types').notNull().default('both'), // 'daily', 'hourly', 'both'
  status: text('status').notNull().default('active'), // active, inactive, expired
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Coupon mappings table
export const couponMappings = sqliteTable('coupon_mappings', {
  id: text('id').primaryKey(),
  couponId: text('coupon_id').references(() => coupons.id).notNull(),
  cityId: text('city_id').references(() => cities.id),
  hotelId: text('hotel_id').references(() => hotels.id),
  roomTypeId: text('room_type_id').references(() => roomTypes.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
});


export const couponUsages = sqliteTable('coupon_usages',{
  id: text('id').primaryKey(),
  couponId: text('coupon_id').references(() => coupons.id).notNull(),
  hotelId: text('hotel_id').references(() => hotels.id),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  bookingId: text("booking_id").references(() => bookings.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),

})

// Define relationships
export const couponsRelations = relations(coupons, ({ many }) => ({
  mappings: many(couponMappings),
  couponUsages:many(couponUsages)
}));

export const couponMappingsRelations = relations(couponMappings, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponMappings.couponId],
    references: [coupons.id],
  }),
  city: one(cities, {
    fields: [couponMappings.cityId],
    references: [cities.id],
  }),
  hotel: one(hotels, {
    fields: [couponMappings.hotelId],
    references: [hotels.id],
  }),
  roomType: one(roomTypes, {
    fields: [couponMappings.roomTypeId],
    references: [roomTypes.id],
  }),
}));

export const couponUsagesRelations = relations(couponUsages, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponUsages.couponId],
    references: [coupons.id],
  }),
  hotel: one(hotels, {
    fields: [couponUsages.hotelId],
    references: [hotels.id],
  }),
  user: one(users, {
    fields: [couponUsages.userId],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [couponUsages.bookingId],
    references: [bookings.id],
  }),
}));

// Export types
export type Coupon = InferSelectModel<typeof coupons>;
export type CouponMapping = InferSelectModel<typeof couponMappings>;