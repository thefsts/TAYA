import { AppLayout } from "@/pages/app/SiteDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LifeBuoy, Mail, Phone, BookOpen, ShieldCheck, History, Users } from "lucide-react";

const FAQS: { question: string; answer: string; icon: any }[] = [
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
                href="mailto:support@fullstacktechsolutions.com"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" /> support@fullstacktechsolutions.com
              </a>
              <a href="tel:+18005551234" className="flex items-center gap-2 text-primary hover:underline">
                <Phone className="h-4 w-4" /> (800) 555-1234
              </a>
              <p className="text-slate-500 pt-2 border-t border-slate-100">
                Support hours: Monday–Friday, 8am–6pm ET. For urgent website outages, call the number above for
                priority response.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-sm">Powered By</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              This dashboard is the FSTS Website Operating System™, built and maintained by Full Stack Tech
              Solutions. Every account activity is recorded in your Activity Log for full transparency.
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
