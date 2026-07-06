import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coursesTable } from "@workspace/db";
import {
  ListCoursesParams,
  ListCoursesResponse,
  CreateCourseParams,
  CreateCourseBody,
  GetCourseParams,
  GetCourseResponse,
  UpdateCourseParams,
  UpdateCourseBody,
  UpdateCourseResponse,
  DeleteCourseParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, trainingRoles } from "../lib/rbac";
import { logActivity } from "../lib/activityLog";
import { recordVersion } from "../lib/contentVersions";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/courses",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListCoursesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const courses = await db.select().from(coursesTable).where(eq(coursesTable.siteId, params.data.siteId));
    res.json(ListCoursesResponse.parse(courses));
  },
);

router.post(
  "/sites/:siteId/courses",
  requireAuth,
  requireSiteRole(...trainingRoles),
  async (req, res): Promise<void> => {
    const params = CreateCourseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateCourseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [course] = await db
      .insert(coursesTable)
      .values({ siteId: params.data.siteId, ...parsed.data })
      .returning();
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "created",
      entityType: "course",
      entityId: course.id,
      page: "Courses",
      newValue: course,
    });
    await recordVersion({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      entityType: "course",
      entityId: course.id,
      snapshot: course,
    });
    res.status(201).json(GetCourseResponse.parse(course));
  },
);

router.get(
  "/sites/:siteId/courses/:courseId",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetCourseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [course] = await db
      .select()
      .from(coursesTable)
      .where(and(eq(coursesTable.siteId, params.data.siteId), eq(coursesTable.id, params.data.courseId)));
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(GetCourseResponse.parse(course));
  },
);

router.patch(
  "/sites/:siteId/courses/:courseId",
  requireAuth,
  requireSiteRole(...trainingRoles),
  async (req, res): Promise<void> => {
    const params = UpdateCourseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCourseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(coursesTable)
      .where(and(eq(coursesTable.siteId, params.data.siteId), eq(coursesTable.id, params.data.courseId)));
    const [course] = await db
      .update(coursesTable)
      .set(parsed.data)
      .where(and(eq(coursesTable.siteId, params.data.siteId), eq(coursesTable.id, params.data.courseId)))
      .returning();
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "updated",
      entityType: "course",
      entityId: course.id,
      page: "Courses",
      previousValue: existing,
      newValue: course,
    });
    await recordVersion({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      entityType: "course",
      entityId: course.id,
      snapshot: course,
    });
    res.json(UpdateCourseResponse.parse(course));
  },
);

router.delete(
  "/sites/:siteId/courses/:courseId",
  requireAuth,
  requireSiteRole(...trainingRoles),
  async (req, res): Promise<void> => {
    const params = DeleteCourseParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [course] = await db
      .delete(coursesTable)
      .where(and(eq(coursesTable.siteId, params.data.siteId), eq(coursesTable.id, params.data.courseId)))
      .returning();
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "deleted",
      entityType: "course",
      entityId: course.id,
      page: "Courses",
      previousValue: course,
    });
    res.sendStatus(204);
  },
);

export default router;
