/**
 * convex-react shim — the REAL convex/react hooks, re-implemented over
 * the harness dispatcher (POST /harness/api). Same hook signatures the
 * REAL VisualEditor.tsx + SmartImageUploader + ImagePickerField use:
 *
 *   useQuery(apiRef | "skip", args)  → data | undefined
 *   useMutation(apiRef)              → (args) => Promise<result>
 *   useAction(apiRef)                → (args) => Promise<result>
 *
 * apiRef is a string path like "editorZones.addBlock" (the api proxy shim
 * converts property chains to strings — same pattern as the generated api
 * module's anyApi). Re-fetches every query when the store version ticks
 * (mutations bump it), so React re-renders with fresh server state exactly
 * like Convex reactivity.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* ── api path proxy (string chains, like anyApi) ─────────────────────── */
export function makeApiPath(root: string): any {
  const fn: any = function () {
    return root;
  };
  fn.path = root;
  fn.toString = () => root;
  fn.valueOf = () => root;
  Object.defineProperty(fn, Symbol.toPrimitive, { value: () => root, configurable: true });
  return new Proxy(fn, {
    get(target: any, key: string | symbol) {
      if (typeof key === "symbol") return target[key];
      if (key === "toString" || key === "valueOf" || key === "path") return target[key];
      return makeApiPath(`${root}.${String(key)}`);
    },
  });
}

function apiPath(apiRef: any): string | null {
  if (apiRef == null) return null;
  if (typeof apiRef === "string") return apiRef;
  if (typeof apiRef?.path === "string") return apiRef.path;
  try {
    return String(apiRef);
  } catch {
    return null;
  }
}

/* ── store version (bumped on every mutation; drives re-subscribe) ───── */
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function notifyStoreChange() {
  version += 1;
  for (const l of listeners) l();
}

function useStoreVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

async function callHarness(path: string, kind: "query" | "mutation" | "action", args: unknown) {
  const res = await fetch("/harness/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, kind, args }),
  });
  if (!res.ok) throw new Error(`harness api ${res.status}`);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error);
  return body.data;
}

/* ── hooks ───────────────────────────────────────────────────────────── */
export function useQuery(apiRef: any, args: any) {
  const path = apiPath(apiRef);
  const skip = args === "skip" || args === undefined;
  const v = useStoreVersion();
  const [data, setData] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(!skip);
  const argsKey = JSON.stringify(args ?? null);
  const seq = useRef(0);

  useEffect(() => {
    if (skip || !path) return;
    const my = ++seq.current;
    let alive = true;
    (async () => {
      try {
        const result = await callHarness(path, "query", JSON.parse(argsKey));
        if (alive && my === seq.current) {
          setData(result === undefined ? undefined : result);
          setLoading(false);
        }
      } catch (e) {
        if (alive && my === seq.current) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [path, argsKey, skip, v]);

  return data;
}

export function useMutation(apiRef: any) {
  const path = apiPath(apiRef);
  return useCallback(
    async (args: any) => {
      if (!path) throw new Error("no api path");
      const result = await callHarness(path, "mutation", args);
      notifyStoreChange();
      return result;
    },
    [path],
  );
}

export function useAction(apiRef: any) {
  const path = apiPath(apiRef);
  return useCallback(
    async (args: any) => {
      if (!path) throw new Error("no api path");
      const result = await callHarness(path, "action", args);
      notifyStoreChange();
      return result;
    },
    [path],
  );
}

export function useConvexAuth() {
  return { isAuthenticated: true, isLoading: false };
}

export function useConvex() {
  return {
    query: async (path: string, args: any) => callHarness(path, "query", args),
    mutation: async (path: string, args: any) => {
      const r = await callHarness(path, "mutation", args);
      notifyStoreChange();
      return r;
    },
    action: async (path: string, args: any) => {
      const r = await callHarness(path, "action", args);
      notifyStoreChange();
      return r;
    },
  };
}
