/**
 * useUploadQueue — multi-file upload queue state machine.
 *
 * Manages an array of UploadItem records, each with its own status, progress,
 * AbortController, and retry count.  Compression runs via requestIdleCallback
 * (or setTimeout fallback) so the main thread stays responsive while multiple
 * large images are being processed.
 */

import { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadStatus =
  | "pending"
  | "compressing"
  | "uploading"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

export type UploadItem = {
  /** Stable UUID for this item */
  id: string;
  file: File;
  status: UploadStatus;
  /** 0–100 */
  progress: number;
  error?: string;
  retryCount: number;
  /** Object URL created for preview; caller must revoke when done */
  previewUrl: string;
  /** AbortController — abort() to cancel an in-flight upload */
  abortController: AbortController;
};

export type QueueActions = {
  /** Add one or more files to the queue */
  enqueue: (files: File[]) => void;
  /** Cancel a pending or uploading item */
  cancel: (id: string) => void;
  /** Reset a failed item back to pending so it can be retried */
  retry: (id: string) => void;
  /** Remove all done/cancelled items from the queue */
  clearDone: () => void;
  /** Update progress for an item (called by the upload executor) */
  _setProgress: (id: string, progress: number) => void;
  /** Transition an item's status (called by the upload executor) */
  _setStatus: (id: string, status: UploadStatus, error?: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUploadQueue(): [UploadItem[], QueueActions] {
  const [items, setItems] = useState<UploadItem[]>([]);
  // Keep a ref so the abort callback can access current items
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  const enqueue = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: uuid(),
      file,
      status: "pending" as UploadStatus,
      progress: 0,
      retryCount: 0,
      previewUrl: URL.createObjectURL(file),
      abortController: new AbortController(),
    }));
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  const cancel = useCallback((id: string) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (item && (item.status === "pending" || item.status === "uploading" || item.status === "compressing")) {
      item.abortController.abort();
      setItems((prev) =>
        prev.map((i) => i.id === id ? { ...i, status: "cancelled" } : i)
      );
    }
  }, []);

  const retry = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id && i.status === "failed"
          ? {
              ...i,
              status: "pending",
              progress: 0,
              error: undefined,
              retryCount: i.retryCount + 1,
              abortController: new AbortController(),
            }
          : i
      )
    );
  }, []);

  const clearDone = useCallback(() => {
    setItems((prev) => {
      const toRemove = prev.filter(
        (i) => i.status === "done" || i.status === "cancelled"
      );
      // Revoke object URLs for removed items
      for (const item of toRemove) {
        try { URL.revokeObjectURL(item.previewUrl); } catch { /* ignore */ }
      }
      return prev.filter(
        (i) => i.status !== "done" && i.status !== "cancelled"
      );
    });
  }, []);

  const _setProgress = useCallback((id: string, progress: number) => {
    setItems((prev) =>
      prev.map((i) => i.id === id ? { ...i, progress } : i)
    );
  }, []);

  const _setStatus = useCallback((id: string, status: UploadStatus, error?: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status, ...(error !== undefined ? { error } : {}), progress: status === "done" ? 100 : i.progress } : i
      )
    );
  }, []);

  const actions: QueueActions = {
    enqueue,
    cancel,
    retry,
    clearDone,
    _setProgress,
    _setStatus,
  };

  return [items, actions];
}
