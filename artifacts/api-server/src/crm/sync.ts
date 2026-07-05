import { eq, and } from "drizzle-orm";
import { db, crmConnectionsTable, crmEntitySyncSettingsTable, crmSyncLogsTable, type CrmEntityType } from "@workspace/db";
import { decryptSecret } from "./crypto";
import { getConnector } from "./registry";

/**
 * Fire-and-forget outbound sync dispatcher. Call this from any write path
 * that produces an entity Operon (or a future CRM) cares about — e.g. after
 * creating an event registration, course enrollment, or completed payment.
 * It is intentionally resilient: a missing/disconnected/disabled connection
 * is a no-op, never an error thrown back at the caller's request.
 */
export async function dispatchCrmSync(params: {
  siteId: number;
  entityType: CrmEntityType;
  entityRef?: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { siteId, entityType, entityRef, data } = params;

  const [connection] = await db
    .select()
    .from(crmConnectionsTable)
    .where(eq(crmConnectionsTable.siteId, siteId));

  if (!connection || connection.status !== "connected") {
    return;
  }

  const [setting] = await db
    .select()
    .from(crmEntitySyncSettingsTable)
    .where(
      and(
        eq(crmEntitySyncSettingsTable.siteId, siteId),
        eq(crmEntitySyncSettingsTable.provider, connection.provider),
        eq(crmEntitySyncSettingsTable.entityType, entityType),
        eq(crmEntitySyncSettingsTable.direction, "outbound"),
      ),
    );

  if (setting && !setting.enabled) {
    return;
  }

  const connector = getConnector(connection.provider);
  const credentials = {
    apiKey: connection.apiKeyEncrypted ? decryptSecret(connection.apiKeyEncrypted) : undefined,
    orgId: connection.orgId,
    accountName: connection.accountName,
  };

  let result: { ok: boolean; message?: string };
  try {
    result = await connector.push(credentials, { entityType, direction: "outbound", entityRef, data });
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
  }

  await db.insert(crmSyncLogsTable).values({
    siteId,
    provider: connection.provider,
    entityType,
    direction: "outbound",
    status: result.ok ? "success" : "failed",
    entityRef: entityRef ?? null,
    message: result.message ?? null,
    attempt: 1,
  });

  if (result.ok) {
    await db.update(crmConnectionsTable).set({ lastSyncAt: new Date() }).where(eq(crmConnectionsTable.id, connection.id));
  }
}

export async function retrySyncLog(logId: number, siteId: number) {
  const [log] = await db
    .select()
    .from(crmSyncLogsTable)
    .where(and(eq(crmSyncLogsTable.id, logId), eq(crmSyncLogsTable.siteId, siteId)));
  if (!log) {
    return null;
  }

  const [connection] = await db
    .select()
    .from(crmConnectionsTable)
    .where(and(eq(crmConnectionsTable.siteId, siteId), eq(crmConnectionsTable.provider, log.provider)));

  if (!connection || connection.status !== "connected") {
    const [failedLog] = await db
      .insert(crmSyncLogsTable)
      .values({
        siteId,
        provider: log.provider,
        entityType: log.entityType,
        direction: log.direction,
        status: "failed",
        entityRef: log.entityRef,
        message: "CRM connection is not active",
        attempt: log.attempt + 1,
      })
      .returning();
    return failedLog;
  }

  const connector = getConnector(connection.provider);
  const credentials = {
    apiKey: connection.apiKeyEncrypted ? decryptSecret(connection.apiKeyEncrypted) : undefined,
    orgId: connection.orgId,
    accountName: connection.accountName,
  };

  let result: { ok: boolean; message?: string };
  try {
    result = await connector.push(credentials, {
      entityType: log.entityType,
      direction: log.direction,
      entityRef: log.entityRef ?? undefined,
      data: {},
    });
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
  }

  const [newLog] = await db
    .insert(crmSyncLogsTable)
    .values({
      siteId,
      provider: log.provider,
      entityType: log.entityType,
      direction: log.direction,
      status: result.ok ? "success" : "failed",
      entityRef: log.entityRef,
      message: result.message ?? null,
      attempt: log.attempt + 1,
    })
    .returning();

  return newLog;
}
