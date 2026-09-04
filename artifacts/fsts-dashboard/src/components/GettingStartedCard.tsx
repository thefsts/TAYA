import { useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  Circle,
  X,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * GettingStartedCard — Phase 5 (Client Help, non-AI)
 *
 * A friendly onboarding checklist rendered on the site dashboard with REAL
 * completion state derived from `sites.getDashboardSummary` and the site doc.
 * No fake data: every item reflects an actual query result.
 *
 * Items and their real signals:
 *   1. Connect your web address   — site.domain is set
 *   2. Add your business info     — contact info email configured (formsConfigured)
 *   3. Add your first content     — any of courses/events/articles/services > 0
 *      (module-gated: link only shown for enabled modules)
 *   4. Upload photos & files      — mediaCount > 0
 *   5. Introduce your team        — teamCount > 0 (module-gated)
 *
 * Dismissal is per-user + per-site via localStorage. This is a client-facing
 * component: labels use plain client language, never developer terminology.
 */

export type GettingStartedSummary = {
  formsConfigured?: boolean;
  courseCount?: number;
  eventCount?: number;
  articleCount?: number;
  serviceCount?: number;
  mediaCount?: number;
  teamCount?: number;
};

type ModuleMap = Record<string, boolean | null> | null | undefined;

export function buildGettingStartedItems(
  domain: string | null | undefined,
  summary: GettingStartedSummary | null | undefined,
  modules: ModuleMap,
): Array<{ key: string; label: string; done: boolean; href: string | null; reason: string }> {
  const moduleVisible = (key: string) => modules == null || modules[key] !== false;

  const contentCount =
    (summary?.courseCount ?? 0) +
    (summary?.eventCount ?? 0) +
    (summary?.articleCount ?? 0) +
    (summary?.serviceCount ?? 0);

  // First enabled content module becomes the "Add your first content" target.
  let contentHref: string | null = null;
  if (moduleVisible("courses") && (summary?.courseCount ?? 0) === 0 && !contentHref) contentHref = "courses";
  if (moduleVisible("events") && (summary?.eventCount ?? 0) === 0 && !contentHref) contentHref = "events";
  if (moduleVisible("articles") && (summary?.articleCount ?? 0) === 0 && !contentHref) contentHref = "articles";
  if (moduleVisible("services") && (summary?.serviceCount ?? 0) === 0 && !contentHref) contentHref = "services";

  const items: Array<{ key: string; label: string; done: boolean; href: string | null; reason: string }> = [
    {
      key: "domain",
      label: "Connect your web address",
      done: !!domain,
      href: null,
      reason: "Your site's address (like www.yourbusiness.com). Ask your support team to connect one.",
    },
    {
      key: "business-info",
      label: "Add your business info",
      done: !!summary?.formsConfigured,
      href: moduleVisible("contact") ? "contact" : null,
      reason: "Phone, email, and location shown on your website and contact forms.",
    },
    {
      key: "content",
      label: "Add your first content",
      done: contentCount > 0,
      href: contentHref,
      reason: "Courses, events, articles, or services — whatever fits your business.",
    },
    {
      key: "media",
      label: "Upload photos & files",
      done: (summary?.mediaCount ?? 0) > 0,
      href: moduleVisible("media") ? "media" : null,
      reason: "Pictures and documents for your pages. Upload once, use anywhere.",
    },
    {
      key: "team",
      label: "Introduce your team",
      done: (summary?.teamCount ?? 0) > 0,
      href: moduleVisible("team") ? "team" : null,
      reason: "Show your staff or instructors so visitors know who they'll work with.",
    },
  ];

  return items;
}

export function gettingStartedDismissKey(userId: string | null | undefined, siteId: string) {
  return `taya.getting-started.dismissed.v1.${userId ?? "anon"}.${siteId}`;
}

export default function GettingStartedCard({
  siteId,
  siteName,
  domain,
  summary,
  modules,
  userId,
}: {
  siteId: string;
  siteName?: string | null;
  domain?: string | null;
  summary?: GettingStartedSummary | null;
  modules?: ModuleMap;
  userId?: string | null;
}) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(gettingStartedDismissKey(userId, siteId)) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const items = buildGettingStartedItems(domain, summary, modules);
  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length && items.length > 0;

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(gettingStartedDismissKey(userId, siteId), "1");
    } catch {
      /* storage unavailable — dismissal is session-only */
    }
  }

  return (
    <Card className="mb-8 rounded-2xl border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-primary" />
            Getting Started{siteName ? ` with ${siteName}` : ""}
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss Getting Started checklist"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </CardTitle>
        <div className="mt-1 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-label="Setup progress"
            />
          </div>
          <span className="text-xs font-medium text-slate-500">
            {doneCount} of {items.length} done
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {allDone ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-800">You're all set!</p>
              <p className="text-xs text-green-700">
                The basics are done. Explore the sidebar to keep building — every change is saved as a draft until you publish it.
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.key} className="rounded-xl border border-slate-100 bg-white/70 p-3">
                <div className="flex items-start gap-2.5">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.href && !item.done ? (
                        <Link href={`/app/sites/${siteId}/${item.href}`}>
                          <span className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                            {item.label}
                          </span>
                        </Link>
                      ) : (
                        <span className={`text-sm font-medium ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                          {item.label}
                        </span>
                      )}
                      {item.done && <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600">Done</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{item.reason}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
