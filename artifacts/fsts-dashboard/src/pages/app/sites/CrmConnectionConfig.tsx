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
import { Building2, RefreshCw, Unplug, ExternalLink } from "lucide-react";

type AuthMethod = "api_key" | "oauth" | "sso";
type EntityType =
  | "contact_form" | "quote_request" | "consultation" | "event_registration"
  | "course_registration" | "order" | "customer" | "payment" | "newsletter_signup"
  | "application" | "custom_form" | "appointment_status" | "notes"
  | "campaign_status" | "lead_status" | "tags" | "profile_update";

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
  appointment_status: "Appointment Status",
  notes: "Notes",
  campaign_status: "Campaign Status",
  lead_status: "Lead Status",
  tags: "Tags",
  profile_update: "Profile Updates",
};

const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS) as EntityType[];

const OUTBOUND_ENTITY_TYPES = new Set<EntityType>([
  "contact_form", "quote_request", "consultation", "event_registration",
  "course_registration", "order", "customer", "payment", "newsletter_signup",
  "application", "custom_form",
]);

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

  const syncLogs = useQuery(api.crm.listSyncLogs, { siteId });
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

  useEffect(() => {
    if (connection) {
      setAuthMethod((connection.authMethod as AuthMethod) ?? "api_key");
      setAccountName(connection.accountName ?? "");
      setOrgId(connection.orgId ?? "");
      setSsoEnabled(connection.ssoEnabled ?? false);
    }
  }, [connection]);

  function settingFor(entityType: EntityType) {
    return entitySettings?.find((s: any) => s.entityType === entityType);
  }

  function defaultDirection(entityType: EntityType) {
    return OUTBOUND_ENTITY_TYPES.has(entityType) ? "outbound" : "inbound";
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
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
      toast({
        title: "Test failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
        toast({
          title: "SSO not available",
          description: result.reason ?? "SSO launch is not currently available for this connection.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
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
      toast({
        title: "Couldn't disconnect",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function toggleEntity(entityType: EntityType, enabled: boolean) {
    const existing = settingFor(entityType);
    try {
      await updateCrmEntitySetting({
        siteId,
        entityType,
        direction: (existing?.direction as string) ?? defaultDirection(entityType),
        enabled,
      });
    } catch (err) {
      toast({
        title: "Couldn't update sync setting",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function handleRetry(logId: string) {
    try {
      await retryCrmSyncLog({ siteId, syncLogId: logId as Id<"crmSyncLogs"> });
      toast({ title: "Retry queued" });
    } catch (err) {
      toast({
        title: "Retry failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  return (
    <AppLayout siteId={params.siteId}>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Marketing &amp; CRM</h1>
      <p className="text-sm text-slate-500 mb-6">
        Connect this site to Operon CRM to sync leads, contacts, and marketing activity via the Operon Connector.
      </p>

      {connection === undefined ? (
        <Skeleton className="h-72 max-w-xl" />
      ) : (
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
      )}

      <div className="mb-8">
        <h2 className="font-medium text-slate-900 mb-1">Entity Sync Settings</h2>
        <p className="text-sm text-slate-500 mb-4">Choose which data types sync between this site and Operon CRM.</p>

        {entitySettings === undefined ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100 max-w-2xl">
            {ENTITY_TYPES.map((entityType) => {
              const existing = settingFor(entityType);
              const enabled = existing?.enabled ?? false;
              const direction = existing?.direction ?? defaultDirection(entityType);
              return (
                <div key={entityType} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{ENTITY_TYPE_LABELS[entityType]}</p>
                    <p className="text-xs text-slate-400 capitalize">{direction}</p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={(v) => toggleEntity(entityType, v)} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium text-slate-900 mb-1">Sync Logs</h2>
        <p className="text-sm text-slate-500 mb-4">Recent sync attempts between this site and Operon CRM.</p>

        {syncLogs === undefined ? (
          <Skeleton className="h-40" />
        ) : syncLogs.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-md p-6 text-center">
            No sync activity yet.
          </p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Entity</th>
                  <th className="px-4 py-2 font-medium">Direction</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Attempt</th>
                  <th className="px-4 py-2 font-medium">Message</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {syncLogs.map((log: any) => (
                  <tr key={log._id}>
                    <td className="px-4 py-2">{ENTITY_TYPE_LABELS[log.entityType as EntityType] ?? log.entityType}</td>
                    <td className="px-4 py-2 capitalize">{log.direction}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${LOG_STATUS_BADGE[log.status] ?? LOG_STATUS_BADGE.pending}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">{log.attempt}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-xs truncate">{log.message ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(log._creationTime).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">
                      {log.status === "failed" && (
                        <Button variant="ghost" size="sm" onClick={() => handleRetry(log._id)}>
                          <RefreshCw className="h-4 w-4 mr-1" /> Retry
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
