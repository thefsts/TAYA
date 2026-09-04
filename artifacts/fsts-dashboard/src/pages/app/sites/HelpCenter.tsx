import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LifeBuoy, Mail, Phone, BookOpen, ShieldCheck, History, Users, ExternalLink, Rocket, Eye, RotateCcw, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clearTourDismissal, TOUR_STEPS } from "@/components/WelcomeTour";
import { gettingStartedDismissKey, buildGettingStartedItems } from "@/components/GettingStartedCard";

const FAQS: { question: string; answer: string; icon: any }[] = [
  {
    icon: Rocket,
    question: "What's the difference between Save Draft, Preview, and Publish?",
    answer:
      "Save Draft stores your changes safely without anyone seeing them. Preview shows how your page will look on your live website. Publish is the button that makes your changes live for visitors. Until you click Publish, nothing changes on your public website.",
  },
  {
    icon: Eye,
    question: "How quickly do my published changes appear on my website?",
    answer:
      "Publishing is near-instant. When you click Publish, your live website is usually updated within a minute. If you don't see a change, wait a few moments and refresh your browser. The preview panel inside the dashboard always shows your live site.",
  },
  {
    icon: BookOpen,
    question: "How do I edit my website's content?",
    answer:
      "Use the Content section in the sidebar (Homepage, Courses, Events, Articles, Media Library) to update pages. Changes are saved as drafts first — use Preview to review before you Publish them live.",
  },
  {
    icon: History,
    question: "I made a mistake. Can I undo a change?",
    answer:
      "Yes. Every page has version history — open Version History in the sidebar to see prior drafts and roll back to any earlier version with one click. You can also restore the entire site from a snapshot in Backups.",
  },
  {
    icon: Users,
    question: "What can each team role do?",
    answer:
      "Administrator (FSTS) has full access across all sites. Website Manager (Client) can manage all content and settings for their site. Editor can create and edit content but not publish. Marketing can manage SEO, articles, and campaigns. Read Only can view everything without making changes.",
  },
  {
    icon: ShieldCheck,
    question: "How do I check if my site is healthy?",
    answer:
      "The Dashboard home page shows live Website Status — whether the site is online, SSL is active, response time, email and forms configuration, Square connectivity, and your last backup date.",
  },
  {
    icon: Mail,
    question: "How do I connect my CRM?",
    answer:
      "Go to Marketing & CRM in the sidebar to configure the Operon Connector™. You can enable per-entity sync (contact forms, quote requests, orders, appointment status, and more) and monitor sync activity and API health from that page.",
  },
];

export default function HelpCenter({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const site = useQuery(api.sites.get, { siteId });
  const me = useQuery(api.users.me);
  const summary = useQuery(api.sites.getDashboardSummary, { siteId });
  const modules = useQuery(api.sites.getEffectiveModules, { siteId });
  const { toast } = useToast();

  const agencyId = (site as any)?.agencyId as Id<"agencies"> | undefined;
  const agency = useQuery(
    api.agencies.get,
    agencyId ? { agencyId } : "skip",
  );

  const supportEmail = agency?.supportEmail ?? "support@fullstacktechsolutions.com";
  const helpCenterUrl = agency?.helpCenterUrl ?? null;
  const agencyName = agency?.name ?? "Full Stack Tech Solutions";

  // Phase 5: real completion state + tour controls
  const gettingStartedItems = buildGettingStartedItems(site?.domain, summary, modules);
  const doneCount = gettingStartedItems.filter((i) => i.done).length;
  const checklistText =
    gettingStartedItems.length > 0 && doneCount === gettingStartedItems.length
      ? "You're all set \u2014 the basics are done!"
      : `${doneCount} of ${gettingStartedItems.length} steps done.`;

  function handleRestartTour() {
    clearTourDismissal(me?._id, siteId);
    toast({ title: "Tour restarted", description: "Open your dashboard to see the welcome tour again." });
  }

  function handleRestoreChecklist() {
    try {
      window.localStorage.removeItem(gettingStartedDismissKey(me?._id, siteId));
      toast({ title: "Checklist restored", description: "Open your dashboard to see the Getting Started checklist again." });
    } catch {
      toast({ title: "Something went wrong", description: "Could not restore the checklist.", variant: "destructive" });
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
            <LifeBuoy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Help Center</h1>
            <p className="text-sm text-slate-500">Answers to common questions, plus how to reach your support team.</p>
          </div>
        </div>
      </div>

      {/* Phase 5: Getting Started with real completion state + tour controls */}
      <Card className="mb-8 shadow-sm border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListChecks className="h-4 w-4 text-primary" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-500">
            A quick look at your website setup. {checklistText}
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {gettingStartedItems.map((item) => (
              <li key={item.key} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
                )}
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${item.done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {item.label}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{item.reason}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Changed your mind? Restore the Getting Started checklist on your dashboard at any time.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRestoreChecklist}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Restore Checklist
              </Button>
              <Button size="sm" onClick={handleRestartTour} className="bg-primary text-white">
                <PlayCircle className="mr-1 h-3.5 w-3.5" />
                Restart Tour
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQS.map((faq, i) => (
                  <AccordionItem value={`faq-${i}`} key={i}>
                    <AccordionTrigger className="text-left">
                      <span className="flex items-center gap-2">
                        <faq.icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        {faq.question}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pl-6">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm">Contact Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <a
                href={`mailto:${supportEmail}`}
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" /> {supportEmail}
              </a>
              {!agency && (
                <a href="tel:+18005551234" className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-4 w-4" /> (800) 555-1234
                </a>
              )}
              {helpCenterUrl && (
                <a
                  href={helpCenterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Visit Help Center
                </a>
              )}
              <p className="text-slate-500 pt-2 border-t border-slate-100">
                {agency
                  ? `For support, contact your ${agencyName} account team at the email above.`
                  : "Support hours: Monday–Friday, 8am–6pm ET. For urgent website outages, call the number above for priority response."}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm">Powered By</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              {agency ? (
                <>
                  This dashboard is managed by <span className="font-medium text-slate-700">{agencyName}</span>, powered by the TAYA System™. Every account activity is recorded in your Activity Log for full transparency.
                </>
              ) : (
                <>
                  This dashboard is the TAYA System™, built and maintained by Full Stack Tech Solutions. Every account activity is recorded in your Activity Log for full transparency.
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
