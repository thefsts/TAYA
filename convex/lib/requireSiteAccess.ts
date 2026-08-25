import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { CurrentUser, provisionUser } from "./getCurrentUser";
import {
  ROLE_CAPABILITIES,
  type Role,
  type DashboardModule,
  type PermissionLevel,
  PERMISSION_LEVELS,
} from "./roleCapabilities";

/**
 * All roles that can perform write mutations on a site by default.
 * Legacy roles kept for backward compat; new Phase 9 roles derived from
 * the capability matrix (any role with at least one edit/manage module).
 *
 * internal_qa is an FSTS-only operational role. It is deliberately NOT a
 * client Owner role, but receives owner-equivalent site-tool access so FSTS
 * can run controlled QA against a client tenant without impersonating the
 * client's Clerk account. Design-tier mutations remain superadmin-only.
 */
const WRITE_ROLES = new Set([
  // Legacy roles
  "client_admin",
  "site_admin",
  "admin",
  "editor",
  "content_editor",
  "manager",
  "marketing_manager",
  "training_manager",
  // FSTS operational role
  "internal_qa",
  // Phase 9 roles with write capabilities
  "owner",
  "marketing",
  "course_manager",
  "events_manager",
  "finance",
  "support",
]);

function permissionAtLeast(a: PermissionLevel, b: PermissionLevel): boolean {
  return PERMISSION_LEVELS.indexOf(a) >= PERMISSION_LEVELS.indexOf(b);
}

/**
 * Look up effective permission level for a user role on a module,
 * accounting for any site-level overrides.
 */
async function effectiveLevel(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
  role: string,
  module: DashboardModule,
): Promise<PermissionLevel> {
  const overrideRows = await ctx.db
    .query("siteRoleOverrides")
    .withIndex("by_site_role", (q) => q.eq("siteId", siteId).eq("role", role))
    .collect();
  const override = overrideRows.find((r) => r.module === module);
  if (override) return override.level as PermissionLevel;

  // FSTS Internal QA uses the same client-facing module capability level as
  // Owner, but stays a distinct role in user records and audit logs.
  const capabilityRole = role === "internal_qa" ? "owner" : role;
  const caps = ROLE_CAPABILITIES[capabilityRole as Role];
  if (!caps) return "none";
  return caps[module] ?? "none";
}

export async function checkSiteAccess(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user || !user.isActive) return false;
  if (user.isSuperAdmin) return true;
  return user.roles.some((r: any) => r.siteId === siteId);
}

/**
 * Check if the authenticated user has at least `requiredLevel` access to
 * a specific module on a site. Superadmins always pass.
 */
export async function checkModuleAccess(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
  module: DashboardModule,
  requiredLevel: PermissionLevel = "view",
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
    .first();
  if (!user || !user.isActive) return false;
  if (user.isSuperAdmin) return true;
  const siteRoles = user.roles.filter((r: any) => r.siteId === siteId);
  if (siteRoles.length === 0) return false;
  for (const r of siteRoles) {
    const level = await effectiveLevel(ctx, siteId, r.role, module);
    if (permissionAtLeast(level, requiredLevel)) return true;
  }
  return false;
}

export async function requireSiteAccessMutation(
  ctx: MutationCtx,
  siteId: Id<"sites">,
): Promise<CurrentUser> {
  const user = await provisionUser(ctx);
  if (!user.isActive) throw new Error("Account is deactivated");
  if (user.isSuperAdmin) return user;
  const hasWriteAccess = user.roles.some(
    (r: any) => r.siteId === siteId && WRITE_ROLES.has(r.role),
  );
  if (!hasWriteAccess) throw new Error("Forbidden: write access required");
  return user;
}

/**
 * Require at least `requiredLevel` on a module. Throws if not permitted.
 */
export async function requireModuleAccess(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  module: DashboardModule,
  requiredLevel: PermissionLevel = "edit",
): Promise<CurrentUser> {
  const user = await provisionUser(ctx);
  if (!user.isActive) throw new Error("Account is deactivated");
  if (user.isSuperAdmin) return user;
  const siteRoles = user.roles.filter((r: any) => r.siteId === siteId);
  if (siteRoles.length === 0) throw new Error("Forbidden: no site access");
  for (const r of siteRoles) {
    const level = await effectiveLevel(ctx, siteId, r.role, module);
    if (permissionAtLeast(level, requiredLevel)) return user;
  }
  throw new Error(`Forbidden: ${requiredLevel} access required for ${module}`);
}

/** Agency feature-flag → module key mapping (mirrors getEffectiveModules in sites.ts) */
const AGENCY_FLAG_TO_MODULES: Record<string, string[]> = {
  crm: ["crm"],
  ecommerce: ["payments", "commerce"],
  forms: ["forms"],
  media: ["media"],
  backups: ["backups"],
  version_history: ["history"],
};

/**
 * Returns false if the given module is disabled on this site (site flag or
 * agency flag/override). Use this in queries that should return empty/null
 * instead of throwing when a module is off.
 */
export async function checkModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
  moduleKey: string,
): Promise<boolean> {
  const site = await ctx.db.get(siteId);
  if (!site) return false;
  const siteModules = (site.enabledModules as Record<string, boolean>) ?? {};
  if (siteModules[moduleKey] === false) return false;
  if (!site.agencyId) return true;
  const agency = await ctx.db.get(site.agencyId as Id<"agencies">);
  if (!agency) return true;
  const agencyFlags = (agency.featureFlags as Record<string, boolean>) ?? {};
  for (const [flag, modules] of Object.entries(AGENCY_FLAG_TO_MODULES)) {
    if (agencyFlags[flag] === false && modules.includes(moduleKey)) return false;
  }
  const agencyModuleOverrides = (agencyFlags as any)._modules as Record<string, boolean> | undefined;
  if (agencyModuleOverrides?.[moduleKey] === false) return false;
  return true;
}

/**
 * Throws if the given module is disabled on this site — either because
 * `site.enabledModules[moduleKey] === false`, or because the site's agency
 * has the corresponding feature flag set to false.
 *
 * Call this inside mutations that should be blocked when a module
 * is disabled, AFTER the caller's site-access check has already passed.
 * Superadmins are not exempt — a disabled module is disabled for everyone.
 */
export async function requireModuleEnabled(
  ctx: QueryCtx | MutationCtx,
  siteId: Id<"sites">,
  moduleKey: string,
): Promise<void> {
  const site = await ctx.db.get(siteId);
  if (!site) throw new Error("Site not found");

  const siteModules = (site.enabledModules as Record<string, boolean>) ?? {};
  if (siteModules[moduleKey] === false) {
    throw new Error(`Module '${moduleKey}' is not enabled for this site`);
  }

  if (!site.agencyId) return;
  const agency = await ctx.db.get(site.agencyId as Id<"agencies">);
  if (!agency) return;

  const agencyFlags = (agency.featureFlags as Record<string, boolean>) ?? {};
  for (const [flag, modules] of Object.entries(AGENCY_FLAG_TO_MODULES)) {
    if (agencyFlags[flag] === false && modules.includes(moduleKey)) {
      throw new Error(`Module '${moduleKey}' is disabled by agency feature flag`);
    }
  }

  // Honor per-module agency overrides stored under featureFlags._modules
  const agencyModuleOverrides = (agencyFlags as any)._modules as Record<string, boolean> | undefined;
  if (agencyModuleOverrides?.[moduleKey] === false) {
    throw new Error(`Module '${moduleKey}' is disabled by agency module override`);
  }
}

/**
 * Enforces the Global Design Lock™ — only FSTS super-admins may mutate
 * design-tier capabilities (navigation, footer, email config, integrations,
 * system settings, and branding). Client-role users are blocked even if they
 * have write access to the site.
 *
 * This intentionally includes internal_qa: QA can exercise normal client
 * workflows but cannot silently cross the FSTS design/engineering boundary.
 */
export async function requireDesignCapability(
  ctx: MutationCtx,
  siteId: Id<"sites">
): Promise<CurrentUser> {
  const user = await requireSiteAccessMutation(ctx, siteId);
  if (!user.isSuperAdmin) {
    throw new Error(
      "Design Lock: this section is managed by FSTS administrators and cannot be modified by client users."
    );
  }
  return user;
}
