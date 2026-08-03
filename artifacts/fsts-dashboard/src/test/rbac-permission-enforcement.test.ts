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
  ROLES,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "@/lib/roleCapabilities";
import {
  PERMISSION_LABELS,
  PERMISSION_CATEGORIES,
} from "@/components/RolePermissionsPanel";

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

// ── 6. PERMISSION_LABELS covers every Permission value ─────────────────────

describe("PERMISSION_LABELS completeness", () => {
  it("has a label for every Permission constant", () => {
    const allPermissions = Object.values(PERMISSIONS);
    for (const perm of allPermissions) {
      expect(
        Object.prototype.hasOwnProperty.call(PERMISSION_LABELS, perm),
        `PERMISSION_LABELS is missing an entry for '${perm}'`,
      ).toBe(true);
      expect(
        PERMISSION_LABELS[perm as keyof typeof PERMISSION_LABELS],
        `PERMISSION_LABELS['${perm}'] must be a non-empty string`,
      ).toBeTruthy();
    }
  });

  it("does not contain labels for permissions that no longer exist", () => {
    const allPermissions = new Set(Object.values(PERMISSIONS));
    for (const key of Object.keys(PERMISSION_LABELS)) {
      expect(
        allPermissions.has(key as (typeof PERMISSIONS)[keyof typeof PERMISSIONS]),
        `PERMISSION_LABELS has a stale key '${key}' not in PERMISSIONS`,
      ).toBe(true);
    }
  });
});

// ── 7. Every Role appears in ROLE_PERMISSIONS ──────────────────────────────

describe("ROLE_PERMISSIONS completeness", () => {
  it("has an entry for every role in ROLES", () => {
    for (const role of ROLES) {
      expect(
        Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role),
        `ROLE_PERMISSIONS is missing an entry for role '${role}'`,
      ).toBe(true);
      expect(
        Array.isArray(ROLE_PERMISSIONS[role]),
        `ROLE_PERMISSIONS['${role}'] must be an array`,
      ).toBe(true);
    }
  });

  it("does not contain entries for roles that no longer exist in ROLES", () => {
    const rolesSet = new Set<string>(ROLES);
    for (const key of Object.keys(ROLE_PERMISSIONS)) {
      expect(
        rolesSet.has(key),
        `ROLE_PERMISSIONS has a stale key '${key}' not in ROLES`,
      ).toBe(true);
    }
  });
});

// ── 8. PERMISSION_CATEGORIES union covers every non-superAdmin permission ──

describe("PERMISSION_CATEGORIES completeness", () => {
  it("union of all category permissions equals the full non-superAdmin PERMISSIONS set", () => {
    const nonAdminPermissions = new Set(
      Object.values(PERMISSIONS).filter((p) => !SUPERADMIN_ONLY_PERMISSIONS.has(p)),
    );

    const categorisedPermissions = new Set(
      PERMISSION_CATEGORIES.flatMap((cat) => cat.permissions),
    );

    // Every non-superAdmin permission must appear in at least one category
    for (const perm of nonAdminPermissions) {
      expect(
        categorisedPermissions.has(perm),
        `PERMISSION_CATEGORIES does not include '${perm}'`,
      ).toBe(true);
    }

    // Every categorised permission must be a real non-superAdmin permission
    for (const perm of categorisedPermissions) {
      if (!SUPERADMIN_ONLY_PERMISSIONS.has(perm)) {
        expect(
          nonAdminPermissions.has(perm),
          `PERMISSION_CATEGORIES contains unknown permission '${perm}'`,
        ).toBe(true);
      }
    }
  });

  it("superAdmin-only permissions appear only in adminOnly categories", () => {
    for (const cat of PERMISSION_CATEGORIES) {
      for (const perm of cat.permissions) {
        if (SUPERADMIN_ONLY_PERMISSIONS.has(perm)) {
          expect(
            cat.adminOnly,
            `Permission '${perm}' is superAdmin-only but placed in a non-adminOnly category '${cat.label}'`,
          ).toBe(true);
        }
      }
    }
  });
});

// ── 9. PERMISSIONS constants are stable string literals ────────────────────

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
