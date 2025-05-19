// This file is intentionally left empty as all user-related models are defined in schema.ts
// User model types are imported from schema.ts where needed

// To maintain consistency with project structure, this file exists
// but the actual schema definitions are centralized in schema.ts

import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { hotels } from "./Hotel";
import { payments } from "./Payment";
import { reviews } from "./Review";

// User table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  phone: text('phone'),
  role: text('role').notNull().default('user'),
  firebaseUid: text('firebase_uid').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  hotels: many(hotels, { relationName: "hotelOwner" }),
  reviews: many(reviews),
  payments: many(payments),
}));

export type User = InferSelectModel<typeof users>;

