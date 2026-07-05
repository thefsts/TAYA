import type { CrmProvider } from "@workspace/db";
import type { CrmConnector } from "./types";
import { operonConnector } from "./operon/connector";

/**
 * Modular connector registry. Adding a second CRM provider means writing a
 * new `CrmConnector` implementation and registering it here — no other file
 * in `crm/` or `routes/crm.ts` needs to change.
 */
const registry = new Map<CrmProvider, CrmConnector>([["operon", operonConnector]]);

export function getConnector(provider: CrmProvider): CrmConnector {
  const connector = registry.get(provider);
  if (!connector) {
    throw new Error(`No CRM connector registered for provider "${provider}"`);
  }
  return connector;
}

export function listConnectors(): CrmConnector[] {
  return Array.from(registry.values());
}
