import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
import {
  ListEventsParams,
  ListEventsResponse,
  CreateEventParams,
  CreateEventBody,
  GetEventParams,
  GetEventResponse,
  UpdateEventParams,
  UpdateEventBody,
  UpdateEventResponse,
  DeleteEventParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, trainingRoles } from "../lib/rbac";
import { logActivity } from "../lib/activityLog";
import { recordVersion } from "../lib/contentVersions";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/events",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListEventsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const events = await db.select().from(eventsTable).where(eq(eventsTable.siteId, params.data.siteId));
    res.json(ListEventsResponse.parse(events));
  },
);

router.post(
  "/sites/:siteId/events",
  requireAuth,
  requireSiteRole(...trainingRoles),
  async (req, res): Promise<void> => {
    const params = CreateEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [event] = await db
      .insert(eventsTable)
      .values({ siteId: params.data.siteId, ...parsed.data })
      .returning();
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "created",
      entityType: "event",
      entityId: event.id,
      page: "Events",
      newValue: event,
    });
    await recordVersion({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      entityType: "event",
      entityId: event.id,
      snapshot: event,
    });
    res.status(201).json(GetEventResponse.parse(event));
  },
);

router.get(
  "/sites/:siteId/events/:eventId",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.siteId, params.data.siteId), eq(eventsTable.id, params.data.eventId)));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(GetEventResponse.parse(event));
  },
);

router.patch(
  "/sites/:siteId/events/:eventId",
  requireAuth,
  requireSiteRole(...trainingRoles),
  async (req, res): Promise<void> => {
    const params = UpdateEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.siteId, params.data.siteId), eq(eventsTable.id, params.data.eventId)));
    const [event] = await db
      .update(eventsTable)
      .set(parsed.data)
      .where(and(eq(eventsTable.siteId, params.data.siteId), eq(eventsTable.id, params.data.eventId)))
      .returning();
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "updated",
      entityType: "event",
      entityId: event.id,
      page: "Events",
      previousValue: existing,
      newValue: event,
    });
    await recordVersion({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      entityType: "event",
      entityId: event.id,
      snapshot: event,
    });
    res.json(UpdateEventResponse.parse(event));
  },
);

router.delete(
  "/sites/:siteId/events/:eventId",
  requireAuth,
  requireSiteRole(...trainingRoles),
  async (req, res): Promise<void> => {
    const params = DeleteEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [event] = await db
      .delete(eventsTable)
      .where(and(eq(eventsTable.siteId, params.data.siteId), eq(eventsTable.id, params.data.eventId)))
      .returning();
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "deleted",
      entityType: "event",
      entityId: event.id,
      page: "Events",
      previousValue: event,
    });
    res.sendStatus(204);
  },
);

export default router;
