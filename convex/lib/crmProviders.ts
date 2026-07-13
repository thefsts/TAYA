/**
 * CRM provider registry — modular provider definitions so a second CRM can be
 * added here without touching schema, dispatch logic, or the polling cron.
 *
 * Each provider declares:
 *   apiBase       — base URL for outbound API calls
 *   inboundBase   — base URL for inbound polling (may differ from apiBase)
 *   endpointMap   — maps CRM entity types to provider-specific path segments
 *   inboundTypes  — entity types this provider supports for inbound polling
 */

export type CrmProviderKey = "operon";

export interface CrmProviderConfig {
  apiBase: string;
  inboundBase: string;
  endpointMap: Record<string, string>;
  inboundTypes: string[];
}

export const CRM_PROVIDERS: Record<CrmProviderKey, CrmProviderConfig> = {
  operon: {
    apiBase: "https://api.operoncrm.com/v1",
    inboundBase: "https://api.operoncrm.com/v1/inbound",
    endpointMap: {
      contact_form: "leads",
      quote_request: "leads",
      consultation: "leads",
      lead: "leads",
      event_registration: "registrations",
      course_registration: "registrations",
      order: "orders",
      customer: "customers",
      payment: "payments",
      payment_notification: "payments",
      newsletter_signup: "contacts",
      application: "leads",
      custom_form: "leads",
      marketing_trigger: "marketing/events",
      support_ticket: "support/tickets",
      review_request: "reviews/requests",
      automation_event: "automation/events",
    },
    inboundTypes: ["appointment_status", "lead_status", "tags"],
  },
};

export function getProvider(key: string): CrmProviderConfig | null {
  return (CRM_PROVIDERS as Record<string, CrmProviderConfig>)[key] ?? null;
}
