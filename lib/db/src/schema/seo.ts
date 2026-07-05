import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const seoSettingsTable = pgTable(
  "seo_settings",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
    pagePath: text("page_path").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    ogImageUrl: text("og_image_url"),
    canonicalUrl: text("canonical_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.siteId, table.pagePath)],
);

export const insertSeoSettingSchema = createInsertSchema(seoSettingsTable).omit({ id: true, updatedAt: true });
export type InsertSeoSetting = z.infer<typeof insertSeoSettingSchema>;
export type SeoSetting = typeof seoSettingsTable.$inferSelect;
