import { useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleAccessDenied } from "@/components/ModuleAccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Plug, Plug2,
  ChevronRight, Lock, Zap, Clock, BarChart3, ShieldCheck, ShieldAlert,
} from "lucide-react";

/* ── Provider registry ──────────────────────────────────────────────────── */

type Provider = "square" | "stripe" | "paypal" | "authorize_net" | "clover" | "manual_invoice" | "bank_transfer";

interface ProviderDef {
  id: Provider;
  label: string;
  description: string;
  live: boolean;
  fields: CredentialField[];
}

interface CredentialField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "square",
    label: "Square",
    description: "Point-of-sale, online checkout, and catalog sync.",
    live: true,
    fields: [
      { key: "environment", label: "Environment" },
      { key: "applicationId", label: "Application ID", placeholder: "sq0idp-…", hint: "Found in Square Developer Dashboard → Applications" },
      { key: "locationId", label: "Location ID", hint: "Found in Square Developer Dashboard → Locations" },
      { key: "accessToken", label: "Access Token", secret: true, hint: "Leave blank to keep existing" },
      { key: "webhookSignatureKey", label: "Webhook Signature Key", secret: true, hint: "Square Developer Dashboard → Webhooks" },
    ],
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Flexible payment processing for one-time and recurring payments.",
    live: false,
    fields: [
      { key: "publishableKey", label: "Publishable Key", placeholder: "pk_…" },
      { key: "secretKey", label: "Secret Key", secret: true, placeholder: "sk_…" },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, placeholder: "whsec_…" },
    ],
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Accept PayPal, credit, and debit payments.",
    live: false,
    fields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client Secret", secret: true },
      { key: "webhookId", label: "Webhook ID", hint: "Optional — enables webhook verification" },
    ],
  },
  {
    id: "authorize_net",
    label: "Authorize.net",
    description: "Enterprise-grade gateway with advanced fraud tools.",
    live: false,
    fields: [
      { key: "apiLoginId", label: "API Login ID" },
      { key: "transactionKey", label: "Transaction Key", secret: true },
      { key: "signatureKey", label: "Signature Key", secret: true, hint: "Required for webhook verification" },
    ],
  },
  {
    id: "clover",
    label: "Clover",
    description: "POS and payment processing for brick-and-mortar businesses.",
    live: false,
    fields: [
      { key: "merchantId", label: "Merchant ID" },
      { key: "apiKey", label: "API Key", secret: true },
    ],
  },
  {
    id: "manual_invoice",
    label: "Manual Invoice",
    description: "Track manual invoices without a payment gateway.",
    live: false,
    fields: [
      { key: "businessName", label: "Business Name" },
      { key: "paymentInstructions", label: "Payment Instructions" },
    ],
  },
  {
    id: "bank_transfer",
    label: "Bank Transfer",
    description: "Accept ACH / wire transfers with manual reconciliation.",
    live: false,
    fields: [
      { key: "accountName", label: "Account Name" },
      { key: "instructions", label: "Payment Instructions" },
    ],
  },
];

/* ── Utility ────────────────────────────────────────────────────────────── */

function statusColor(status?: string) {
  if (status === "connected") return "bg-green-100 text-green-700 border-green-200";
  if (status === "error") return "bg-red-100 text-red-700 border-red-200";
  if (status === "pending") return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function healthIcon(health?: string) {
  if (health === "ok") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (health === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  return <AlertTriangle className="w-4 h-4 text-amber-400" />;
}

/* ── Provider card ──────────────────────────────────────────────────────── */

function ProviderCard({
  def,
  record,
  isActive,
  onConfigure,
  onActivate,
  onDisconnect,
}: {
  def: ProviderDef;
  record: any;
  isActive: boolean;
  onConfigure: () => void;
  onActivate: () => void;
  onDisconnect: () => void;
}) {
  const connected = record?.status === "connected";

  return (
    <div className={`bg-white border rounded-xl p-5 flex flex-col gap-3 transition-all ${isActive ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-slate-200"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? "bg-primary/10" : "bg-slate-100"}`}>
            <CreditCard className={`w-5 h-5 ${isActive ? "text-primary" : "text-slate-400"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">{def.label}</h3>
              {isActive && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 font-medium">Active</Badge>}
              {!def.live && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">Coming Soon</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xs">{def.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {record?.healthStatus && (
            <span title={record.healthMessage ?? ""}>
              {healthIcon(record.healthStatus)}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor(record?.status)}`}>
            {record?.status ?? "disconnected"}
          </span>
        </div>
      </div>

      {record?.credentialsMeta && connected && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 space-y-1">
          {Object.entries(record.credentialsMeta as Record<string, unknown>).map(([k, v]) => (
            v !== null && v !== undefined ? (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-mono text-slate-600">{typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}</span>
              </div>
            ) : null
          ))}
          {record.hasWebhookKey !== undefined && (
            <div className="flex justify-between">
              <span className="text-slate-400">Webhook Key</span>
              <span className={record.hasWebhookKey ? "text-green-600 font-medium" : "text-amber-600"}>
                {record.hasWebhookKey ? "Configured" : "Not set"}
              </span>
            </div>
          )}
        </div>
      )}

      {!def.live && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 text-center">
          This provider will be available in a future TAYA release.
        </div>
      )}

      {def.live && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={onConfigure}>
            {connected ? "Edit Credentials" : "Configure"}
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          {connected && !isActive && (
            <Button size="sm" className="flex-1 text-xs h-8" onClick={onActivate}>
              <Plug className="w-3.5 h-3.5 mr-1" /> Set Active
            </Button>
          )}
          {connected && (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={onDisconnect}>
              <Plug2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Credential form dialog ─────────────────────────────────────────────── */

function CredentialDialog({
  open,
  onClose,
  def,
  existingRecord,
  siteId,
}: {
  open: boolean;
  onClose: () => void;
  def: ProviderDef;
  existingRecord: any;
  siteId: Id<"sites">;
}) {
  const { toast } = useToast();
  const saveCredentials = useAction(api.paymentConnectors.saveConnectorCredentials);
  const [saving, setSaving] = useState(false);
  const [env, setEnv] = useState<string>(existingRecord?.environment ?? "sandbox");
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of def.fields) {
      if (f.key !== "environment") init[f.key] = "";
    }
    return init;
  });
  const [checkoutEnabled, setCheckoutEnabled] = useState(existingRecord?.checkoutEnabled ?? false);

  const hasEnvField = def.fields.some((f) => f.key === "environment");

  async function handleSave() {
    setSaving(true);
    try {
      const creds: Record<string, string> = {};
      for (const f of def.fields) {
        if (f.key === "environment") continue;
        const val = fields[f.key]?.trim();
        if (val) creds[f.key] = val;
      }
      if (hasEnvField) creds["environment"] = env;

      const result = await saveCredentials({
        siteId,
        provider: def.id,
        environment: hasEnvField ? (env as "sandbox" | "production") : undefined,
        credentials: creds,
        checkoutEnabled,
      });

      if (!result.hasEncryption) {
        toast({
          title: "Credentials saved (unencrypted)",
          description: "Set PAYMENT_ENCRYPTION_KEY in Convex environment variables to enable at-rest encryption.",
          variant: "destructive",
        });
      } else {
        toast({ title: `${def.label} credentials saved` });
      }
      onClose();
    } catch (err) {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400" />
            {def.label} Credentials
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Credentials are encrypted server-side with AES-256-GCM before storage. Raw secrets never reach the client.</span>
          </div>

          {hasEnvField && (
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select value={env} onValueChange={setEnv}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {def.fields.filter((f) => f.key !== "environment").map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>
                {f.label}
                {f.secret && existingRecord?.status === "connected" && (
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">(leave blank to keep current)</span>
                )}
              </Label>
              <Input
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder ?? ""}
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
              {f.hint && <p className="text-xs text-slate-400">{f.hint}</p>}
            </div>
          ))}

          <div className="flex items-center justify-between py-1">
            <Label>Enable Checkout</Label>
            <Switch checked={checkoutEnabled} onCheckedChange={setCheckoutEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Credentials"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Providers tab ──────────────────────────────────────────────────────── */

function ProvidersTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const connectors = useQuery(api.paymentConnectors.listConnectors, { siteId });
  const activeConnector = useQuery(api.paymentConnectors.getActiveConnector, { siteId });
  const setActive = useMutation(api.paymentConnectors.setActiveConnector);
  const disconnect = useMutation(api.paymentConnectors.disconnectConnector);

  const [configuring, setConfiguring] = useState<ProviderDef | null>(null);
  const [disconnecting, setDisconnecting] = useState<Provider | null>(null);
  const [activating, setActivating] = useState<Provider | null>(null);

  if (connectors === undefined) return <Skeleton className="h-64 mt-4" />;
  if (connectors === null) return <ModuleAccessDenied message="Unable to load payment providers — you may not have access to this site or the payments module is disabled." />;

  const recordMap = new Map<string, any>((connectors as any[]).map((r: any) => [r.provider, r]));

  async function handleActivate(provider: Provider) {
    try {
      await setActive({ siteId, provider });
      toast({ title: `${PROVIDERS.find((p) => p.id === provider)?.label} set as active provider` });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setActivating(null);
    }
  }

  async function handleDisconnect(provider: Provider) {
    try {
      await disconnect({ siteId, provider });
      toast({ title: "Provider disconnected" });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {!activeConnector && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">No active payment provider</p>
            <p className="text-xs mt-0.5">Configure and activate a provider to enable payment processing on your site.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((def) => (
          <ProviderCard
            key={def.id}
            def={def}
            record={recordMap.get(def.id)}
            isActive={activeConnector?.provider === def.id}
            onConfigure={() => setConfiguring(def)}
            onActivate={() => setActivating(def.id)}
            onDisconnect={() => setDisconnecting(def.id)}
          />
        ))}
      </div>

      {configuring && (
        <CredentialDialog
          open
          onClose={() => setConfiguring(null)}
          def={configuring}
          existingRecord={recordMap.get(configuring.id)}
          siteId={siteId}
        />
      )}

      <AlertDialog open={!!disconnecting} onOpenChange={(o) => !o && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {PROVIDERS.find((p) => p.id === disconnecting)?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all stored credentials for this provider. Active payment processing will stop if this is your active provider. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnecting && handleDisconnect(disconnecting)} className="bg-red-600 hover:bg-red-700">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!activating} onOpenChange={(o) => !o && setActivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set {PROVIDERS.find((p) => p.id === activating)?.label} as active?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate your current provider and route all new payment actions through {PROVIDERS.find((p) => p.id === activating)?.label}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => activating && handleActivate(activating)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Health tab ─────────────────────────────────────────────────────────── */

function HealthTab({ siteId }: { siteId: Id<"sites"> }) {
  const { toast } = useToast();
  const connectors = useQuery(api.paymentConnectors.listConnectors, { siteId });
  const testConnection = useAction(api.paymentConnectors.testConnection);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message?: string; latencyMs?: number }>>({});

  if (connectors === undefined) return <Skeleton className="h-40 mt-4" />;
  if (connectors === null) return <ModuleAccessDenied message="Unable to load provider health — you may not have access to this site or the payments module is disabled." />;

  const configured = (connectors as any[]).filter((c: any) => c.status === "connected");

  async function handleTest(provider: string) {
    setTesting(provider);
    try {
      const result = await testConnection({ siteId, provider });
      setResults((prev) => ({ ...prev, [provider]: result as any }));
      if ((result as any).ok) {
        toast({ title: "Connection successful", description: (result as any).message });
      } else {
        toast({ title: "Connection failed", description: (result as any).message, variant: "destructive" });
      }
    } catch (err) {
      setResults((prev) => ({ ...prev, [provider]: { ok: false, message: err instanceof Error ? err.message : String(err) } }));
      toast({ title: "Test failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {configured.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No connected providers</p>
          <p className="text-sm text-slate-400 mt-1">Configure a payment provider first to test its connection.</p>
        </div>
      ) : (
        configured.map((c: any) => {
          const def = PROVIDERS.find((p) => p.id === c.provider);
          const res = results[c.provider];
          return (
            <div key={c.provider} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {healthIcon(res ? (res.ok ? "ok" : "error") : c.healthStatus)}
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">{def?.label ?? c.provider}</h3>
                    <p className="text-xs text-slate-500">
                      {res?.message ?? c.healthMessage ?? "Run test to check status"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {res?.latencyMs && (
                    <span className="text-xs text-slate-400 font-mono">{res.latencyMs}ms</span>
                  )}
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleTest(c.provider)} disabled={testing === c.provider}>
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${testing === c.provider ? "animate-spin" : ""}`} />
                    {testing === c.provider ? "Testing…" : "Test Connection"}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                <div>
                  <div className="text-slate-400 mb-0.5">Environment</div>
                  <div className="capitalize font-medium text-slate-700">{c.environment ?? "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-0.5">Last Checked</div>
                  <div className="font-medium text-slate-700">{c.lastHealthCheckAt ? new Date(c.lastHealthCheckAt).toLocaleString() : "Never"}</div>
                </div>
                <div>
                  <div className="text-slate-400 mb-0.5">Webhook Key</div>
                  <div className={c.hasWebhookKey ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                    {c.hasWebhookKey ? "Configured" : "Missing"}
                  </div>
                </div>
              </div>
              {!c.hasWebhookKey && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Webhook signature key is not configured. Webhook events from this provider will be rejected to prevent spoofing. Configure the key in the Providers tab.</span>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ── Transaction Log tab ────────────────────────────────────────────────── */

function TransactionLogTab({ siteId }: { siteId: Id<"sites"> }) {
  const events = useQuery(api.paymentConnectors.listPaymentEvents, { siteId, limit: 100 });

  if (events === undefined) return <Skeleton className="h-48 mt-4" />;
  if (events === null) return <ModuleAccessDenied message="Unable to load payment events — you may not have access to this site or the payments module is disabled." />;

  const statusBadge: Record<string, string> = {
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
    pending: "bg-yellow-100 text-yellow-700",
  };

  return (
    <div className="mt-4">
      {(events as any[]).length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No payment events recorded yet</p>
          <p className="text-sm text-slate-400 mt-1">Events appear here as your connector processes payments and webhooks.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(events as any[]).map((e: any) => (
                <tr key={e._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(e._creationTime).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs capitalize">{e.provider}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.eventType}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[e.status] ?? "bg-slate-100 text-slate-600"}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.amountCents != null ? `$${(e.amountCents / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                    {e.errorMessage ?? (e.entityType ? `${e.entityType}${e.entityId ? ` #${e.entityId}` : ""}` : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Settings tab ───────────────────────────────────────────────────────── */

function SettingsTab({ siteId }: { siteId: Id<"sites"> }) {
  const activeConnector = useQuery(api.paymentConnectors.getActiveConnector, { siteId });
  const site = useQuery(api.sites.get, { siteId });

  if (activeConnector === undefined || site === undefined) return <Skeleton className="h-40 mt-4" />;

  return (
    <div className="mt-4 space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Active Provider Summary</h3>
        {!activeConnector ? (
          <p className="text-sm text-slate-500">No active provider selected. Activate a provider from the Providers tab.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Provider</span>
              <span className="font-medium capitalize text-slate-900">{PROVIDERS.find((p) => p.id === activeConnector.provider)?.label ?? activeConnector.provider}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Status</span>
              <span className={`font-medium capitalize ${activeConnector.status === "connected" ? "text-green-600" : "text-red-500"}`}>{activeConnector.status}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Environment</span>
              <span className="font-medium capitalize text-slate-900">{activeConnector.environment ?? "—"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Checkout Enabled</span>
              <span className={activeConnector.checkoutEnabled ? "text-green-600 font-medium" : "text-slate-400"}>{activeConnector.checkoutEnabled ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Webhook Guard</span>
              <div className="flex items-center gap-1.5">
                {activeConnector.hasWebhookKey
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 font-medium">Active</span></>
                  : <><ShieldAlert className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-600">Signature key missing</span></>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-2 text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-slate-400" />
          Webhook Endpoint
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Register this URL in your payment provider's dashboard to receive real-time payment events.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 break-all select-all">
          https://clean-marlin-94.convex.cloud/api/payment/webhook?provider={activeConnector?.provider ?? "square"}&slug={site?.slug ?? ""}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Requests without a valid provider signature are rejected with HTTP 401 — no silent failures.
        </p>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function PaymentProviders({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Providers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Payment Connector Framework™ — connect, configure, and switch payment providers without touching website code.
          </p>
        </div>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="health">Health Monitor</TabsTrigger>
          <TabsTrigger value="log">Transaction Log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="providers"><ProvidersTab siteId={siteId} /></TabsContent>
        <TabsContent value="health"><HealthTab siteId={siteId} /></TabsContent>
        <TabsContent value="log"><TransactionLogTab siteId={siteId} /></TabsContent>
        <TabsContent value="settings"><SettingsTab siteId={siteId} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
