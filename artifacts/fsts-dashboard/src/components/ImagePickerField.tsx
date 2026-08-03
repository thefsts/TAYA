/**
 * ImagePickerField — reusable image slot that opens SmartImageEditor,
 * saves the result to the site's Media Library, and reports back a URL.
 *
 * Drop-in replacement for a plain URL `<Input>` in any module editor.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SmartImageEditor } from "@/components/SmartImageUploader";
import { Image as ImageIcon, X } from "lucide-react";
import type { AspectPreset } from "@/config/imagePresets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaveData = {
  storageId?: string;
  url?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  optimizedSizeBytes?: number;
  width?: number;
  height?: number;
  altText?: string;
  focalX?: number;
  focalY?: number;
};

type Props = {
  /** Convex site id — required so SmartImageEditor can upload to the right site */
  siteId: string;
  /** Field label shown above the picker */
  label: string;
  /** Current value (resolved CDN/external URL, or empty string) */
  value: string;
  /** Called with the resolved CDN URL (or external URL) after a successful save */
  onChange: (url: string) => void;
  /** Aspect-ratio preset to pre-select in the editor. Defaults to "Original". */
  initialPreset?: AspectPreset;
  /** Optional helper text shown below the field */
  hint?: string;
  /** Extra className applied to the container div */
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImagePickerField({
  siteId,
  label,
  value,
  onChange,
  initialPreset,
  hint,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const createMedia = useMutation(api.media.create);

  /**
   * Called by SmartImageEditor after a successful upload or URL entry.
   * Creates the mediaAssets record in Convex and resolves the CDN URL.
   */
  async function handleSave(data: SaveData) {
    const result = await createMedia({
      siteId: siteId as Id<"sites">,
      ...(data.storageId
        ? { storageId: data.storageId as Id<"_storage"> }
        : {}),
      ...(data.url ? { url: data.url } : {}),
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      ...(data.optimizedSizeBytes !== undefined
        ? { optimizedSizeBytes: data.optimizedSizeBytes }
        : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.altText ? { altText: data.altText } : {}),
      ...(data.focalX !== undefined ? { focalX: data.focalX } : {}),
      ...(data.focalY !== undefined ? { focalY: data.focalY } : {}),
    });

    // buildResponse in media.ts resolves the storage URL — use it directly.
    if (result.url) {
      onChange(result.url);
    }
  }

  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>

      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative group flex-shrink-0">
            <img
              src={value}
              alt={label}
              className="h-16 w-auto max-w-[120px] rounded border border-slate-200 object-contain bg-slate-50 p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className="h-16 w-24 rounded border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => setOpen(true)}
            role="button"
            aria-label={`Choose image for ${label}`}
          >
            <ImageIcon className="h-6 w-6 text-slate-300" />
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {value ? "Change Image" : "Choose Image"}
        </Button>
      </div>

      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}

      <SmartImageEditor
        siteId={siteId}
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        title={`Image — ${label}`}
        initialPreset={initialPreset}
      />
    </div>
  );
}
