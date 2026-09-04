import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Newspaper,
  Pencil,
  Plus,
  Trash2,
  Star,
  Tag,
  Globe,
  Share2,
  Search,
  Filter,
  History,
} from "lucide-react";
import { Link } from "wouter";
import { LivePreviewPanel } from "@/components/LivePreviewPanel";
import { PublishValidationModal } from "@/components/PublishValidationModal";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";

type ArticleStatus = "draft" | "published" | "archived";

const ARTICLE_CATEGORIES = [
  "Security Services",
  "Church Security",
  "Executive Protection",
  "Property Management Security",
  "Private Investigations",
  "Security Officer Training",
  "Firearms Safety",
  "Home Defense",
  "Texas License to Carry",
  "Emergency Preparedness",
  "Women's Training",
  "Industry News",
];

type ArticleFormState = {
  title: string;
  slug: string;
  status: ArticleStatus;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  category: string;
  author: string;
  readingTime: string;
  tagsRaw: string;
  featured: boolean;
  scheduledAt: string;
  seoTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  socialTitle: string;
  socialDescription: string;
  socialImageUrl: string;
};

const emptyForm: ArticleFormState = {
  title: "",
  slug: "",
  status: "draft",
  excerpt: "",
  body: "",
  coverImageUrl: "",
  category: "",
  author: "",
  readingTime: "",
  tagsRaw: "",
  featured: false,
  scheduledAt: "",
  seoTitle: "",
  metaDescription: "",
  ogImageUrl: "",
  canonicalUrl: "",
  socialTitle: "",
  socialDescription: "",
  socialImageUrl: "",
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "published") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function estimateReadingTime(body: string) {
  const words = body.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Security Services": "bg-blue-50 text-blue-700 border-blue-200",
  "Church Security": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Executive Protection": "bg-purple-50 text-purple-700 border-purple-200",
  "Property Management Security": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Private Investigations": "bg-amber-50 text-amber-700 border-amber-200",
  "Security Officer Training": "bg-orange-50 text-orange-700 border-orange-200",
  "Firearms Safety": "bg-red-50 text-red-700 border-red-200",
  "Home Defense": "bg-rose-50 text-rose-700 border-rose-200",
  "Texas License to Carry": "bg-green-50 text-green-700 border-green-200",
  "Emergency Preparedness": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Women's Training": "bg-pink-50 text-pink-700 border-pink-200",
  "Industry News": "bg-slate-50 text-slate-700 border-slate-200",
};

export default function ArticlesList({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const data = useQuery(api.articles.list, { siteId });
  const createArticle = useMutation(api.articles.create);
  const updateArticle = useMutation(api.articles.update);
  const deleteArticle = useMutation(api.articles.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ArticleFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("content");
  // Sidebar deep links (?filter=draft|published|archived) drive the status
  // filter; navigating to the unfiltered list resets it so "All Articles"
  // always shows every article regardless of the previously active filter.
  const search = useSearch();
  useEffect(() => {
    const fromUrl = new URLSearchParams(search).get("filter");
    if (fromUrl === "draft" || fromUrl === "published" || fromUrl === "archived") {
      setFilterStatus(fromUrl);
    } else {
      setFilterStatus("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setActiveTab("content");
    setDialogOpen(true);
  }

  function openEdit(a: any) {
    setEditing(a);
    setForm({
      title: a.title,
      slug: a.slug,
      status: a.status as ArticleStatus,
      excerpt: a.excerpt ?? "",
      body: a.body,
      coverImageUrl: a.coverImageUrl ?? "",
      category: a.category ?? "",
      author: a.author ?? "",
      readingTime: a.readingTime ?? "",
      tagsRaw: (a.tags ?? []).join(", "),
      featured: a.featured ?? false,
      scheduledAt: a.scheduledAt ? new Date(a.scheduledAt).toISOString().slice(0, 16) : "",
      seoTitle: a.seoTitle ?? "",
      metaDescription: a.metaDescription ?? "",
      ogImageUrl: a.ogImageUrl ?? "",
      canonicalUrl: a.canonicalUrl ?? "",
      socialTitle: a.socialTitle ?? "",
      socialDescription: a.socialDescription ?? "",
      socialImageUrl: a.socialImageUrl ?? "",
    });
    setActiveTab("content");
    setDialogOpen(true);
  }

  function setField<K extends keyof ArticleFormState>(key: K, value: ArticleFormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "title" && !editing) {
        next.slug = slugify(value as string);
      }
      if (key === "body" && !next.readingTime) {
        next.readingTime = estimateReadingTime(value as string);
      }
      return next;
    });
  }

  async function doSave() {
    setIsPending(true);
    const tags = form.tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const payload = {
        siteId,
        title: form.title,
        slug: form.slug,
        status: form.status,
        excerpt: form.excerpt || undefined,
        body: form.body,
        coverImageUrl: form.coverImageUrl || undefined,
        category: form.category || undefined,
        author: form.author || undefined,
        readingTime: form.readingTime || undefined,
        tags: tags.length ? tags : undefined,
        featured: form.featured,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        seoTitle: form.seoTitle || undefined,
        metaDescription: form.metaDescription || undefined,
        ogImageUrl: form.ogImageUrl || undefined,
        canonicalUrl: form.canonicalUrl || undefined,
        socialTitle: form.socialTitle || undefined,
        socialDescription: form.socialDescription || undefined,
        socialImageUrl: form.socialImageUrl || undefined,
      };
      if (editing) {
        await updateArticle({ ...payload, articleId: editing._id });
        toast({ title: "Article updated" });
      } else {
        await createArticle(payload);
        toast({ title: "Article created" });
      }
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.status === "published") {
      setValidationOpen(true);
      return;
    }
    await doSave();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteArticle({ siteId, articleId: deleteTarget._id });
      toast({ title: "Article deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Couldn't delete article",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  const filtered = (data ?? []).filter((a: any) => {
    const matchesSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.category ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const publishedCount = (data ?? []).filter((a: any) => a.status === "published").length;
  const draftCount = (data ?? []).filter((a: any) => a.status === "draft").length;

  const articleValidationData = {
    title: form.title,
    imageUrl: form.coverImageUrl || undefined,
    description: form.excerpt || undefined,
    body: form.body || undefined,
    metaTitle: form.seoTitle || undefined,
    metaDescription: form.metaDescription || undefined,
    slug: form.slug,
  };

  return (
    <AppLayout siteId={params.siteId}>
      <LivePreviewPanel siteId={siteId} section="articles">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Articles</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage Training & Knowledge Center articles.{" "}
            <span className="text-green-600 font-medium">{publishedCount} published</span>
            {draftCount > 0 && <span className="text-slate-400"> · {draftCount} draft</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Article
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            aria-label="Search articles…"
            className="pl-9"
            placeholder="Search articles…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger aria-label="filter status" className="w-36">
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data === undefined ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-md">
          <Newspaper className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-lg font-medium text-slate-900">
            {data.length === 0 ? "No articles yet" : "No matches"}
          </h3>
          <p className="text-slate-500 mt-1">
            {data.length === 0 ? "Publish your first article to populate the website." : "Try adjusting your search or filters."}
          </p>
          {data.length === 0 && (
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New Article
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">Published</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a: any) => (
                <tr key={a._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {a.featured && (
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                      )}
                      <span className="font-medium text-slate-900 line-clamp-1">{a.title}</span>
                    </div>
                    {a.readingTime && (
                      <span className="text-xs text-slate-400 ml-5">{a.readingTime}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {a.category ? (
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[a.category] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {a.category}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                    {a.publishedAt
                      ? new Date(a.publishedAt).toLocaleDateString()
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <Button aria-label="Edit" variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button aria-label="Delete" variant="ghost" size="sm" onClick={() => setDeleteTarget(a)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </LivePreviewPanel>

      <div className="mt-4 flex justify-end">
        <Link href={`/app/sites/${siteId}/history`}>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            <History className="mr-1.5 h-4 w-4" />
            Revision History
          </Button>
        </Link>
      </div>

      {/* ── Article Editor Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Article" : "New Article"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-5">
                <TabsTrigger value="content">
                  <Newspaper className="h-3.5 w-3.5 mr-1.5" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Tag className="h-3.5 w-3.5 mr-1.5" />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="seo">
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  SEO
                </TabsTrigger>
                <TabsTrigger value="social">
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Social
                </TabsTrigger>
              </TabsList>

              {/* ── CONTENT TAB ── */}
              <TabsContent value="content" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Title <span className="text-red-500">*</span></Label>
                    <Input
                      aria-label="Title"
                      required
                      value={form.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="Article headline"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Web Address <span className="text-red-500">*</span></Label>
                    <Input
                      aria-label="Web Address"
                      required
                      value={form.slug}
                      onChange={(e) => setField("slug", e.target.value)}
                      placeholder="my-first-article"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Excerpt</Label>
                  <Textarea
                    aria-label="Excerpt"
                    rows={2}
                    value={form.excerpt}
                    onChange={(e) => setField("excerpt", e.target.value)}
                    placeholder="Short summary shown in article cards…"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Body <span className="text-red-500">*</span></Label>
                  <Textarea
                    aria-label="Body"
                    required
                    rows={12}
                    value={form.body}
                    onChange={(e) => setField("body", e.target.value)}
                    placeholder="Write the full article content here. Markdown supported."
                    className="font-mono text-sm"
                  />
                </div>

                <ImagePickerField
                  siteId={params.siteId}
                  label="Cover Image"
                  value={form.coverImageUrl}
                  onChange={(url) => setField("coverImageUrl", url)}
                  initialPreset={SITE_PRESETS.find((p) => p.label === "Article Thumbnail")}
                  hint="Recommended: 1200×675 px (16:9)."
                />
              </TabsContent>

              {/* ── SETTINGS TAB ── */}
              <TabsContent value="settings" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setField("status", v as ArticleStatus)}
                    >
                      <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={form.category || "__none__"}
                      onValueChange={(v) => setField("category", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger aria-label="Category"><SelectValue placeholder="Select category…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No category</SelectItem>
                        {ARTICLE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Author</Label>
                    <Input
                      aria-label="Author"
                      value={form.author}
                      onChange={(e) => setField("author", e.target.value)}
                      placeholder="e.g. John Smith"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reading Time</Label>
                    <Input
                      aria-label="Reading Time"
                      value={form.readingTime}
                      onChange={(e) => setField("readingTime", e.target.value)}
                      placeholder="e.g. 5 min read"
                    />
                    {form.body && !form.readingTime && (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setField("readingTime", estimateReadingTime(form.body))}
                      >
                        Auto-estimate from body
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tags</Label>
                  <Input
                    aria-label="Tags"
                    value={form.tagsRaw}
                    onChange={(e) => setField("tagsRaw", e.target.value)}
                    placeholder="church security, firearms, safety (comma-separated)"
                  />
                  <p className="text-xs text-slate-400">Separate tags with commas</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Publish Date</Label>
                    <Input
                      aria-label="Publish Date"
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(e) => setField("scheduledAt", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 flex flex-col justify-end pb-0.5">
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">Featured Article</p>
                        <p className="text-xs text-slate-500">Shown at top of /blog and homepage</p>
                      </div>
                      <Switch
                        checked={form.featured}
                        onCheckedChange={(v) => setField("featured", v)}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── SEO TAB ── */}
              <TabsContent value="seo" className="space-y-4 mt-0">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  SEO fields override the article title/excerpt in search engine results. Leave blank to use defaults.
                </div>

                <div className="space-y-1.5">
                  <Label>SEO Title</Label>
                  <Input
                    aria-label="SEO Title"
                    value={form.seoTitle}
                    onChange={(e) => setField("seoTitle", e.target.value)}
                    placeholder={form.title || "Article title for search engines"}
                  />
                  <p className="text-xs text-slate-400">{form.seoTitle.length}/60 chars recommended</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Meta Description</Label>
                  <Textarea
                    aria-label="Meta Description"
                    rows={3}
                    value={form.metaDescription}
                    onChange={(e) => setField("metaDescription", e.target.value)}
                    placeholder={form.excerpt || "Description shown in search results…"}
                  />
                  <p className="text-xs text-slate-400">{form.metaDescription.length}/160 chars recommended</p>
                </div>

                <ImagePickerField
                  siteId={params.siteId}
                  label="OG Image"
                  value={form.ogImageUrl}
                  onChange={(url) => setField("ogImageUrl", url)}
                  initialPreset={SITE_PRESETS.find((p) => p.label === "Article Thumbnail")}
                  hint="Recommended: 1200×630 px (Open Graph)."
                />

                <div className="space-y-1.5">
                  <Label>Canonical URL</Label>
                  <Input
                    aria-label="Canonical URL"
                    value={form.canonicalUrl}
                    onChange={(e) => setField("canonicalUrl", e.target.value)}
                    placeholder={`https://yourdomain.com/blog/${form.slug || "my-first-article"}`}
                  />
                </div>
              </TabsContent>

              {/* ── SOCIAL TAB ── */}
              <TabsContent value="social" className="space-y-4 mt-0">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                  Social metadata is exposed via the Operon CRM API so campaigns and newsletters can use the correct copy. The dashboard does not post to social directly.
                </div>

                <div className="space-y-1.5">
                  <Label>Social Title</Label>
                  <Input
                    aria-label="Social Title"
                    value={form.socialTitle}
                    onChange={(e) => setField("socialTitle", e.target.value)}
                    placeholder={form.seoTitle || form.title || "Title for social posts"}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Social Description</Label>
                  <Textarea
                    aria-label="Social Description"
                    rows={3}
                    value={form.socialDescription}
                    onChange={(e) => setField("socialDescription", e.target.value)}
                    placeholder={form.metaDescription || form.excerpt || "Caption or hook for social media…"}
                  />
                </div>

                <ImagePickerField
                  siteId={params.siteId}
                  label="Social Image"
                  value={form.socialImageUrl}
                  onChange={(url) => setField("socialImageUrl", url)}
                  initialPreset={SITE_PRESETS.find((p) => p.label === "Article Thumbnail")}
                  hint="Recommended: 1200×630 px or square."
                />

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Operon CRM API Preview</p>
                  <p className="text-xs text-slate-500">
                    When this article is <span className="font-semibold text-green-600">published</span>, Operon CRM can read it at:
                  </p>
                  <code className="block mt-2 text-xs bg-white border border-slate-200 rounded px-3 py-2 text-slate-700 break-all">
                    GET /api/public/articles/operon?slug=&lt;site-slug&gt;
                  </code>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Create Article"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the article from the website immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PublishValidationModal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        onPublish={doSave}
        data={articleValidationData}
        title={editing ? `Article: ${form.title}` : "New Article"}
      />
    </AppLayout>
  );
}
