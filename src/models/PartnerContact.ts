
import { InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const partnerContacts = sqliteTable('partner_contacts', {
  id: text('id').primaryKey(),
  hotelName: text('hotel_name').notNull(),
  numberOfRooms: integer('number_of_rooms').notNull(),
  hotelDescription: text('hotel_description'),
  ownerFullName: text('owner_full_name').notNull(),
  ownerEmail: text('owner_email').notNull(),
  ownerPhone: text('owner_phone').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  status: text('status').notNull().default('pending'), // pending, contacted, converted, rejected
  notes: text('notes'),
  contactedAt: integer('contacted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

export type PartnerContact = InferSelectModel<typeof partnerContacts>;

export {};
