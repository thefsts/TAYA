/**
 * @file crm-connector.ts
 * @module lib/db/src/schema/crm-connector
 *
 * Operon Connector™ — provider-agnostic CRM sync schema for FSTS-WOS™.
 *
 * PRODUCT BOUNDARY — READ BEFORE EDITING
 * ────────────────────────────────────────────────────────────────────────────
 * This schema is the SOLE sanctioned integration point between FSTS-WOS™ and
 * any external CRM (Operon CRM™ or future vendors).
 *
 * ✅ ALLOWED in this file / the Connector UI:
 *   - Per-entity outbound sync toggles (form submissions, enrollments, orders…)
 *   - Per-entity inbound sync toggles (appointment status, lead status, tags…)
 *   - Sync activity log with retry
 *   - API health monitoring for connected CRM providers
 *   - Adding a NEW CRM vendor → register it in CRM_PROVIDERS below; the
 *     schema and UI automatically support it. No other changes required.
 *
 * ❌ NOT ALLOWED here or anywhere in FSTS-WOS™:
 *   - Reputation management / review requesting / responding to reviews
 *     → belongs in Operon CRM™ (Review & Reputation Manager™)
 *   - Marketing automation / email campaigns / social scheduling
 *     → belongs in Operon CRM™ (AI Content Studio™)
 *   - Lead scoring, enrichment, or pipeline management
 *     → belongs in Operon CRM™ (Lead Intelligence™)
 *   - Appointment scheduling or calendar sync beyond status inbound
 *     → belongs in Operon CRM™ (Appointment & Booking Suite™)
 *   - Direct API calls to Operon CRM™ outside this Connector
 *   - Shared databases or embedded CRM UI outside this schema
 *
 * See docs/product-boundaries.md §3 for the full specification and canonical
 * data-flow examples. Any doubt → consult that document first.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { pgTable, text, timestamp, boolean, uuid, jsonb, integer } from "drizzle-orm/pg-core";

/**
 * Registry of supported CRM providers.
 *
 * To add a new vendor: append an entry here. The Connector UI and sync
 * engine discover providers from this array at runtime — no schema rewrite
 * required (see docs/product-boundaries.md §7).
 */
export const CRM_PROVIDERS = ["operon"] as const;
export type CrmProvider = typeof CRM_PROVIDERS[number];

/**
 * Connector configuration per site.
 *
 * One row per (site, provider) pair. Inactive until credentials are set by
 * a site admin (default_installed = true, active = false).
 */
export const crmConnectors = pgTable("crm_connectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").notNull(),
  provider: text("provider").$type<CrmProvider>().notNull().default("operon"),
  active: boolean("active").notNull().default(false),
  apiEndpoint: text("api_endpoint"),
  encryptedCredentials: text("encrypted_credentials"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Per-entity sync toggle table.
 *
 * Each row enables or disables a specific sync entity for a connector.
 * Direction: "outbound" (FSTS-WOS™ → CRM) or "inbound" (CRM → FSTS-WOS™).
 *
 * Canonical outbound entities (docs/product-boundaries.md §3.2):
 *   - form_submission   — website contact / quote form submitted
 *   - course_enrollment — course registration completed
 *   - membership_signup — membership signup completed
 *   - payment_completed — website checkout payment completed
 *
 * Canonical inbound entities:
 *   - appointment_status — appointment status changes from CRM
 *   - lead_status        — lead status updates from CRM
 *   - contact_tags       — tag updates from CRM
 */
export const crmSyncToggles = pgTable("crm_sync_toggles", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectorId: uuid("connector_id").notNull(),
  entity: text("entity").notNull(),
  direction: text("direction").$type<"outbound" | "inbound">().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Sync activity log — one row per sync attempt, with retry support.
 */
export const crmSyncLog = pgTable("crm_sync_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  connectorId: uuid("connector_id").notNull(),
  entity: text("entity").notNull(),
  direction: text("direction").$type<"outbound" | "inbound">().notNull(),
  status: text("status").$type<"pending" | "success" | "failed">().notNull().default("pending"),
  payload: jsonb("payload"),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
