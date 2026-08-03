/**
 * useModuleData — consistent state shape for Convex query results that may
 * return `null` when access is denied or the module is disabled for a site.
 *
 * Usage:
 *   const { data, isLoading, isAccessDenied } = useModuleData(useQuery(api.foo.list, { siteId }));
 *
 * Then in JSX:
 *   if (isLoading) return <Skeleton />;
 *   if (isAccessDenied) return <ModuleAccessDenied />;
 *   // data is typed as T (non-null, non-undefined)
 */
export interface ModuleDataResult<T> {
  /** The resolved data value, or undefined while loading, or null when denied. */
  data: T | null | undefined;
  /** True while the query has not yet returned (Convex returns `undefined`). */
  isLoading: boolean;
  /** True when the query returned `null` — access denied or module disabled. */
  isAccessDenied: boolean;
}

/**
 * Converts a raw Convex `useQuery` result into a structured `ModuleDataResult`.
 * Pass the result of `useQuery(...)` directly; do NOT call inside a condition.
 *
 * @example
 *   const result = useQuery(api.articles.list, { siteId });
 *   const { isLoading, isAccessDenied, data } = parseModuleData(result);
 */
export function parseModuleData<T>(queryResult: T | null | undefined): ModuleDataResult<T> {
  return {
    data: queryResult,
    isLoading: queryResult === undefined,
    isAccessDenied: queryResult === null,
  };
}
