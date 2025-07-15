import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";

// Customer Profile table
export const customerProfiles = sqliteTable('customer_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  fullName: text('full_name'),
  email: text('email'),
  gender: text('gender'), // male, female, other, prefer_not_to_say
  dateOfBirth: integer('date_of_birth', { mode: 'timestamp' }),
  profileImage: text('profile_image'),
  
  // Notification preferences
  bookingUpdatesEnabled: integer('booking_updates_enabled', { mode: 'boolean' }).notNull().default(true),
  checkinRemindersEnabled: integer('checkin_reminders_enabled', { mode: 'boolean' }).notNull().default(true),
  securityAlertsEnabled: integer('security_alerts_enabled', { mode: 'boolean' }).notNull().default(true),
  promotionalOffersEnabled: integer('promotional_offers_enabled', { mode: 'boolean' }).notNull().default(false),
  
  // Preferences
  preferredLanguage: text('preferred_language').default('en'),
  currency: text('currency').default('INR'),
  
  // Onboarding
  skippedOnboarding: integer('skipped_onboarding', { mode: 'boolean' }).notNull().default(false),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const customerProfilesRelations = relations(customerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [customerProfiles.userId],
    references: [users.id],
  }),
}));

// Export type
export type CustomerProfile = InferSelectModel<typeof customerProfiles>;