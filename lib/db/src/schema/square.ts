import { pgTable, serial, integer, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const squareConfigTable = pgTable("square_config", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }).unique(),
  connected: boolean("connected").notNull().default(false),
  environment: text("environment").notNull().default("sandbox"),
  applicationId: text("application_id"),
  locationId: text("location_id"),
  accessToken: text("access_token"),
  checkoutEnabled: boolean("checkout_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSquareConfigSchema = createInsertSchema(squareConfigTable).omit({ id: true, updatedAt: true });
export type InsertSquareConfig = z.infer<typeof insertSquareConfigSchema>;
export type SquareConfig = typeof squareConfigTable.$inferSelect;

export const squareCatalogMappingsTable = pgTable(
  "square_catalog_mappings",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    squareItemId: text("square_item_id").notNull(),
    squareVariationId: text("square_variation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.siteId, table.entityType, table.entityId)],
);

export const insertSquareCatalogMappingSchema = createInsertSchema(squareCatalogMappingsTable).omit({ id: true, createdAt: true });
export type InsertSquareCatalogMapping = z.infer<typeof insertSquareCatalogMappingSchema>;
export type SquareCatalogMapping = typeof squareCatalogMappingsTable.$inferSelect;
