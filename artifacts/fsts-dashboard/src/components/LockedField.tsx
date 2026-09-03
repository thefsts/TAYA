import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface LockedFieldProps {
  children: React.ReactNode;
  capabilityLabel?: string;
  className?: string;
}

/**
 * LockedField — wraps a form input or edit button that maps to a design-locked
 * capability. If the current user is not a super-admin the slot is visually
 * disabled and a lock tooltip is shown. Super-admins see the slot normally.
 */
export function LockedField({
  children,
  capabilityLabel,
  className,
}: LockedFieldProps) {
  const me = useQuery(api.users.me);

  if (me === undefined || me === null) return null;

  if (me.isSuperAdmin) {
    return <div className={className}>{children}</div>;
  }

  const tooltip = capabilityLabel
    ? `"${capabilityLabel}" is managed by TAYA administrators and cannot be edited.`
    : "This setting is managed by TAYA administrators and cannot be edited.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`relative ${className ?? ""}`}>
          <div className="pointer-events-none select-none opacity-40">
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-end pr-3 pointer-events-none">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <div className="flex items-start gap-2">
          <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
          <span>{tooltip}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * DesignLockBanner — a compact read-only banner shown at the top of
 * design-locked pages when viewed by a client-role user. Since the route
 * guard already blocks navigation to fully-locked pages, this component is
 * used inside pages that are partially locked (e.g. a page with both content
 * and design sections).
 */
export function DesignLockBanner({ label }: { label: string }) {
  const me = useQuery(api.users.me);

  if (!me || me.isSuperAdmin) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-6">
      <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" />
      <span>
        <strong>{label}</strong> is controlled by TAYA administrators.
        Contact your TAYA representative to request changes.
      </span>
    </div>
  );
}
