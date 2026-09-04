import { useState } from "react";
import {
  LifeBuoy,
  LayoutTemplate,
  Eye,
  Rocket,
  PartyPopper,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * WelcomeTour — Phase 5 (Client Help, non-AI)
 *
 * A lightweight 5-step welcome tour shown ONCE on the site dashboard for
 * client roles. Steps use plain client language (no developer terminology)
 * and explain the core TAYA workflow: Draft → Preview → Publish.
 *
 * Persistence: per-user + per-site localStorage flag. "Restart tour" (Help
 * Center) clears the flag, which makes the tour re-appear on the dashboard.
 *
 * Internal roles (superadmin / internal QA) never see the tour — it is a
 * client onboarding aid only.
 */

export const TOUR_STORAGE_KEY = "taya.tour.v1";

export function tourDismissedKey(userId: string | null | undefined, siteId: string) {
  return `${TOUR_STORAGE_KEY}.${userId ?? "anon"}.${siteId}`;
}

export function tourNeedsWelcome(
  userId: string | null | undefined,
  siteId: string,
  me?: { isSuperAdmin?: boolean; roles?: Array<{ role?: string }> } | null,
): boolean {
  if (typeof window === "undefined") return false;
  if (me?.isSuperAdmin) return false;
  if (me?.roles?.some((r) => r.role === "internal_qa")) return false;
  try {
    return window.localStorage.getItem(tourDismissedKey(userId, siteId)) !== "1";
  } catch {
    return false;
  }
}

export function clearTourDismissal(userId: string | null | undefined, siteId: string) {
  try {
    window.localStorage.removeItem(tourDismissedKey(userId, siteId));
  } catch {
    /* storage unavailable — restart is a no-op */
  }
}

export const TOUR_STEPS: Array<{ title: string; body: string; icon: any }> = [
  {
    icon: LayoutTemplate,
    title: "Welcome to your website dashboard",
    body: "This is the home base for your website. See how it's doing, jump to recent activity, and get started with the checklist above.",
  },
  {
    icon: Eye,
    title: "Everything lives in the sidebar",
    body: "The menu on the left is organized the way you think about your business — Homepage, Courses, Events, Articles, Photos, and more. Click any item to manage it.",
  },
  {
    icon: Rocket,
    title: "Draft, Preview, Publish — you're in control",
    body: "When you edit a page, your changes are saved as a draft first. Preview shows how it will look on your live site. Only when you click Publish do your changes go live for visitors.",
  },
  {
    icon: LifeBuoy,
    title: "Help is always one click away",
    body: "Open Help Center from the sidebar any time for step-by-step answers, common questions, and how to reach your support team.",
  },
  {
    icon: PartyPopper,
    title: "That's it — you're ready",
    body: "Take it at your own pace. Every change is saved as a draft until you publish it, and nothing on your live site changes until you say so.",
  },
];

export default function WelcomeTour({
  siteId,
  userId,
  me,
}: {
  siteId: string;
  userId?: string | null;
  me?: { isSuperAdmin?: boolean; roles?: Array<{ role?: string }> } | null;
}) {
  const [open, setOpen] = useState(() => tourNeedsWelcome(userId, siteId, me));
  const [step, setStep] = useState(0);

  if (!open) return null;

  const total = TOUR_STEPS.length;
  const current = TOUR_STEPS[step];
  const isLast = step === total - 1;

  function finishTour() {
    setOpen(false);
    try {
      window.localStorage.setItem(tourDismissedKey(userId, siteId), "1");
    } catch {
      /* storage unavailable — dismissal is session-only */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-label="Welcome tour"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <current.icon className="h-5 w-5 text-primary" />
          </div>
          <button
            type="button"
            onClick={finishTour}
            aria-label="Close welcome tour"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-3 text-lg font-bold text-slate-900">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-primary" : "w-1.5 bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={finishTour} className="bg-primary text-white">
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="bg-primary text-white">
                Next
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          Step {step + 1} of {total} &mdash; you can reopen this tour any time from the Help Center.
        </p>
      </div>
    </div>
  );
}
