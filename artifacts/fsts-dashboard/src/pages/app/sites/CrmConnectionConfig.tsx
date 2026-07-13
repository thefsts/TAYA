import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, RefreshCw, Unplug, ExternalLink,
  ArrowUpCircle, ArrowDownCircle, Clock, ChevronDown, ChevronRight,
} from "lucide-react";
import { LockedField, DesignLockBanner } from "@/components/LockedField";

type AuthMethod = "api_key" | "oauth" | "sso";

type EntityType =
  | "contact_form" | "quote_request" | "consultation" | "event_registration"
  | "course_registration" | "order" | "customer" | "payment" | "newsletter_signup"
  | "application" | "custom_form" | "lead" | "payment_notification"
  | "marketing_trigger" | "support_ticket" | "review_request" | "automation_event"
  | "appointment_status" | "notes" | "campaign_status" | "lead_status" | "tags" | "profile_update";

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  contact_form: "Contact Form Submissions",
  quote_request: "Quote Requests",
  consultation: "Consultation Requests",
  event_registration: "Event Registrations",
  course_registration: "Course Registrations",
  order: "Orders",
  customer: "Customers",
  payment: "Payments",
  newsletter_signup: "Newsletter Signups",
  application: "Applications",
  custom_form: "Custom Form Submissions",
  lead: "Leads",
  payment_notification: "Payment Notifications",
  marketing_trigger: "Marketing Triggers",
  support_ticket: "Support Tickets",
  review_request: "Review Requests",
  automation_event: "Automation Events",
  appointment_status: "Appointment Status",
  notes: "Notes",
  campaign_status: "Campaign Status",
  lead_status: "Lead Status",
  tags: "Tags",
  profile_update: "Profile Updates",
};

const OUTBOUND_ENTITY_TYPES: EntityType[] = [
  "contact_form", "quote_request", "consultation", "event_registration",
  "course_registration", "order", "customer", "payment", "newsletter_signup",
  "application", "custom_form", "lead", "payment_notification",
  "marketing_trigger", "support_ticket", "review_request", "automation_event",
];

const INBOUND_ENTITY_TYPES: EntityType[] = [
  "appointment_status", "notes", "campaign_status", "lead_status", "tags", "profile_update",
];

const STATUS_BADGE: Record<string, string> = {
  connected: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  not_connected: "bg-slate-100 text-slate-600",
};

const LOG_STATUS_BADGE: Record<string, string> = {
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  retrying: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-600",
};

function relativeTime(ts: number) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function payloadSummary(payload: any): string {
  if (!payload || typeof payload !== "object") return "—";
  const keys = Object.keys(payload).filter((k) => payload[k] != null && k !== "data");
  return keys.slice(0, 3).map((k) => `${k}: ${String(payload[k]).slice(0, 20)}`).join(", ") || "—";
}

export default function CrmConnectionConfig({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const connection = useQuery(api.crm.getConnection, { siteId });
  const updateCrmConnection = useMutation(api.crm.updateConnection);
  const disconnectCrmConnection = useMutation(api.crm.disconnectConnection);
  const testCrmConnection = useMutation(api.crm.testConnection);
  const launchCrmSso = useMutation(api.crm.launchSso);

  const entitySettings = useQuery(api.crm.listEntitySettings, { siteId });
  const updateCrmEntitySetting = useMutation(api.crm.updateEntitySetting);

  const [logEntityFilter, setLogEntityFilter] = useState<string>("all");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");

  const syncLogs = useQuery(api.crm.listSyncLogs, {
    siteId,
    ...(logEntityFilter !== "all" ? { entityType: logEntityFilter } : {}),
    ...(logStatusFilter !== "all" ? { status: logStatusFilter } : {}),
  });
  const retryCrmSyncLog = useMutation(api.crm.retrySyncLog);

  const [authMethod, setAuthMethod] = useState<AuthMethod>("api_key");
  const [accountName, setAccountName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSsoLaunching, setIsSsoLaunching] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [outboundOpen, setOutboundOpen] = useState(true);
  const [inboundOpen, setInboundOpen] = useState(true);

  useEffect(() => {
    if (connection) {
      setAuthMethod((connection.authMethod as AuthMethod) ?? "api_key");
      setAccountName(connection.accountName ?? "");
      setOrgId(connection.orgId ?? "");
      setSsoEnabled(connection.ssoEnabled ?? false);
    }
  }, [connection]);

  function settingFor(entityType: EntityType, direction: string) {
    return entitySettings?.find((s: any) => s.entityType === entityType && s.direction === direction);
  }

  async function handleSaveConnection() {
    setIsSaving(true);
    try {
      await updateCrmConnection({
        siteId,
        authMethod,
        accountName: accountName || undefined,
        orgId: orgId || undefined,
        apiKey: apiKey || undefined,
        ssoEnabled,
      });
      toast({ title: "Operon CRM connection saved" });
      setApiKey("");
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    try {
      const result = await testCrmConnection({ siteId }) as any;
      toast({
        title: result.status === "connected" ? "Connection healthy" : "Connection test finished",
        description: `API health: ${result.apiHealth}`,
      });
    } catch (err) {
      toast({ title: "Test failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSsoLaunch() {
    setIsSsoLaunching(true);
    try {
      const result = await launchCrmSso({ siteId }) as any;
      if (result.available && result.launchUrl) {
        window.open(result.launchUrl, "_blank", "noopener,noreferrer");
      } else {
        toast({ title: "SSO not available", description: result.reason ?? "SSO launch is not currently available.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Something went wrong", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSsoLaunching(false);
    }
  }

  async function confirmDisconnect() {
    setIsDisconnecting(true);
    try {
      await disconnectCrmConnection({ siteId });
      toast({ title: "Disconnected from Operon CRM" });
      setDisconnectOpen(false);
    } catch (err) {
      toast({ title: "Couldn't disconnect", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function toggleEntity(entityType: EntityType, direction: string, enabled: boolean) {
    try {
      await updateCrmEntitySetting({ siteId, entityType, direction, enabled });
    } catch (err) {
      toast({ title: "Couldn't update sync setting", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  async function handleRetry(logId: string) {
    try {
      await retryCrmSyncLog({ siteId, syncLogId: logId as Id<"crmSyncLogs"> });
      toast({ title: "Retry queued" });
    } catch (err) {
      toast({ title: "Retry failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Marketing &amp; CRM</h1>
      <p className="text-sm text-slate-500 mb-6">
        Connect this site to Operon CRM to sync leads, contacts, registrations, payments, and more via the Operon Connector™.
      </p>
      <DesignLockBanner label="CRM Connector Credentials" />

      {/* ── Connection card ── */}
      {connection === undefined ? (
        <Skeleton className="h-72 max-w-xl mb-8" />
      ) : (
        <LockedField capabilityLabel="CRM Connector Credentials">
        <div className="bg-white p-6 rounded-md border border-slate-200 shadow-sm max-w-xl mb-8 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-5 w-5 text-slate-400" />
            <h2 className="font-medium text-slate-900">Operon CRM Connection</h2>
            {connection && (
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[connection.status] ?? STATUS_BADGE.not_connected}`}>
                {connection.status.replace("_", " ")}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Authentication Method</Label>
            <Select value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="oauth">OAuth</SelectItem>
                <SelectItem value="sso">SSO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Operon Account Name</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>

          <div className="space-y-1.5">
            <Label>Organization ID</Label>
            <Input value={orgId} onChange={(e) => setOrgId(e.target.value)} />
          </div>

          {authMethod === "api_key" && (
            <div className="space-y-1.5">
              <Label>
                API Key {connection?.apiKeyLast4 && <span className="text-slate-400">(current: …{connection.apiKeyLast4})</span>}
              </Label>
              <Input type="password" placeholder="Leave blank to keep current" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
          )}

          <div className="flex items-center justify-between py-1">
            <Label>Enable SSO Launch</Label>
            <Switch checked={ssoEnabled} onCheckedChange={setSsoEnabled} />
          </div>

          {connection?.apiHealth && connection.status === "connected" && (
            <p className="text-xs text-slate-500">
              API health: <span className="font-medium">{connection.apiHealth}</span>
              {connection.lastHealthCheckAt && ` · checked ${new Date(connection.lastHealthCheckAt).toLocaleString()}`}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSaveConnection} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Connection"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              <RefreshCw className="h-4 w-4 mr-1" /> {isTesting ? "Testing…" : "Test Connection"}
            </Button>
            {ssoEnabled && (
              <Button variant="outline" onClick={handleSsoLaunch} disabled={isSsoLaunching}>
                <ExternalLink className="h-4 w-4 mr-1" /> Launch Operon SSO
              </Button>
            )}
            {connection?.status === "connected" && (
              <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDisconnectOpen(true)}>
                <Unplug className="h-4 w-4 mr-1" /> Disconnect
              </Button>
            )}
          </div>
        </div>
        </LockedField>
      )}

      {/* ── Entity sync settings ── */}
      <LockedField capabilityLabel="CRM Connector Credentials">
      <div className="mb-8">
        <h2 className="font-medium text-slate-900 mb-1">Entity Sync Settings</h2>
        <p className="text-sm text-slate-500 mb-4">
          Choose which data types sync between this site and Operon CRM. Outbound sends data to Operon; inbound pulls updates back to your dashboard.
        </p>

        {entitySettings === undefined ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="space-y-3 max-w-2xl">
            {/* Outbound group */}
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                onClick={() => setOutboundOpen((v) => !v)}
              >
                <ArrowUpCircle className="h-4 w-4 text-blue-500" />
                Outbound — Site → Operon CRM
                <span className="ml-auto text-xs text-slate-400 font-normal">
                  {entitySettings.filter((s: any) => s.direction === "outbound" && s.enabled).length} of {OUTBOUND_ENTITY_TYPES.length} enabled
                </span>
                {outboundOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
              {outboundOpen && (
                <div className="divide-y divide-slate-100">
                  {OUTBOUND_ENTITY_TYPES.map((entityType) => {
                    const existing = settingFor(entityType, "outbound");
                    const enabled = existing?.enabled ?? false;
                    const lastSyncAt = existing?.lastSyncAt;
                    const lastSyncStatus = existing?.lastSyncStatus;
                    return (
                      <div key={entityType} className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{ENTITY_TYPE_LABELS[entityType]}</p>
                          {lastSyncAt ? (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {relativeTime(lastSyncAt)}
                              {lastSyncStatus && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${LOG_STATUS_BADGE[lastSyncStatus] ?? "bg-slate-100 text-slate-500"}`}>
                                  {lastSyncStatus}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5">Never synced</p>
                          )}
                        </div>
                        <Switch checked={enabled} onCheckedChange={(v) => toggleEntity(entityType, "outbound", v)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inbound group */}
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                onClick={() => setInboundOpen((v) => !v)}
              >
                <ArrowDownCircle className="h-4 w-4 text-green-500" />
                Inbound — Operon CRM → Site
                <span className="ml-auto text-xs text-slate-400 font-normal">
                  {entitySettings.filter((s: any) => s.direction === "inbound" && s.enabled).length} of {INBOUND_ENTITY_TYPES.length} enabled
                </span>
                {inboundOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>
              {inboundOpen && (
                <div className="divide-y divide-slate-100">
                  {INBOUND_ENTITY_TYPES.map((entityType) => {
                    const existing = settingFor(entityType, "inbound");
                    const enabled = existing?.enabled ?? false;
                    const lastSyncAt = existing?.lastSyncAt;
                    const lastSyncStatus = existing?.lastSyncStatus;
                    return (
                      <div key={entityType} className="flex items-center justify-between px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{ENTITY_TYPE_LABELS[entityType]}</p>
                          {lastSyncAt ? (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {relativeTime(lastSyncAt)}
                              {lastSyncStatus && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${LOG_STATUS_BADGE[lastSyncStatus] ?? "bg-slate-100 text-slate-500"}`}>
                                  {lastSyncStatus}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-0.5">Never synced · polled every 30 min</p>
                          )}
                        </div>
                        <Switch checked={enabled} onCheckedChange={(v) => toggleEntity(entityType, "inbound", v)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </LockedField>

      {/* ── Sync logs ── */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div>
            <h2 className="font-medium text-slate-900">Sync Log</h2>
            <p className="text-sm text-slate-500">Recent sync attempts with payload details and retry controls.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={logEntityFilter} onValueChange={setLogEntityFilter}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="All entity types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entity types</SelectItem>
                {[...OUTBOUND_ENTITY_TYPES, ...INBOUND_ENTITY_TYPES].map((et) => (
                  <SelectItem key={et} value={et}>{ENTITY_TYPE_LABELS[et]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="retrying">Retrying</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {syncLogs === undefined ? (
          <Skeleton className="h-40" />
        ) : syncLogs.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-md p-6 text-center">
            No sync activity{logEntityFilter !== "all" || logStatusFilter !== "all" ? " matching the current filters" : " yet"}.
          </p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Entity</th>
                  <th className="px-4 py-2 font-medium">Direction</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Payload</th>
                  <th className="px-4 py-2 font-medium">Message</th>
                  <th className="px-4 py-2 font-medium">Attempt</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syncLogs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {ENTITY_TYPE_LABELS[log.entityType as EntityType] ?? log.entityType}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center gap-1 text-xs ${log.direction === "outbound" ? "text-blue-600" : "text-green-600"}`}>
                        {log.direction === "outbound"
                          ? <ArrowUpCircle className="h-3 w-3" />
                          : <ArrowDownCircle className="h-3 w-3" />}
                        {log.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Badge className={`text-xs ${LOG_STATUS_BADGE[log.status] ?? LOG_STATUS_BADGE.pending}`}>
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs max-w-[180px] truncate" title={JSON.stringify(log.syncPayload)}>
                      {payloadSummary(log.syncPayload)}
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-xs max-w-[160px] truncate" title={log.message}>
                      {log.message ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500 text-center">{log.attempt}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(log._creationTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {log.status === "failed" && (
                        <Button variant="ghost" size="sm" onClick={() => handleRetry(log._id)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect from Operon CRM?</AlertDialogTitle>
            <AlertDialogDescription>
              This site will stop syncing data with Operon CRM until reconnected. Existing sync logs are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect} disabled={isDisconnecting} className="bg-red-600 hover:bg-red-700">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
