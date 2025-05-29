import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./User";

// Staff table
export const staff = sqliteTable('staff', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  department: text('department'),
  position: text('position'),
  joiningDate: integer('joining_date', { mode: 'timestamp' }).notNull().default(new Date()),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Staff permissions table
export const staffPermissions = sqliteTable('staff_permissions', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  permissionKey: text('permission_key').notNull(),
  permissionValue: text('permission_value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
});

// Define relationships
export const staffRelations = relations(staff, ({ one, many }) => ({
  user: one(users, {
    fields: [staff.userId],
    references: [users.id],
  }),
  permissions: many(staffPermissions),
}));

export const staffPermissionsRelations = relations(staffPermissions, ({ one }) => ({
  staff: one(staff, {
    fields: [staffPermissions.staffId],
    references: [staff.id],
  }),
}));

export type Staff = InferSelectModel<typeof staff>;
export type StaffPermission = InferSelectModel<typeof staffPermissions>; 