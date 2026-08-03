import { AlertTriangle, AlertCircle, Info, Users, Clock } from "lucide-react";

export type LifecycleAlertType =
  | "nearly_full"
  | "at_capacity"
  | "registration_closed"
  | "event_passed"
  | "flyer_expired"
  | "waitlist"
  | "missing_end_time"
  | "registration_closing_soon";

type AlertProps = {
  type: LifecycleAlertType;
  /** For "waitlist": number of people on the waitlist. */
  count?: number;
};

type AlertStyle = {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
  iconClass: string;
};

const STYLES: Record<"warning" | "info" | "error", AlertStyle> = {
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    iconClass: "text-amber-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    iconClass: "text-blue-500",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    iconClass: "text-red-500",
  },
};

function resolveAlert(
  type: LifecycleAlertType,
  count?: number,
): { variant: keyof typeof STYLES; message: string; IconOverride?: React.ComponentType<{ className?: string }> } {
  switch (type) {
    case "nearly_full":
      return { variant: "warning", message: "This class is nearly full." };
    case "at_capacity":
      return { variant: "error", message: "This class has reached capacity." };
    case "registration_closed":
      return { variant: "info", message: "Registration has closed." };
    case "event_passed":
      return { variant: "info", message: "This event has passed and was moved to Past Events." };
    case "flyer_expired":
      return { variant: "info", message: "This flyer expired and was archived." };
    case "waitlist":
      return {
        variant: "info",
        message: `${count ?? 0} ${count === 1 ? "person is" : "people are"} currently on the waitlist.`,
        IconOverride: Users,
      };
    case "missing_end_time":
      return {
        variant: "warning",
        message: "This event has no end time. Add one for accurate automation.",
      };
    case "registration_closing_soon":
      return {
        variant: "warning",
        message: "Registration closes in 24 hours.",
        IconOverride: Clock,
      };
  }
}

export function LifecycleAlert({ type, count }: AlertProps) {
  const { variant, message, IconOverride } = resolveAlert(type, count);
  const style = STYLES[variant];
  const Icon = IconOverride ?? style.icon;

  return (
    <div
      className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-md border text-sm ${style.bg} ${style.border} ${style.text}`}
    >
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${style.iconClass}`} />
      <span>{message}</span>
    </div>
  );
}

/** Convenience: render a stack of alerts, skipping null entries. */
export function LifecycleAlertList({ alerts }: { alerts: (AlertProps | null | undefined)[] }) {
  const active = alerts.filter(Boolean) as AlertProps[];
  if (active.length === 0) return null;
  return (
    <div className="space-y-2">
      {active.map((a, i) => (
        <LifecycleAlert key={i} {...a} />
      ))}
    </div>
  );
}
