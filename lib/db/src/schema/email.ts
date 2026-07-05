import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const emailSettingsTable = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }).unique(),
  fromName: text("from_name").notNull().default(""),
  fromEmail: text("from_email").notNull().default(""),
  replyToEmail: text("reply_to_email").notNull().default(""),
  notifyOnNewLead: boolean("notify_on_new_lead").notNull().default(true),
  notifyOnBooking: boolean("notify_on_booking").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettingsTable).omit({ id: true, updatedAt: true });
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailSettings = typeof emailSettingsTable.$inferSelect;
