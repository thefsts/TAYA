import { pgTable, serial, text, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { WEBSITE_TYPES, MODULE_KEYS, defaultModulesForWebsiteType, type EnabledModules } from "./site-modules";

export const websiteTypeEnum = pgEnum("website_type", WEBSITE_TYPES);

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  domain: text("domain"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  brandColorPrimary: text("brand_color_primary").notNull().default("#1d4ed8"),
  brandColorSecondary: text("brand_color_secondary").notNull().default("#0f172a"),
  whiteLabelEnabled: boolean("white_label_enabled").notNull().default(false),
  poweredByFsts: boolean("powered_by_fsts").notNull().default(true),
  websiteType: websiteTypeEnum("website_type").notNull().default("business_website"),
  enabledModules: jsonb("enabled_modules").$type<EnabledModules>().notNull().default(defaultModulesForWebsiteType("business_website")),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

const enabledModulesSchema = z.object(
  Object.fromEntries(MODULE_KEYS.map((key) => [key, z.boolean()])) as Record<(typeof MODULE_KEYS)[number], z.ZodBoolean>,
);

export const insertSiteSchema = createInsertSchema(sitesTable, {
  websiteType: z.enum(WEBSITE_TYPES),
  enabledModules: enabledModulesSchema,
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;

export * from "./site-modules";
