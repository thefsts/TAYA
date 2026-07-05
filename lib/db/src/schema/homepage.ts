import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const homepageContentTable = pgTable("homepage_content", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }).unique(),
  heroHeadline: text("hero_headline").notNull().default(""),
  heroSubheadline: text("hero_subheadline").notNull().default(""),
  heroImageUrl: text("hero_image_url"),
  sections: jsonb("sections").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomepageContentSchema = createInsertSchema(homepageContentTable).omit({ id: true, updatedAt: true });
export type InsertHomepageContent = z.infer<typeof insertHomepageContentSchema>;
export type HomepageContent = typeof homepageContentTable.$inferSelect;
