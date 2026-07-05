import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, squareConfigTable, squareCatalogMappingsTable } from "@workspace/db";
import {
  GetSquareConfigParams,
  GetSquareConfigResponse,
  UpdateSquareConfigParams,
  UpdateSquareConfigBody,
  UpdateSquareConfigResponse,
  ListSquareCatalogMappingsParams,
  ListSquareCatalogMappingsResponse,
  CreateSquareCatalogMappingParams,
  CreateSquareCatalogMappingBody,
  UpdateSquareCatalogMappingParams,
  UpdateSquareCatalogMappingBody,
  UpdateSquareCatalogMappingResponse,
  DeleteSquareCatalogMappingParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, adminRoles } from "../lib/rbac";

const router: IRouter = Router();

function toConfigResponse(siteId: number, config?: typeof squareConfigTable.$inferSelect) {
  return {
    siteId,
    connected: config?.connected ?? false,
    environment: config?.environment ?? "sandbox",
    applicationIdLast4: config?.applicationId ? config.applicationId.slice(-4) : null,
    locationId: config?.locationId ?? null,
    checkoutEnabled: config?.checkoutEnabled ?? false,
    updatedAt: config?.updatedAt ?? new Date(),
  };
}

router.get(
  "/sites/:siteId/square-config",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetSquareConfigParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [config] = await db.select().from(squareConfigTable).where(eq(squareConfigTable.siteId, params.data.siteId));
    res.json(GetSquareConfigResponse.parse(toConfigResponse(params.data.siteId, config)));
  },
);

router.put(
  "/sites/:siteId/square-config",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = UpdateSquareConfigParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateSquareConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(squareConfigTable)
      .where(eq(squareConfigTable.siteId, params.data.siteId));

    const connected = Boolean(parsed.data.applicationId && parsed.data.locationId && parsed.data.accessToken);
    const values = { ...parsed.data, connected };

    const [config] = existing
      ? await db
          .update(squareConfigTable)
          .set(values)
          .where(eq(squareConfigTable.siteId, params.data.siteId))
          .returning()
      : await db
          .insert(squareConfigTable)
          .values({ siteId: params.data.siteId, ...values })
          .returning();

    res.json(UpdateSquareConfigResponse.parse(toConfigResponse(params.data.siteId, config)));
  },
);

router.get(
  "/sites/:siteId/square-catalog-mappings",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListSquareCatalogMappingsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const mappings = await db
      .select()
      .from(squareCatalogMappingsTable)
      .where(eq(squareCatalogMappingsTable.siteId, params.data.siteId));
    res.json(ListSquareCatalogMappingsResponse.parse(mappings));
  },
);

router.post(
  "/sites/:siteId/square-catalog-mappings",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = CreateSquareCatalogMappingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateSquareCatalogMappingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [mapping] = await db
      .insert(squareCatalogMappingsTable)
      .values({ siteId: params.data.siteId, ...parsed.data })
      .returning();
    res.status(201).json(mapping);
  },
);

router.patch(
  "/sites/:siteId/square-catalog-mappings/:mappingId",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = UpdateSquareCatalogMappingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateSquareCatalogMappingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [mapping] = await db
      .update(squareCatalogMappingsTable)
      .set(parsed.data)
      .where(
        and(
          eq(squareCatalogMappingsTable.siteId, params.data.siteId),
          eq(squareCatalogMappingsTable.id, params.data.mappingId),
        ),
      )
      .returning();
    if (!mapping) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }
    res.json(UpdateSquareCatalogMappingResponse.parse(mapping));
  },
);

router.delete(
  "/sites/:siteId/square-catalog-mappings/:mappingId",
  requireAuth,
  requireSiteRole(...adminRoles),
  async (req, res): Promise<void> => {
    const params = DeleteSquareCatalogMappingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [mapping] = await db
      .delete(squareCatalogMappingsTable)
      .where(
        and(
          eq(squareCatalogMappingsTable.siteId, params.data.siteId),
          eq(squareCatalogMappingsTable.id, params.data.mappingId),
        ),
      )
      .returning();
    if (!mapping) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
