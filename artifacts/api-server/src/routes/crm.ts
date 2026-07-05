import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  crmConnectionsTable,
  crmEntitySyncSettingsTable,
  crmSyncLogsTable,
  type CrmConnection,
} from "@workspace/db";
import {
  DispatchCrmSyncEventParams,
  DispatchCrmSyncEventBody,
  GetCrmConnectionParams,
  GetCrmConnectionResponse,
  UpdateCrmConnectionParams,
  UpdateCrmConnectionBody,
  UpdateCrmConnectionResponse,
  DisconnectCrmConnectionParams,
  DisconnectCrmConnectionResponse,
  TestCrmConnectionParams,
  TestCrmConnectionResponse,
  LaunchCrmSsoParams,
  LaunchCrmSsoResponse,
  ListCrmEntitySettingsParams,
  ListCrmEntitySettingsResponse,
  UpdateCrmEntitySettingParams,
  UpdateCrmEntitySettingBody,
  UpdateCrmEntitySettingResponse,
  ListCrmSyncLogsParams,
  ListCrmSyncLogsResponse,
  RetryCrmSyncLogParams,
  RetryCrmSyncLogResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, adminRoles } from "../lib/rbac";
import { encryptSecret, decryptSecret, last4 } from "../crm/crypto";
import { getConnector } from "../crm/registry";
import { dispatchCrmSync, retrySyncLog } from "../crm/sync";

const router: IRouter = Router();

function toConnectionResponse(connection: CrmConnection) {
  return {
    id: connection.id,
    siteId: connection.siteId,
    provider: connection.provider,
    status: connection.status,
    authMethod: connection.authMethod,
    accountName: connection.accountName,
    orgId: connection.orgId,
    apiKeyLast4: connection.apiKeyEncrypted ? last4(decryptSecret(connection.apiKeyEncrypted)) : null,
    ssoEnabled: connection.ssoEnabled,
    apiHealth: connection.apiHealth,
    lastHealthCheckAt: connection.lastHealthCheckAt ?? null,
    lastSyncAt: connection.lastSyncAt ?? null,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

async function getOrCreateConnection(siteId: number): Promise<CrmConnection> {
  const [existing] = await db.select().from(crmConnectionsTable).where(eq(crmConnectionsTable.siteId, siteId));
  if (existing) return existing;
  const [created] = await db.insert(crmConnectionsTable).values({ siteId, provider: "operon" }).returning();
  return created;
}

router.post("/sites/:siteId/crm-sync-events", async (req, res): Promise<void> => {
  const params = DispatchCrmSyncEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = DispatchCrmSyncEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await dispatchCrmSync({
    siteId: params.data.siteId,
    entityType: parsed.data.entityType,
    entityRef: parsed.data.entityRef,
    data: parsed.data.data,
  });
  res.status(202).json({ accepted: true });
});

router.get(
  "/sites/:siteId/crm-connection",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetCrmConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const connection = await getOrCreateConnection(params.data.siteId);
    res.json(GetCrmConnectionResponse.parse(toConnectionResponse(connection)));
  },
);

router.put(
  "/sites/:siteId/crm-connection",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = UpdateCrmConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCrmConnectionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await getOrCreateConnection(params.data.siteId);
    const { apiKey, ...rest } = parsed.data;
    const nextApiKeyEncrypted = apiKey ? encryptSecret(apiKey) : existing.apiKeyEncrypted;
    const hasCredentials = Boolean(nextApiKeyEncrypted || rest.ssoEnabled);
    const [connection] = await db
      .update(crmConnectionsTable)
      .set({
        ...rest,
        apiKeyEncrypted: nextApiKeyEncrypted,
        status: hasCredentials ? "connected" : "not_connected",
      })
      .where(eq(crmConnectionsTable.id, existing.id))
      .returning();
    res.json(UpdateCrmConnectionResponse.parse(toConnectionResponse(connection)));
  },
);

router.delete(
  "/sites/:siteId/crm-connection",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = DisconnectCrmConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const existing = await getOrCreateConnection(params.data.siteId);
    const [connection] = await db
      .update(crmConnectionsTable)
      .set({
        status: "not_connected",
        apiKeyEncrypted: null,
        accountName: null,
        orgId: null,
        ssoEnabled: false,
        apiHealth: "unknown",
      })
      .where(eq(crmConnectionsTable.id, existing.id))
      .returning();
    res.json(DisconnectCrmConnectionResponse.parse(toConnectionResponse(connection)));
  },
);

router.post(
  "/sites/:siteId/crm-connection/test",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = TestCrmConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const existing = await getOrCreateConnection(params.data.siteId);
    const connector = getConnector(existing.provider);
    const result = await connector.testConnection({
      apiKey: existing.apiKeyEncrypted ? decryptSecret(existing.apiKeyEncrypted) : undefined,
      orgId: existing.orgId,
      accountName: existing.accountName,
    });
    const [connection] = await db
      .update(crmConnectionsTable)
      .set({
        apiHealth: result.healthy ? "healthy" : "down",
        lastHealthCheckAt: new Date(),
        status: result.healthy ? "connected" : existing.status === "connected" ? "error" : existing.status,
      })
      .where(eq(crmConnectionsTable.id, existing.id))
      .returning();
    res.json(TestCrmConnectionResponse.parse(toConnectionResponse(connection)));
  },
);

router.post(
  "/sites/:siteId/crm-connection/sso-launch",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = LaunchCrmSsoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const existing = await getOrCreateConnection(params.data.siteId);
    const connector = getConnector(existing.provider);
    res.json(LaunchCrmSsoResponse.parse(connector.buildSsoLaunchUrl(existing)));
  },
);

router.get(
  "/sites/:siteId/crm-entity-settings",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListCrmEntitySettingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const settings = await db
      .select()
      .from(crmEntitySyncSettingsTable)
      .where(eq(crmEntitySyncSettingsTable.siteId, params.data.siteId));
    res.json(ListCrmEntitySettingsResponse.parse(settings));
  },
);

router.put(
  "/sites/:siteId/crm-entity-settings",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = UpdateCrmEntitySettingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCrmEntitySettingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const connection = await getOrCreateConnection(params.data.siteId);
    const [existingSetting] = await db
      .select()
      .from(crmEntitySyncSettingsTable)
      .where(
        and(
          eq(crmEntitySyncSettingsTable.siteId, params.data.siteId),
          eq(crmEntitySyncSettingsTable.provider, connection.provider),
          eq(crmEntitySyncSettingsTable.entityType, parsed.data.entityType),
          eq(crmEntitySyncSettingsTable.direction, parsed.data.direction),
        ),
      );
    const [setting] = existingSetting
      ? await db
          .update(crmEntitySyncSettingsTable)
          .set({ enabled: parsed.data.enabled })
          .where(eq(crmEntitySyncSettingsTable.id, existingSetting.id))
          .returning()
      : await db
          .insert(crmEntitySyncSettingsTable)
          .values({ siteId: params.data.siteId, provider: connection.provider, ...parsed.data })
          .returning();
    res.json(UpdateCrmEntitySettingResponse.parse(setting));
  },
);

router.get(
  "/sites/:siteId/crm-sync-logs",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListCrmSyncLogsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const logs = await db
      .select()
      .from(crmSyncLogsTable)
      .where(eq(crmSyncLogsTable.siteId, params.data.siteId))
      .orderBy(desc(crmSyncLogsTable.createdAt))
      .limit(100);
    res.json(ListCrmSyncLogsResponse.parse(logs));
  },
);

router.post(
  "/sites/:siteId/crm-sync-logs/:logId/retry",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = RetryCrmSyncLogParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const newLog = await retrySyncLog(params.data.logId, params.data.siteId);
    if (!newLog) {
      res.status(404).json({ error: "Sync log not found" });
      return;
    }
    res.json(RetryCrmSyncLogResponse.parse(newLog));
  },
);

export default router;
