import { useState, useMemo } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Link, useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutTemplate,
  FileText,
  ScrollText,
  HelpCircle,
  Briefcase,
  Package,
  BookOpen,
  Calendar,
  MessageSquareQuote,
  Search,
  Pencil,
  ExternalLink,
  FileStack,
} from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  Homepage: LayoutTemplate,
  Article: FileText,
  Policy: ScrollText,
  FAQ: HelpCircle,
  Service: Briefcase,
  Product: Package,
  Course: BookOpen,
  Event: Calendar,
  Testimonial: MessageSquareQuote,
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-green-100 text-green-700 border-green-200",
    active: "bg-green-100 text-green-700 border-green-200",
    draft: "bg-amber-100 text-amber-700 border-amber-200",
    scheduled: "bg-blue-100 text-blue-700 border-blue-200",
    archived: "bg-slate-100 text-slate-500 border-slate-200",
    inactive: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels: Record<string, string> = {
    published: "Published",
    active: "Active",
    draft: "Draft",
    scheduled: "Scheduled",
    archived: "Archived",
    inactive: "Inactive",
  };
  const cls = styles[status] ?? "bg-slate-100 text-slate-500 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function Pages() {
  const params = useParams();
  const siteId = params.siteId as unknown as Id<"sites">;
  const pages = useQuery(api.pages.getAllPages, { siteId });
  const site = useQuery(api.sites.get, { siteId });
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredPages = useMemo(() => {
    if (!pages) return [];
    return pages.filter((p) => {
      const matchesSearch = !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || p.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [pages, searchQuery, typeFilter]);

  const typeCounts = useMemo(() => {
    if (!pages) return {};
    return pages.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [pages]);

  const types = useMemo(() => {
    if (!pages) return [];
    return Array.from(new Set(pages.map((p) => p.type))).sort();
  }, [pages]);

  return (
    <AppLayout siteId={siteId} pageContext="Pages">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">All Pages & Content</h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Every piece of content on your website in one view. Search, filter by type, and jump straight to the editor.
        </p>
        {site?.domain && (
          <a
            href={`https://${site.domain}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {site.domain} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search pages by title or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={typeFilter === "all" ? "secondary" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
            className="h-9"
          >
            All ({pages?.length ?? 0})
          </Button>
          {types.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? "secondary" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(type)}
              className="h-9"
            >
              {type} ({typeCounts[type]})
            </Button>
          ))}
        </div>
      </div>

      {/* Content table */}
      {pages === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : filteredPages.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <FileStack className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            {pages.length === 0 ? "No content yet" : "No pages match your search"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {pages.length === 0
              ? "Start by editing your homepage or creating an article."
              : "Try adjusting your search or filter."}
          </p>
          {pages.length === 0 && (
            <Link href={`/app/sites/${siteId}/homepage`}>
              <Button className="mt-4" size="sm">
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Edit Homepage
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="hidden px-4 py-3 text-left font-medium text-slate-500 md:table-cell">Last Updated</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPages.map((page) => {
                  const Icon = TYPE_ICONS[page.type] ?? FileText;
                  return (
                    <tr key={page.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                            <Icon className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="min-w-0 truncate font-medium text-slate-800">{page.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-500">{page.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={page.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                        {new Date(page.updatedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/app/sites/${siteId}/${page.editHref}`}>
                          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5">
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary footer */}
      {pages && pages.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {filteredPages.length} of {pages.length} pages
          </span>
          <span>
            {pages.filter((p) => p.status === "published" || p.status === "active").length} live &middot;{" "}
            {pages.filter((p) => p.status === "draft").length} drafts &middot;{" "}
            {pages.filter((p) => p.status === "scheduled").length} scheduled
          </span>
        </div>
      )}
    </AppLayout>
  );
}
