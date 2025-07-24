// This file is intentionally left empty as all user-related models are defined in schema.ts
// User model types are imported from schema.ts where needed

// To maintain consistency with project structure, this file exists
// but the actual schema definitions are centralized in schema.ts

import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { bookings } from "./Booking";
import { hotels } from "./Hotel";
import { payments } from "./Payment";
import { reviews } from "./Review";
import { UserRole, UserStatus } from "../types/common";
import { customerProfiles } from "./CustomerProfile";

// User table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  phone: text("phone"),
  hasOnboarded: integer("has_onboarded", { mode: "boolean" })
    .notNull()
    .default(false),
  role: text("role", {
    enum: [UserRole.USER, UserRole.HOTEL_ADMIN, UserRole.STAFF],
  })
    .notNull()
    .default(UserRole.USER),
  status: text("status", {
    enum: [UserStatus.ACTIVE, UserStatus.INACTIVE],
  })
    .notNull()
    .default(UserStatus.ACTIVE),
  firebaseUid: text("firebase_uid").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
}, (table) => ({
  // Make phone + role combination unique
  phoneRoleUnique: unique().on(table.phone, table.role),
}));

// Define relationships
export const usersRelations = relations(users, ({ many, one }) => ({
  bookings: many(bookings),
  hotels: many(hotels, { relationName: "hotelOwner" }),
  reviews: many(reviews),
  payments: many(payments),
  customerProfile: one(customerProfiles,{
    fields: [users.id],
    references: [customerProfiles.userId],
  }
  )
}));

export type User = InferSelectModel<typeof users>;
