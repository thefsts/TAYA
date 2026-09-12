/**
 * useClientSafeQuery.ts
 *
 * HOTFIX (production no-go, BLOCKER 2 §3) — client-safe degraded queries.
 *
 * Production shipped the 542d340 frontend against Convex backend
 * 20260909T184550Z-5919c54edbed, which predates it: the backend is missing
 * the editorZones functions the new frontend subscribes to. Convex's plain
 * useQuery THROWS on server errors (convex 1.42.1, react/client.js:
 * `if (result instanceof Error) throw result;`) — that throw unmounted the
 * whole app (RootErrorBoundary → "App failed to start" + a raw stack trace
 * for every client).
 *
 * This hook uses useQuery_experimental({ throwOnError: false }) — the
 * official non-throwing API — and maps to a discriminated result:
 *
 *   { status: "pending" }            — loading
 *   { status: "success", data }      — normal data
 *   { status: "error", error }       — degraded; surface never throws
 *
 * DESIGN RULES (from the incident review — do not regress):
 *   1. This hook is a PURE wrapper: no state, no callbacks, identical hooks
 *      on every render. (An earlier draft returned a `retry` callback from
 *      the error branch — a Rules-of-Hooks violation that throws "Rendered
 *      fewer hooks than expected" when the query recovers.)
 *   2. Args pass through UNTOUCHED. (An earlier draft injected a retry epoch
 *      into args; a strict server validator would reject the unknown field
 *      and keep the query erroring FOREVER — even after the backend deploy.)
 *   3. Retry is the CALLER's job, by remounting the subscribing component:
 *      convex fully deletes a query when its last subscriber leaves
 *      (browser/sync/local_state.js removeSubscriber) and a fresh mount
 *      re-subscribes with a new query id (browser/sync/client.js) — a
 *      genuine re-fetch. VisualEditor implements this as a parent-held
 *      `attempt` counter keyed on the inner component.
 *
 * This is a degraded-state bridge for backend/frontend drift windows (like
 * the production incident). It is not a substitute for deploying the
 * backend — the backend deploy is tracked as its own PM-gated item.
 */
import { useQuery_experimental } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

export type ClientSafeQueryState<Data> =
  | { status: "pending" }
  | { status: "success"; data: Data }
  | { status: "error"; error: Error };

/**
 * Subscribe to a Convex query without ever throwing on server errors.
 * `args` follows the same convention as useQuery ("skip" disables).
 * Recovery = caller remounts the component (see header note 3).
 */
export function useClientSafeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): ClientSafeQueryState<FunctionReturnType<Query>> {
  const result = useQuery_experimental<Query, false>({
    query,
    args,
    throwOnError: false,
  });
  if (result.status === "success") {
    return { status: "success", data: result.data };
  }
  if (result.status === "error") {
    return { status: "error", error: result.error };
  }
  return { status: "pending" };
}
