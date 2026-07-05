import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const footerContentTable = pgTable("footer_content", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }).unique(),
  columns: jsonb("columns").notNull().default([]),
  socialLinks: jsonb("social_links").notNull().default([]),
  copyrightText: text("copyright_text").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFooterContentSchema = createInsertSchema(footerContentTable).omit({ id: true, updatedAt: true });
export type InsertFooterContent = z.infer<typeof insertFooterContentSchema>;
export type FooterContent = typeof footerContentTable.$inferSelect;
