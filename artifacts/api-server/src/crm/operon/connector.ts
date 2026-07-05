import type { CrmConnection } from "@workspace/db";
import type { CrmConnector, CrmConnectorCredentials, CrmHealthCheckResult, CrmSyncPayload, CrmSyncResult } from "../types";

/**
 * Operon CRM connector implementation.
 *
 * NOTE: the real Operon CRM (thefsts/operon-crm) is a Convex app. As of the
 * gap analysis in docs/OPERON_GAP_ANALYSIS.md, it has scoped `oprn_` API
 * tokens (`apiTokens.ts`) but no `httpAction` in `http.ts` actually validates
 * them yet — there is no working inbound REST endpoint on the Operon side to
 * call. This connector is written against the documented/intended contract
 * (bearer token + REST-ish JSON API) so it activates the moment that endpoint
 * ships, and `OPERON_API_BASE_URL` can be pointed at it without further
 * changes here. Until then, `testConnection`/`push` fail closed with a clear
 * error rather than pretending to succeed.
 */
const DEFAULT_BASE_URL = process.env.OPERON_API_BASE_URL || "";

async function operonRequest(
  credentials: CrmConnectorCredentials,
  path: string,
  init: { method: string; body?: unknown },
): Promise<Response> {
  if (!DEFAULT_BASE_URL) {
    throw new Error(
      "OPERON_API_BASE_URL is not configured. The Operon CRM does not yet expose a validated inbound REST API (see docs/OPERON_GAP_ANALYSIS.md) — set this once it does.",
    );
  }
  if (!credentials.apiKey) {
    throw new Error("No Operon API key configured for this site");
  }
  return fetch(`${DEFAULT_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${credentials.apiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
}

export const operonConnector: CrmConnector = {
  provider: "operon",
  displayName: "Operon CRM",
  supportedEntities: [
    { entityType: "contact_form", direction: "outbound" },
    { entityType: "quote_request", direction: "outbound" },
    { entityType: "consultation", direction: "outbound" },
    { entityType: "event_registration", direction: "outbound" },
    { entityType: "course_registration", direction: "outbound" },
    { entityType: "order", direction: "outbound" },
    { entityType: "customer", direction: "outbound" },
    { entityType: "payment", direction: "outbound" },
    { entityType: "newsletter_signup", direction: "outbound" },
    { entityType: "application", direction: "outbound" },
    { entityType: "custom_form", direction: "outbound" },
    { entityType: "appointment_status", direction: "inbound" },
    { entityType: "notes", direction: "inbound" },
    { entityType: "campaign_status", direction: "inbound" },
    { entityType: "lead_status", direction: "inbound" },
    { entityType: "tags", direction: "inbound" },
    { entityType: "profile_update", direction: "inbound" },
  ],

  async testConnection(credentials: CrmConnectorCredentials): Promise<CrmHealthCheckResult> {
    try {
      const response = await operonRequest(credentials, "/api/health", { method: "GET" });
      if (!response.ok) {
        return { healthy: false, detail: `Operon returned HTTP ${response.status}` };
      }
      return { healthy: true };
    } catch (error) {
      return { healthy: false, detail: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  async push(credentials: CrmConnectorCredentials, payload: CrmSyncPayload): Promise<CrmSyncResult> {
    try {
      const response = await operonRequest(credentials, `/api/sync/${payload.entityType}`, {
        method: "POST",
        body: { entityRef: payload.entityRef, data: payload.data },
      });
      if (!response.ok) {
        return { ok: false, message: `Operon returned HTTP ${response.status}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  buildSsoLaunchUrl(connection: CrmConnection) {
    if (!connection.ssoEnabled || connection.status !== "connected") {
      return { available: false, launchUrl: null, reason: "SSO is not enabled for this connection yet" };
    }
    if (!DEFAULT_BASE_URL) {
      return {
        available: false,
        launchUrl: null,
        reason: "Operon CRM does not yet expose a documented SSO handoff endpoint (see docs/OPERON_GAP_ANALYSIS.md)",
      };
    }
    return { available: true, launchUrl: `${DEFAULT_BASE_URL}/sso/launch?org=${connection.orgId ?? ""}`, reason: null };
  },
};
