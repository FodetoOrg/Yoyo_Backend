import { InferSelectModel, relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { hotels } from "./Hotel";

export const cities = sqliteTable("cities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(new Date()),
});

export const citiesRelations = relations(cities, ({ many }) => ({
  hotels: many(hotels),
}));

export type City = InferSelectModel<typeof cities>;
