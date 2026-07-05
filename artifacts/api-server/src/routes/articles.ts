import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, articlesTable } from "@workspace/db";
import {
  ListArticlesParams,
  ListArticlesResponse,
  CreateArticleParams,
  CreateArticleBody,
  GetArticleParams,
  GetArticleResponse,
  UpdateArticleParams,
  UpdateArticleBody,
  UpdateArticleResponse,
  DeleteArticleParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { requireSiteRole, anySiteRole, marketingRoles } from "../lib/rbac";
import { logActivity } from "../lib/activityLog";

const router: IRouter = Router();

router.get(
  "/sites/:siteId/articles",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = ListArticlesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const articles = await db.select().from(articlesTable).where(eq(articlesTable.siteId, params.data.siteId));
    res.json(ListArticlesResponse.parse(articles));
  },
);

router.post(
  "/sites/:siteId/articles",
  requireAuth,
  requireSiteRole(...marketingRoles),
  async (req, res): Promise<void> => {
    const params = CreateArticleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = CreateArticleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [article] = await db
      .insert(articlesTable)
      .values({ siteId: params.data.siteId, ...parsed.data })
      .returning();
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "created",
      entityType: "article",
      entityId: article.id,
      page: "Articles",
      newValue: article,
    });
    res.status(201).json(GetArticleResponse.parse(article));
  },
);

router.get(
  "/sites/:siteId/articles/:articleId",
  requireAuth,
  requireSiteRole(...anySiteRole),
  async (req, res): Promise<void> => {
    const params = GetArticleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [article] = await db
      .select()
      .from(articlesTable)
      .where(and(eq(articlesTable.siteId, params.data.siteId), eq(articlesTable.id, params.data.articleId)));
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.json(GetArticleResponse.parse(article));
  },
);

router.patch(
  "/sites/:siteId/articles/:articleId",
  requireAuth,
  requireSiteRole(...marketingRoles),
  async (req, res): Promise<void> => {
    const params = UpdateArticleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateArticleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(articlesTable)
      .where(and(eq(articlesTable.siteId, params.data.siteId), eq(articlesTable.id, params.data.articleId)));
    const [article] = await db
      .update(articlesTable)
      .set(parsed.data)
      .where(and(eq(articlesTable.siteId, params.data.siteId), eq(articlesTable.id, params.data.articleId)))
      .returning();
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "updated",
      entityType: "article",
      entityId: article.id,
      page: "Articles",
      previousValue: existing,
      newValue: article,
    });
    res.json(UpdateArticleResponse.parse(article));
  },
);

router.delete(
  "/sites/:siteId/articles/:articleId",
  requireAuth,
  requireSiteRole(...marketingRoles),
  async (req, res): Promise<void> => {
    const params = DeleteArticleParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [article] = await db
      .delete(articlesTable)
      .where(and(eq(articlesTable.siteId, params.data.siteId), eq(articlesTable.id, params.data.articleId)))
      .returning();
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    await logActivity({
      siteId: params.data.siteId,
      actor: req.dashboardUser,
      action: "deleted",
      entityType: "article",
      entityId: article.id,
      page: "Articles",
      previousValue: article,
    });
    res.sendStatus(204);
  },
);

export default router;
