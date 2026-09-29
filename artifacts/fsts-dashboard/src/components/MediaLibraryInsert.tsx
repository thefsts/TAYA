/**
 * MediaLibraryInsert — one browse-and-insert modal spanning images, PDFs,
 * and videos (PHASE-1 A5).
 *
 * This is the single "insert from library" surface the visual editor opens
 * from its Add-content panel, so a client browses what already exists on the
 * site instead of re-uploading. It is pure presentation + queries: the caller
 * decides how to apply the returned payload.
 *
 *   - Images: api.media.list (the site's Media Library) → { url, alt }.
 *   - PDFs:   api.downloads.list (the site's Downloads)   → { resourceId, title }.
 *   - Videos: paste a URL, validated by the CANONICAL parseVideoUrl
 *             (YouTube/Vimeo) → the canonical watch/embed payload.
 *
 * No new schema, no new mutations — it reads the same library the rest of the
 * dashboard reads and hands the caller a plain insert payload.
 */

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { parseVideoUrl } from "@convex/lib/videoEmbeds";

export type MediaInsertKind = "image" | "pdf" | "video";

/** What the caller receives when the client picks something to insert. */
export type MediaInsertPayload =
  | { kind: "image"; url: string; alt?: string; fileName?: string }
  | { kind: "pdf"; resourceId: string; title: string }
  | {
      kind: "video";
      watchUrl: string;
      provider: string;
      videoId: string;
      embedUrl: string;
    };

type Props = {
  siteId: string;
  open: boolean;
  onClose: () => void;
  onInsert: (payload: MediaInsertPayload) => void;
  /** Which tabs to show. Defaults to all three. */
  availableKinds?: MediaInsertKind[];
  /** Which tab to open on. Defaults to the first available kind. */
  initialTab?: MediaInsertKind;
};

const ALL_KINDS: MediaInsertKind[] = ["image", "pdf", "video"];

export function MediaLibraryInsert({
  siteId,
  open,
  onClose,
  onInsert,
  availableKinds,
  initialTab,
}: Props) {
  const kinds = availableKinds && availableKinds.length > 0 ? availableKinds : ALL_KINDS;
  const [tab, setTab] = useState<MediaInsertKind>(initialTab ?? kinds[0]);
  const [videoUrl, setVideoUrl] = useState("");

  // Re-seed the active tab each time the modal opens (and when the caller
  // asks for a specific tab, e.g. the image field opens on Images).
  useEffect(() => {
    if (open) setTab(initialTab && kinds.includes(initialTab) ? initialTab : kinds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab]);

  const wantImages = kinds.includes("image");
  const wantPdfs = kinds.includes("pdf");

  const media = useQuery(
    api.media.list,
    open && wantImages ? { siteId: siteId as Id<"sites"> } : "skip",
  );
  const downloads = useQuery(
    api.downloads.list,
    open && wantPdfs ? { siteId: siteId as Id<"sites"> } : "skip",
  );

  const video = videoUrl.trim() !== "" ? parseVideoUrl(videoUrl) : null;

  const insert = (payload: MediaInsertPayload) => {
    onInsert(payload);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert from your library</DialogTitle>
          <DialogDescription>
            Pick something you've already added to this site.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as MediaInsertKind)}>
          <TabsList>
            {wantImages && <TabsTrigger value="image">Images</TabsTrigger>}
            {wantPdfs && <TabsTrigger value="pdf">PDFs</TabsTrigger>}
            {kinds.includes("video") && <TabsTrigger value="video">Videos</TabsTrigger>}
          </TabsList>

          {wantImages && (
            <TabsContent value="image" className="mt-3">
              {media === undefined ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : media.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No images yet. Upload one from the image field, then it will appear here.
                </p>
              ) : (
                <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {media.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={`Insert image ${m.fileName}`}
                      onClick={() =>
                        insert({
                          kind: "image",
                          url: m.url ?? "",
                          alt: m.altText ?? undefined,
                          fileName: m.fileName,
                        })
                      }
                      className="group overflow-hidden rounded-md border border-slate-200 text-left transition hover:border-blue-500"
                    >
                      <img
                        src={m.thumbUrl ?? m.thumbnailUrl ?? m.url ?? ""}
                        alt={m.altText ?? m.fileName}
                        className="h-20 w-full bg-slate-50 object-cover"
                      />
                      <span className="block truncate px-1.5 py-1 text-[11px] text-slate-600">
                        {m.fileName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {wantPdfs && (
            <TabsContent value="pdf" className="mt-3">
              {downloads === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : downloads.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No PDF resources yet. Add one under Content → Downloads.
                </p>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {downloads.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      aria-label={`Insert PDF ${d.title}`}
                      onClick={() => insert({ kind: "pdf", resourceId: d.id, title: d.title })}
                      className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-blue-500"
                    >
                      <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{d.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {kinds.includes("video") && (
            <TabsContent value="video" className="mt-3 space-y-2">
              <label className="text-xs font-medium text-slate-600" htmlFor="media-video-url">
                Video link (YouTube or Vimeo)
              </label>
              <Input
                id="media-video-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              {video && !video.ok && (
                <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{video.reason}</p>
              )}
              {video && video.ok && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    insert({
                      kind: "video",
                      watchUrl: video.watchUrl,
                      provider: video.provider,
                      videoId: video.videoId,
                      embedUrl: video.embedUrl,
                    })
                  }
                >
                  Use this video
                </Button>
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
