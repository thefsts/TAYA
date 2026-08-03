/**
 * UploadQueue — collapsible panel showing per-file upload status cards.
 *
 * Renders as a sticky panel at the bottom of its container.  When collapsed
 * it shows only a summary badge ("3 of 5 done").
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, X, RotateCcw, CheckCircle2, AlertTriangle, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UploadItem, QueueActions } from "@/hooks/useUploadQueue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function statusLabel(status: UploadItem["status"]): string {
  switch (status) {
    case "pending":     return "Waiting…";
    case "compressing": return "Compressing…";
    case "uploading":   return "Uploading…";
    case "processing":  return "Processing…";
    case "done":        return "Done";
    case "failed":      return "Failed";
    case "cancelled":   return "Cancelled";
  }
}

function statusColor(status: UploadItem["status"]): string {
  switch (status) {
    case "done":        return "text-green-600";
    case "failed":      return "text-red-600";
    case "cancelled":   return "text-slate-400";
    case "uploading":
    case "compressing":
    case "processing":  return "text-primary";
    default:            return "text-slate-500";
  }
}

// ---------------------------------------------------------------------------
// UploadItemCard
// ---------------------------------------------------------------------------

function UploadItemCard({
  item,
  onCancel,
  onRetry,
}: {
  item: UploadItem;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const isActive = item.status === "compressing" || item.status === "uploading" || item.status === "processing";
  const showProgress = isActive && item.progress > 0;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      {/* Thumbnail preview */}
      <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-slate-300 m-auto mt-2.5" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{item.file.name}</p>
        <p className="text-[11px] text-slate-400">{formatBytes(item.file.size)}</p>

        {/* Progress bar */}
        {showProgress && (
          <div className="mt-1 h-1 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200 rounded-full"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}

        {/* Status label */}
        <div className={`flex items-center gap-1 mt-0.5 text-[11px] font-medium ${statusColor(item.status)}`}>
          {item.status === "done" && <CheckCircle2 className="h-3 w-3" />}
          {item.status === "failed" && <AlertTriangle className="h-3 w-3" />}
          {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
          <span>{statusLabel(item.status)}</span>
          {showProgress && <span className="text-slate-400 font-normal">{item.progress}%</span>}
        </div>

        {item.error && (
          <p className="text-[10px] text-red-600 truncate mt-0.5">{item.error}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {item.status === "failed" && (
          <button
            type="button"
            title="Retry"
            onClick={onRetry}
            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        {(item.status === "pending" || isActive) && (
          <button
            type="button"
            title="Cancel"
            onClick={onCancel}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadQueue panel
// ---------------------------------------------------------------------------

type Props = {
  items: UploadItem[];
  actions: QueueActions;
};

export function UploadQueue({ items, actions }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const doneCount   = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const activeCount = items.filter((i) =>
    i.status === "compressing" || i.status === "uploading" || i.status === "processing"
  ).length;

  const hasDoneOrCancelled = items.some(
    (i) => i.status === "done" || i.status === "cancelled"
  );

  return (
    <div className="mt-4 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          {activeCount > 0 && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
          <span className="text-xs font-semibold text-slate-700">
            Upload Queue
          </span>
          {/* Summary badge */}
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
            failedCount > 0
              ? "bg-red-100 text-red-700"
              : doneCount === items.length
              ? "bg-green-100 text-green-700"
              : "bg-primary/10 text-primary"
          }`}>
            {doneCount} of {items.length} done
            {failedCount > 0 && ` · ${failedCount} failed`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasDoneOrCancelled && !collapsed && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2 text-slate-500 hover:text-slate-700"
              onClick={(e) => { e.stopPropagation(); actions.clearDone(); }}
            >
              Clear done
            </Button>
          )}
          {collapsed
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            : <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          }
        </div>
      </div>

      {/* Items list */}
      {!collapsed && (
        <div className="px-4 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <UploadItemCard
              key={item.id}
              item={item}
              onCancel={() => actions.cancel(item.id)}
              onRetry={() => actions.retry(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
