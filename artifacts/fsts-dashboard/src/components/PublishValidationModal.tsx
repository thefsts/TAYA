import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, Shield,
} from "lucide-react";

type ValidationIssue = {
  id: string;
  type: "error" | "warning" | "info";
  category: string;
  message: string;
  action?: string;
};

type ValidationResult = {
  score: number;
  passed: boolean;
  issues: ValidationIssue[];
};

type ContentData = {
  title?: string;
  imageUrl?: string;
  description?: string;
  altText?: string;
  metaTitle?: string;
  metaDescription?: string;
  body?: string;
  fields?: any[];
  slug?: string;
};

function validateContent(data: ContentData): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!data.title || data.title.trim().length < 3) {
    issues.push({ id: "no-title", type: "error", category: "Content", message: "Title is missing or too short (min 3 characters)", action: "Add a descriptive title" });
  } else if (data.title.length > 60) {
    issues.push({ id: "title-long", type: "warning", category: "SEO", message: `Title is ${data.title.length} characters — SEO titles should be under 60`, action: "Shorten the title for better SEO" });
  }

  if (!data.imageUrl && !data.altText) {
    issues.push({ id: "no-image", type: "warning", category: "Content", message: "No featured image — pages with images get more engagement", action: "Add a featured image" });
  }

  if (data.imageUrl && !data.altText) {
    issues.push({ id: "no-alt", type: "error", category: "Accessibility", message: "Image is missing alt text — required for accessibility and SEO", action: "Add descriptive alt text to the image" });
  }

  if (!data.description && !data.body) {
    issues.push({ id: "no-description", type: "warning", category: "Content", message: "No description or body content", action: "Add content to help visitors understand what's offered" });
  }

  if (data.body && data.body.length < 50) {
    issues.push({ id: "thin-content", type: "warning", category: "SEO", message: "Content is very short — aim for at least 150 words for better SEO", action: "Expand the content" });
  }

  if (!data.metaTitle) {
    issues.push({ id: "no-meta-title", type: "info", category: "SEO", message: "No SEO meta title set — search engines will use the page title", action: "Set a custom SEO title in the SEO tab" });
  }

  if (!data.metaDescription) {
    issues.push({ id: "no-meta-desc", type: "info", category: "SEO", message: "No meta description — add one to improve click-through from search results", action: "Write a 140–160 character meta description" });
  }

  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    issues.push({ id: "bad-slug", type: "warning", category: "SEO", message: "URL slug contains uppercase letters or special characters", action: "Use only lowercase letters, numbers, and hyphens" });
  }

  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 10 - (issues.filter((i) => i.type === "info").length * 5));
  const passed = errors === 0;

  return { score, passed, issues };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onPublish: () => Promise<void>;
  data: ContentData;
  title?: string;
};

export function PublishValidationModal({ open, onClose, onPublish, data, title = "Content" }: Props) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [ran, setRan] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const runValidation = () => {
    const r = validateContent(data);
    setResult(r);
    setRan(true);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
      onClose();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpen = (o: boolean) => {
    if (!o) {
      setRan(false);
      setResult(null);
      onClose();
    } else {
      runValidation();
    }
  };

  // Run validation when opened
  if (open && !ran) {
    runValidation();
  }

  const errors = result?.issues.filter((i) => i.type === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.type === "warning") ?? [];
  const infos = result?.issues.filter((i) => i.type === "info") ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Pre-Publish Validation
          </DialogTitle>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            {/* Score */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={result.score >= 75 ? "#16a34a" : result.score >= 50 ? "#d97706" : "#dc2626"}
                    strokeWidth="3"
                    strokeDasharray={`${result.score} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${result.score >= 75 ? "text-green-700" : result.score >= 50 ? "text-amber-700" : "text-red-700"}`}>
                    {result.score}
                  </span>
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className={`text-sm ${result.score >= 75 ? "text-green-700" : result.score >= 50 ? "text-amber-700" : "text-red-700"}`}>
                  {result.score >= 75 ? "Ready to publish" : result.score >= 50 ? "Some issues to review" : "Critical issues found"}
                </p>
                <div className="flex gap-2 mt-1.5">
                  {errors.length > 0 && <Badge variant="destructive" className="text-xs">{errors.length} error{errors.length > 1 ? "s" : ""}</Badge>}
                  {warnings.length > 0 && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">{warnings.length} warning{warnings.length > 1 ? "s" : ""}</Badge>}
                  {infos.length > 0 && <Badge variant="secondary" className="text-xs">{infos.length} tip{infos.length > 1 ? "s" : ""}</Badge>}
                  {result.issues.length === 0 && <Badge className="text-xs bg-green-100 text-green-700 border-green-200">All checks passed</Badge>}
                </div>
              </div>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {[...errors, ...warnings, ...infos].map((issue) => (
                  <div
                    key={issue.id}
                    className={`flex gap-3 p-3 rounded-lg border text-sm ${issue.type === "error"
                      ? "bg-red-50 border-red-100"
                      : issue.type === "warning"
                        ? "bg-amber-50 border-amber-100"
                        : "bg-slate-50 border-slate-100"
                      }`}
                  >
                    {issue.type === "error"
                      ? <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      : issue.type === "warning"
                        ? <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        : <CheckCircle2 className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    }
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-wide mr-2 ${issue.type === "error" ? "text-red-600" : issue.type === "warning" ? "text-amber-600" : "text-slate-400"}`}>
                        {issue.category}
                      </span>
                      <p className="text-slate-700 mt-0.5">{issue.message}</p>
                      {issue.action && <p className={`text-xs mt-1 ${issue.type === "error" ? "text-red-600" : issue.type === "warning" ? "text-amber-600" : "text-slate-500"}`}>→ {issue.action}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.issues.length === 0 && (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100 text-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium">All checks passed — this content is ready to publish!</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {errors.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePublish} disabled={isPublishing} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publish Anyway
              </Button>
            </div>
          ) : (
            <Button onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isPublishing ? "Publishing…" : "Publish Now"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
