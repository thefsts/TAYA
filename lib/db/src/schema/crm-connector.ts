import { pgTable, serial, integer, text, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

/**
 * Modular CRM connector platform. `provider` is never hardcoded to a single
 * vendor in application logic — Operon is simply the first (and currently
 * only) implementation registered against this schema. Adding a second CRM
 * means adding another provider row shape here, not new tables.
 */
export const CRM_PROVIDERS = ["operon"] as const;
export type CrmProvider = (typeof CRM_PROVIDERS)[number];

export const CRM_CONNECTION_STATUSES = ["not_connected", "pending", "connected", "error"] as const;
export type CrmConnectionStatus = (typeof CRM_CONNECTION_STATUSES)[number];

export const CRM_AUTH_METHODS = ["api_key", "oauth", "sso"] as const;
export type CrmAuthMethod = (typeof CRM_AUTH_METHODS)[number];

export const CRM_API_HEALTH_STATUSES = ["unknown", "healthy", "degraded", "down"] as const;
export type CrmApiHealth = (typeof CRM_API_HEALTH_STATUSES)[number];

/** Website -> CRM entity categories (outbound sync sources). */
export const CRM_OUTBOUND_ENTITY_TYPES = [
  "contact_form",
  "quote_request",
  "consultation",
  "event_registration",
  "course_registration",
  "order",
  "customer",
  "payment",
  "newsletter_signup",
  "application",
  "custom_form",
] as const;
export type CrmOutboundEntityType = (typeof CRM_OUTBOUND_ENTITY_TYPES)[number];

/** CRM -> website update categories (inbound sync targets). */
export const CRM_INBOUND_ENTITY_TYPES = [
  "appointment_status",
  "notes",
  "campaign_status",
  "lead_status",
  "tags",
  "profile_update",
] as const;
export type CrmInboundEntityType = (typeof CRM_INBOUND_ENTITY_TYPES)[number];

export const CRM_ENTITY_TYPES = [...CRM_OUTBOUND_ENTITY_TYPES, ...CRM_INBOUND_ENTITY_TYPES] as const;
export type CrmEntityType = (typeof CRM_ENTITY_TYPES)[number];

export const CRM_SYNC_DIRECTIONS = ["outbound", "inbound"] as const;
export type CrmSyncDirection = (typeof CRM_SYNC_DIRECTIONS)[number];

export const CRM_SYNC_LOG_STATUSES = ["success", "failed", "retrying", "pending"] as const;
export type CrmSyncLogStatus = (typeof CRM_SYNC_LOG_STATUSES)[number];

/** One row per site. Default-installed (row created at site-creation time) but not_connected until an admin configures it. */
export const crmConnectionsTable = pgTable(
  "crm_connections",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CRM_PROVIDERS }).notNull().default("operon"),
    status: text("status", { enum: CRM_CONNECTION_STATUSES }).notNull().default("not_connected"),
    authMethod: text("auth_method", { enum: CRM_AUTH_METHODS }).notNull().default("api_key"),
    accountName: text("account_name"),
    orgId: text("org_id"),
    /** AES-256-GCM ciphertext (base64: iv.authTag.ciphertext) — never stored or returned in plaintext. */
    apiKeyEncrypted: text("api_key_encrypted"),
    ssoEnabled: boolean("sso_enabled").notNull().default(false),
    apiHealth: text("api_health", { enum: CRM_API_HEALTH_STATUSES }).notNull().default("unknown"),
    lastHealthCheckAt: timestamp("last_health_check_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.siteId, table.provider)],
);

export const insertCrmConnectionSchema = createInsertSchema(crmConnectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmConnection = z.infer<typeof insertCrmConnectionSchema>;
export type CrmConnection = typeof crmConnectionsTable.$inferSelect;

/** Per-entity sync toggle, one row per (site, provider, entityType, direction). */
export const crmEntitySyncSettingsTable = pgTable(
  "crm_entity_sync_settings",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CRM_PROVIDERS }).notNull().default("operon"),
    entityType: text("entity_type", { enum: CRM_ENTITY_TYPES }).notNull(),
    direction: text("direction", { enum: CRM_SYNC_DIRECTIONS }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.siteId, table.provider, table.entityType, table.direction)],
);

export const insertCrmEntitySyncSettingSchema = createInsertSchema(crmEntitySyncSettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertCrmEntitySyncSetting = z.infer<typeof insertCrmEntitySyncSettingSchema>;
export type CrmEntitySyncSetting = typeof crmEntitySyncSettingsTable.$inferSelect;

/** Append-only sync activity log, retryable. */
export const crmSyncLogsTable = pgTable(
  "crm_sync_logs",
  {
    id: serial("id").primaryKey(),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CRM_PROVIDERS }).notNull().default("operon"),
    entityType: text("entity_type", { enum: CRM_ENTITY_TYPES }).notNull(),
    direction: text("direction", { enum: CRM_SYNC_DIRECTIONS }).notNull(),
    status: text("status", { enum: CRM_SYNC_LOG_STATUSES }).notNull(),
    entityRef: text("entity_ref"),
    message: text("message"),
    attempt: integer("attempt").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("crm_sync_logs_site_idx").on(table.siteId, table.createdAt)],
);

export const insertCrmSyncLogSchema = createInsertSchema(crmSyncLogsTable).omit({ id: true, createdAt: true });
export type InsertCrmSyncLog = z.infer<typeof insertCrmSyncLogSchema>;
export type CrmSyncLog = typeof crmSyncLogsTable.$inferSelect;
