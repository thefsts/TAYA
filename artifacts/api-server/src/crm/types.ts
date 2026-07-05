import type { CrmConnection, CrmEntityType, CrmSyncDirection } from "@workspace/db";

/**
 * Every CRM provider (Operon today, others later) implements this interface.
 * Routes and the sync dispatcher only ever talk to `CrmConnector` — no code
 * outside `crm/operon/` may reference Operon specifics directly.
 */
export interface CrmConnectorCredentials {
  apiKey?: string;
  orgId?: string | null;
  accountName?: string | null;
}

export interface CrmHealthCheckResult {
  healthy: boolean;
  detail?: string;
}

export interface CrmSyncPayload {
  entityType: CrmEntityType;
  direction: CrmSyncDirection;
  entityRef?: string;
  data: Record<string, unknown>;
}

export interface CrmSyncResult {
  ok: boolean;
  message?: string;
}

export interface CrmConnector {
  readonly provider: string;
  readonly displayName: string;
  /** Entity types this connector supports syncing, by direction. */
  readonly supportedEntities: { entityType: CrmEntityType; direction: CrmSyncDirection }[];

  testConnection(credentials: CrmConnectorCredentials): Promise<CrmHealthCheckResult>;
  push(credentials: CrmConnectorCredentials, payload: CrmSyncPayload): Promise<CrmSyncResult>;
  buildSsoLaunchUrl(connection: CrmConnection): { available: boolean; launchUrl: string | null; reason: string | null };
}
