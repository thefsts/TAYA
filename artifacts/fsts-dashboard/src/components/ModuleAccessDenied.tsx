import { ShieldAlert } from "lucide-react";

interface Props {
  /** Optional custom message. Falls back to a generic access-denied/module-disabled message. */
  message?: string;
  className?: string;
}

/**
 * Rendered when a Convex query returns `null`, which signals that the caller
 * does not have access to the site or that the module is disabled.
 *
 * Use alongside `parseModuleData` from `@/hooks/use-module-data`:
 *
 *   const { isLoading, isAccessDenied, data } = parseModuleData(useQuery(...));
 *   if (isLoading) return <Skeleton />;
 *   if (isAccessDenied) return <ModuleAccessDenied />;
 */
export function ModuleAccessDenied({ message, className = "max-w-xl" }: Props) {
  return (
    <div
      className={`rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700 ${className}`}
    >
      <div className="flex items-center gap-2 mb-1 font-medium">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        Access denied
      </div>
      <p>
        {message ??
          "Unable to load this module — you may not have access to this site or the module is disabled."}
      </p>
    </div>
  );
}
