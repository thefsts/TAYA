/**
 * useSidebarUi.ts
 *
 * Phase 2: WordPress-like sidebar UI state with localStorage persistence.
 *
 * Persists per-user (per Clerk subject) sidebar preferences:
 *   - collapsedGroups: which nav groups the user collapsed.
 *   - compact: whether the sidebar renders as the icon-only rail.
 *
 * Storage key: `taya.sidebar.v1.<userId>` (falls back to `taya.sidebar.v1`
 * when no user id is available, e.g. while loading).
 *
 * The hook is SSR-safe (reads happen in effects) and defensive against
 * malformed/corrupted localStorage values (silently falls back to defaults).
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "taya.sidebar.v1";

interface SidebarUiState {
  collapsedGroups: string[];
  compact: boolean;
}

const DEFAULT_STATE: SidebarUiState = { collapsedGroups: [], compact: false };

function storageKey(userId?: string | null): string {
  return userId ? `${STORAGE_PREFIX}.${userId}` : STORAGE_PREFIX;
}

function parseStored(raw: string | null): SidebarUiState {
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const collapsed = Array.isArray(parsed.collapsedGroups)
        ? parsed.collapsedGroups.filter((g: unknown): g is string => typeof g === "string")
        : [];
      return { collapsedGroups: collapsed, compact: parsed.compact === true };
    }
  } catch {
    // corrupted JSON → defaults
  }
  return DEFAULT_STATE;
}

/**
 * Sidebar UI preferences (collapsed groups + compact mode) persisted to
 * localStorage per user. `userId` should be the current user's id (or any
 * stable per-user key); pass null while it is still loading.
 */
export function useSidebarUi(userId?: string | null) {
  const [state, setState] = useState<SidebarUiState>(DEFAULT_STATE);
  const key = storageKey(userId);

  // Hydrate from localStorage whenever the key changes (never on the server).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(key);
    } catch {
      stored = null;
    }
    setState(parseStored(stored));
  }, [key]);

  const persist = useCallback(
    (next: SidebarUiState) => {
      setState(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage full/blocked → UI state still works, just not persisted
      }
    },
    [key],
  );

  const toggleGroup = useCallback(
    (groupId: string) => {
      setState((prev) => {
        const next = {
          collapsedGroups: prev.collapsedGroups.includes(groupId)
            ? prev.collapsedGroups.filter((g) => g !== groupId)
            : [...prev.collapsedGroups, groupId],
          compact: prev.compact,
        };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore persistence failure
        }
        return next;
      });
    },
    [key],
  );

  const setCompact = useCallback(
    (compact: boolean) => {
      persist({ ...state, compact });
    },
    [persist, state],
  );

  const toggleCompact = useCallback(() => {
    persist({ ...state, compact: !state.compact });
  }, [persist, state]);

  return { collapsedGroups: state.collapsedGroups, compact: state.compact, toggleGroup, setCompact, toggleCompact };
}
