import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const roleEnum = pgEnum("role", [
  "super_admin",
  "client_admin",
  "editor",
  "marketing",
  "training_manager",
  "read_only",
]);

export const usersTable = pgTable("dashboard_users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userSiteRolesTable = pgTable(
  "user_site_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.siteId)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DashboardUser = typeof usersTable.$inferSelect;

export const insertUserSiteRoleSchema = createInsertSchema(userSiteRolesTable).omit({ id: true, createdAt: true });
export type InsertUserSiteRole = z.infer<typeof insertUserSiteRoleSchema>;
export type UserSiteRole = typeof userSiteRolesTable.$inferSelect;
