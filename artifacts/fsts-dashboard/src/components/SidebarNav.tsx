/**
 * SidebarNav.tsx
 *
 * Phase 2: WordPress-like client sidebar navigation.
 *
 * - Collapsible groups (real <button aria-expanded> toggles) with per-user
 *   localStorage persistence driven by the parent layout (useSidebarUi).
 * - Active item highlight (aria-current="page") plus parent-group highlight
 *   when any of its items or nested submenu items is active. A collapsed
 *   group still reveals its active item(s) so the current page stays visible.
 * - Nested submenus (one level) rendered indented under their parent; the
 *   submenu auto-expands when a child is the active route.
 * - Compact mode: icon rail — groups collapse to icon buttons with tooltips;
 *   expanding a group reveals item icons (each with a label tooltip). Nested
 *   submenu parents navigate directly to their href in compact mode.
 * - Design-locked items keep the TAYA lock affordance + explanatory tooltip
 *   for non-superAdmin clients (superAdmins see a small lock hint instead).
 * - Keyboard accessible: groups are buttons with aria-expanded; items are
 *   links; ArrowUp/ArrowDown move focus between visible nav controls.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildSidebarGroups,
  type SidebarBuildContext,
  type SidebarNavGroup,
  type SidebarNavItem,
} from "@/lib/sidebarNav";

export interface SidebarNavProps {
  siteId: string;
  enabledModules?: Record<string, boolean> | null;
  isSuperAdmin: boolean;
  /** Collapsed group ids (managed by useSidebarUi in the layout). */
  collapsedGroups: string[];
  onToggleGroup: (groupId: string) => void;
  /** Badge values keyed by source id (e.g. broken media count). */
  badges?: { mediaBroken?: number };
  /** Icon-only rail mode (desktop). */
  compact?: boolean;
  /** Called when a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
}

const LOCKED_HINT =
  "is managed by TAYA administrators. Contact your TAYA representative to make changes.";

function hrefPath(href: string): string {
  return href.split("?")[0];
}

/**
 * Exact match including the query string (wouter's location carries it).
 * Used for leaf precision: only "Drafts" is active on /articles?filter=draft.
 */
function itemIsLocallyActive(href: string, location: string): boolean {
  return href === location;
}

/**
 * Active if this item or any nested child matches the current route.
 * A submenu parent highlights at path level (any query variant of its
 * section, e.g. /events?filter=all) so the current section stays visible.
 */
function itemIsActive(item: SidebarNavItem, location: string): boolean {
  if (item.children?.length) {
    return (
      hrefPath(item.href) === hrefPath(location) ||
      item.children.some((c) => itemIsLocallyActive(c.href, location))
    );
  }
  return itemIsLocallyActive(item.href, location);
}

function groupHasActive(group: SidebarNavGroup, location: string): boolean {
  return group.items.some((item) => itemIsActive(item, location));
}

/** The group containing the current route (for parent highlight). */
export function findGroupOfHref(groups: SidebarNavGroup[], location: string): SidebarNavGroup | null {
  const path = hrefPath(location);
  for (const group of groups) {
    for (const item of group.items) {
      if (hrefPath(item.href) === path) return group;
      if (item.children?.some((c) => hrefPath(c.href) === path)) return group;
    }
  }
  return null;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 inline-flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

interface SidebarItemProps {
  item: SidebarNavItem;
  isSuperAdmin: boolean;
  location: string;
  badges?: SidebarNavProps["badges"];
  compact?: boolean;
  nested?: boolean;
  onNavigate?: () => void;
  submenuOpen: boolean;
  onToggleSubmenu: (id: string) => void;
}

function LockedTooltipContent({ label }: { label: string }) {
  return (
    <TooltipContent side="right" className="max-w-xs text-xs">
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span>
          <strong>{label}</strong> {LOCKED_HINT}
        </span>
      </div>
    </TooltipContent>
  );
}

function SidebarItem(props: SidebarItemProps) {
  const { item, isSuperAdmin, location, badges, compact, nested, onNavigate, submenuOpen, onToggleSubmenu } = props;
  const active = itemIsActive(item, location);
  const locked = item.isDesignLocked && !isSuperAdmin;
  const badgeCount = item.badge === "mediaBroken" ? (badges?.mediaBroken ?? 0) : undefined;
  const hasChildren = !compact && !!item.children?.length;

  const inner = (iconOnly: boolean) => (
    <>
      <item.icon
        className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : "text-slate-500"} ${iconOnly ? "" : "mr-3"}`}
      />
      {!iconOnly && (
        <span className={`flex-1 text-left ${nested ? "text-[13px]" : ""}`}>{item.label}</span>
      )}
      {!iconOnly && badgeCount != null && <NavBadge count={badgeCount} />}
      {!iconOnly && item.isDesignLocked && isSuperAdmin && (
        <Lock className="ml-1 h-3 w-3 flex-shrink-0 text-slate-300" />
      )}
      {hasChildren && (
        <ChevronRight
          className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${submenuOpen ? "rotate-90" : ""}`}
        />
      )}
    </>
  );

  // Design-locked for clients: disabled affordance + explanatory tooltip.
  if (locked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="button"
            aria-disabled="true"
            tabIndex={0}
            className={`flex h-10 w-full cursor-not-allowed select-none items-center rounded-lg text-slate-400 opacity-65 ${
              compact ? "justify-center px-2" : nested ? "pl-8 px-3" : "px-3"
            }`}
          >
            {inner(!!compact)}
          </div>
        </TooltipTrigger>
        <LockedTooltipContent label={item.label} />
      </Tooltip>
    );
  }

  const button = (iconOnly: boolean) => (
    <Button
      variant={active ? "secondary" : "ghost"}
      aria-current={active ? "page" : undefined}
      className={`h-10 w-full justify-start rounded-lg px-3 ${
        nested ? "pl-8" : ""
      } ${
        active
          ? "bg-primary/10 font-semibold text-primary hover:bg-primary/15"
          : "font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      } ${iconOnly ? "justify-center px-2" : ""}`}
    >
      {inner(iconOnly)}
    </Button>
  );

  const link = (iconOnly: boolean) => (
    <Link href={item.href} onClick={onNavigate}>
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>{button(true)}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-semibold">
            {item.label}
          </TooltipContent>
        </Tooltip>
      ) : (
        button(false)
      )}
    </Link>
  );

  return (
    <div className="relative">
      {link(!!compact)}
      {hasChildren && (
        <button
          type="button"
          aria-label={`Toggle ${item.label} submenu`}
          aria-expanded={submenuOpen}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSubmenu(item.id);
          }}
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${submenuOpen ? "rotate-90" : ""}`} />
        </button>
      )}
      {hasChildren && submenuOpen && (
        <div className="mt-1 space-y-1 border-l border-slate-100 pl-3 ml-4">
          {item.children?.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              isSuperAdmin={isSuperAdmin}
              location={location}
              badges={badges}
              compact={false}
              nested
              onNavigate={onNavigate}
              submenuOpen={false}
              onToggleSubmenu={onToggleSubmenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarGroupProps {
  group: SidebarNavGroup;
  isSuperAdmin: boolean;
  location: string;
  badges?: SidebarNavProps["badges"];
  compact?: boolean;
  collapsed: boolean;
  onToggleGroup: (groupId: string) => void;
  onNavigate?: () => void;
  openSubmenus: string[];
  onToggleSubmenu: (id: string) => void;
}

function SidebarGroup(props: SidebarGroupProps) {
  const { group, isSuperAdmin, location, badges, compact, collapsed, onToggleGroup, onNavigate, openSubmenus, onToggleSubmenu } = props;
  const groupActive = groupHasActive(group, location);
  const GroupIcon = group.icon;

  const header = (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={`Toggle ${group.title} section`}
      onClick={() => onToggleGroup(group.id)}
      className={`flex w-full items-center rounded-lg text-left transition-colors ${
        compact
          ? "h-10 justify-center px-2 text-slate-500 hover:bg-slate-100"
          : `px-3 py-2 ${groupActive ? "text-slate-900" : "text-slate-500 hover:bg-slate-50"}`
      }`}
    >
      {GroupIcon ? (
        <GroupIcon className={`h-4 w-4 flex-shrink-0 ${groupActive ? "text-primary" : "text-slate-400"}`} />
      ) : null}
      {!compact && (
        <>
          <span
            className={`ml-2 flex-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
              groupActive ? "text-primary/80" : "text-slate-400"
            }`}
          >
            {group.title}
          </span>
          <ChevronRight
            className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${collapsed ? "" : "rotate-90"}`}
          />
        </>
      )}
    </button>
  );

  return (
    <div className="mb-1">
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>{header}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-semibold">
            {group.title}
          </TooltipContent>
        </Tooltip>
      ) : (
        header
      )}
      {!collapsed && (
        <div className="mt-1 space-y-1">
          {group.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isSuperAdmin={isSuperAdmin}
              location={location}
              badges={badges}
              compact={compact}
              onNavigate={onNavigate}
              submenuOpen={openSubmenus.includes(item.id)}
              onToggleSubmenu={onToggleSubmenu}
            />
          ))}
        </div>
      )}
      {collapsed && groupActive && !compact && (
        // Keep the current page visible even when its group is collapsed.
        <div className="mt-1 ml-3 border-l-2 border-primary/30 pl-2">
          {group.items
            .filter((item) => itemIsActive(item, location))
            .map((item) => (
              <SidebarItem
                key={`active-${item.id}`}
                item={item}
                isSuperAdmin={isSuperAdmin}
                location={location}
                badges={badges}
                onNavigate={onNavigate}
                submenuOpen={item.children?.some((c) => itemIsLocallyActive(c.href, location)) ?? false}
                onToggleSubmenu={onToggleSubmenu}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export function SidebarNav(props: SidebarNavProps) {
  const { siteId, enabledModules, isSuperAdmin, collapsedGroups, onToggleGroup, badges, compact, onNavigate } = props;
  const [location] = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);

  const ctx: SidebarBuildContext = { siteId, enabledModules, isSuperAdmin };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => buildSidebarGroups(ctx), [siteId, enabledModules, isSuperAdmin]);

  // Auto-expand a submenu whose child is the active route (WordPress-like).
  useEffect(() => {
    const activeSubmenu = groups
      .flatMap((g) => g.items)
      .find((item) => item.children?.some((c) => itemIsLocallyActive(c.href, location)));
    if (activeSubmenu && !openSubmenus.includes(activeSubmenu.id)) {
      setOpenSubmenus((prev) => [...prev, activeSubmenu.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, groups]);

  // Keyboard navigation: ArrowUp/ArrowDown move focus between visible controls.
  const navRef = useRef<HTMLElement>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const nav = navRef.current;
    if (!nav) return;
    const focusables = Array.from(nav.querySelectorAll<HTMLElement>("a[href], button[aria-expanded]"));
    if (focusables.length === 0) return;
    const index = focusables.indexOf(document.activeElement as HTMLElement);
    const dir = e.key === "ArrowDown" ? 1 : -1;
    const next = focusables[index + dir] ?? focusables[0];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <nav
      ref={navRef}
      aria-label="Website sections"
      onKeyDown={onKeyDown}
      className="space-y-1"
      data-testid="sidebar-nav"
    >
      {groups.map((group) => (
        <SidebarGroup
          key={group.id}
          group={group}
          isSuperAdmin={isSuperAdmin}
          location={location}
          badges={badges}
          compact={compact}
          collapsed={collapsedGroups.includes(group.id)}
          onToggleGroup={onToggleGroup}
          onNavigate={onNavigate}
          openSubmenus={openSubmenus}
          onToggleSubmenu={(id) =>
            setOpenSubmenus((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
          }
        />
      ))}
    </nav>
  );
}
