/**
 * rbac-permission-enforcement.test.ts
 *
 * Smoke-tests the RBAC permission constants and role-to-permission mapping
 * that are enforced server-side by convex/lib/requirePermission.ts.
 *
 * Key assertions:
 * 1. Design-tier permissions (design.manage etc.) are NEVER granted to any
 *    client role — a non-superAdmin caller always receives Unauthorized.
 * 2. Content roles receive the correct content/media/events/classes permissions.
 * 3. Restricted roles (finance, support, read_only) cannot write content.
 * 4. The frontend mirror (src/lib/permissions.ts) exports the same constants.
 * 5. userHasPermission() correctly gates superAdmin vs non-superAdmin.
 */

import { describe, it, expect } from "vitest";
import {
  PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
  userHasPermission,
} from "@/lib/permissions";
import {
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "@/lib/roleCapabilities";

// ── 1. Design-tier permissions are superAdmin-only ──────────────────────────

describe("SUPERADMIN_ONLY_PERMISSIONS", () => {
  const designPermissions = [
    PERMISSIONS.DESIGN_MANAGE,
    PERMISSIONS.LAYOUT_MANAGE,
    PERMISSIONS.CODE_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.DEPLOYMENT_MANAGE,
  ];

  it("contains all five design-tier constants", () => {
    for (const p of designPermissions) {
      expect(SUPERADMIN_ONLY_PERMISSIONS.has(p)).toBe(true);
    }
  });

  it("does NOT contain content/media/scheduling permissions", () => {
    const clientPermissions = [
      PERMISSIONS.CONTENT_VIEW,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.CONTENT_DELETE,
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.MEDIA_UPLOAD,
      PERMISSIONS.MEDIA_DELETE,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.CLASSES_MANAGE,
    ];
    for (const p of clientPermissions) {
      expect(SUPERADMIN_ONLY_PERMISSIONS.has(p)).toBe(false);
    }
  });
});

// ── 2. No client role holds a design-tier permission ───────────────────────

describe("roleHasPermission — design-tier is always denied for client roles", () => {
  const allClientRoles = Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>;
  const designPermissions = [
    PERMISSIONS.DESIGN_MANAGE,
    PERMISSIONS.LAYOUT_MANAGE,
    PERMISSIONS.CODE_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.DEPLOYMENT_MANAGE,
  ];

  for (const role of allClientRoles) {
    for (const perm of designPermissions) {
      it(`${role} cannot hold '${perm}'`, () => {
        expect(roleHasPermission(role, perm)).toBe(false);
      });
    }
  }
});

// ── 3. Content roles hold the expected content permissions ─────────────────

describe("roleHasPermission — content/media permissions for content roles", () => {
  it("owner holds all content permissions", () => {
    expect(roleHasPermission("owner", PERMISSIONS.CONTENT_CREATE)).toBe(true);
    expect(roleHasPermission("owner", PERMISSIONS.CONTENT_UPDATE)).toBe(true);
    expect(roleHasPermission("owner", PERMISSIONS.CONTENT_DELETE)).toBe(true);
    expect(roleHasPermission("owner", PERMISSIONS.MEDIA_UPLOAD)).toBe(true);
    expect(roleHasPermission("owner", PERMISSIONS.MEDIA_DELETE)).toBe(true);
    expect(roleHasPermission("owner", PERMISSIONS.EVENTS_MANAGE)).toBe(true);
    expect(roleHasPermission("owner", PERMISSIONS.CLASSES_MANAGE)).toBe(true);
  });

  it("course_manager holds CLASSES_MANAGE but NOT EVENTS_MANAGE or CONTENT_CREATE", () => {
    expect(roleHasPermission("course_manager", PERMISSIONS.CLASSES_MANAGE)).toBe(true);
    expect(roleHasPermission("course_manager", PERMISSIONS.EVENTS_MANAGE)).toBe(false);
    expect(roleHasPermission("course_manager", PERMISSIONS.CONTENT_CREATE)).toBe(false);
  });

  it("events_manager holds EVENTS_MANAGE but NOT CLASSES_MANAGE or CONTENT_CREATE", () => {
    expect(roleHasPermission("events_manager", PERMISSIONS.EVENTS_MANAGE)).toBe(true);
    expect(roleHasPermission("events_manager", PERMISSIONS.CLASSES_MANAGE)).toBe(false);
    expect(roleHasPermission("events_manager", PERMISSIONS.CONTENT_CREATE)).toBe(false);
  });
});

// ── 4. Read-only/restricted roles cannot write ─────────────────────────────

describe("roleHasPermission — restricted roles cannot write content", () => {
  const restrictedRoles = ["finance", "support", "read_only"] as const;
  const writePermissions = [
    PERMISSIONS.CONTENT_CREATE,
    PERMISSIONS.CONTENT_UPDATE,
    PERMISSIONS.CONTENT_DELETE,
    PERMISSIONS.MEDIA_UPLOAD,
    PERMISSIONS.MEDIA_DELETE,
  ];

  for (const role of restrictedRoles) {
    for (const perm of writePermissions) {
      it(`${role} is denied '${perm}'`, () => {
        expect(roleHasPermission(role, perm)).toBe(false);
      });
    }
  }
});

// ── 5. userHasPermission — superAdmin bypasses everything ──────────────────

describe("userHasPermission", () => {
  it("superAdmin receives every permission including design-tier", () => {
    for (const perm of Object.values(PERMISSIONS)) {
      expect(userHasPermission(true, perm)).toBe(true);
    }
  });

  it("non-superAdmin is denied design-tier permissions", () => {
    expect(userHasPermission(false, PERMISSIONS.DESIGN_MANAGE)).toBe(false);
    expect(userHasPermission(false, PERMISSIONS.LAYOUT_MANAGE)).toBe(false);
    expect(userHasPermission(false, PERMISSIONS.CODE_MANAGE)).toBe(false);
    expect(userHasPermission(false, PERMISSIONS.INTEGRATIONS_MANAGE)).toBe(false);
    expect(userHasPermission(false, PERMISSIONS.DEPLOYMENT_MANAGE)).toBe(false);
  });

  it("non-superAdmin is allowed content-tier permissions", () => {
    expect(userHasPermission(false, PERMISSIONS.CONTENT_CREATE)).toBe(true);
    expect(userHasPermission(false, PERMISSIONS.MEDIA_UPLOAD)).toBe(true);
    expect(userHasPermission(false, PERMISSIONS.EVENTS_MANAGE)).toBe(true);
  });
});

// ── 6. PERMISSIONS constants are stable string literals ────────────────────

describe("PERMISSIONS string values", () => {
  it("matches the expected dot-notation strings", () => {
    expect(PERMISSIONS.CONTENT_VIEW).toBe("content.view");
    expect(PERMISSIONS.CONTENT_CREATE).toBe("content.create");
    expect(PERMISSIONS.CONTENT_UPDATE).toBe("content.update");
    expect(PERMISSIONS.CONTENT_DELETE).toBe("content.delete");
    expect(PERMISSIONS.MEDIA_VIEW).toBe("media.view");
    expect(PERMISSIONS.MEDIA_UPLOAD).toBe("media.upload");
    expect(PERMISSIONS.MEDIA_DELETE).toBe("media.delete");
    expect(PERMISSIONS.EVENTS_MANAGE).toBe("events.manage");
    expect(PERMISSIONS.CLASSES_MANAGE).toBe("classes.manage");
    expect(PERMISSIONS.DESIGN_MANAGE).toBe("design.manage");
    expect(PERMISSIONS.LAYOUT_MANAGE).toBe("layout.manage");
    expect(PERMISSIONS.CODE_MANAGE).toBe("code.manage");
    expect(PERMISSIONS.INTEGRATIONS_MANAGE).toBe("integrations.manage");
    expect(PERMISSIONS.DEPLOYMENT_MANAGE).toBe("deployment.manage");
  });
});
