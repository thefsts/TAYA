import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Settings,
  ExternalLink,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Trash2,
  UserCheck,
  UserX,
  ChevronDown,
} from "lucide-react";

type TabKey = "config" | "members";

const PORTAL_ROLES = ["member", "student", "employee", "client", "subscriber", "volunteer", "instructor"];

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
  if (status === "pending_approval") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>;
  if (status === "deactivated") return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">Deactivated</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function FeatureToggle({
  label,
  featureKey,
  checked,
  onChange,
}: {
  label: string;
  featureKey: string;
  checked: boolean;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(featureKey, e.target.checked)}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-primary" : "bg-slate-200"}`}
        />
        <div
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

export default function PortalManager() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("config");
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const site = useQuery(api.sites.get, { siteId });
  const config = useQuery(api.portal.getConfig, { siteId });
  const members = useQuery(api.portal.listUsers, { siteId });
  const saveConfig = useMutation(api.portal.saveConfig);
  const updateStatus = useMutation(api.portal.updateUserStatus);
  const updateRole = useMutation(api.portal.updateUserRole);
  const deleteUser = useMutation(api.portal.deletePortalUser);

  const portalUrl = `${window.location.origin}/portal/${site?.slug ?? ""}`;

  const [form, setForm] = useState({
    enabled: false,
    logoUrl: "",
    welcomeMessage: "",
    primaryColor: "",
    registrationOpen: true,
    requireApproval: false,
    enabledFeatures: {} as Record<string, boolean>,
  });
  const [formReady, setFormReady] = useState(false);

  if (config !== undefined && !formReady) {
    setFormReady(true);
    setForm({
      enabled: config?.enabled ?? false,
      logoUrl: config?.logoUrl ?? "",
      welcomeMessage: config?.welcomeMessage ?? "",
      primaryColor: config?.primaryColor ?? "",
      registrationOpen: config?.registrationOpen ?? true,
      requireApproval: config?.requireApproval ?? false,
      enabledFeatures: (config?.enabledFeatures as Record<string, boolean>) ?? {},
    });
  }

  const handleSave = async () => {
    try {
      await saveConfig({
        siteId,
        enabled: form.enabled,
        logoUrl: form.logoUrl || undefined,
        welcomeMessage: form.welcomeMessage || undefined,
        primaryColor: form.primaryColor || undefined,
        registrationOpen: form.registrationOpen,
        requireApproval: form.requireApproval,
        enabledFeatures: form.enabledFeatures,
      });
      toast({ title: "Portal settings saved." });
    } catch (err: unknown) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateStatus = async (userId: Id<"portalUsers">, status: string) => {
    await updateStatus({ portalUserId: userId, status });
    toast({ title: `User ${status === "active" ? "approved" : "updated"}.` });
  };

  const handleUpdateRole = async (userId: Id<"portalUsers">, role: string) => {
    await updateRole({ portalUserId: userId, role });
    toast({ title: "Role updated." });
  };

  const handleDelete = async (userId: string) => {
    await deleteUser({ portalUserId: userId as Id<"portalUsers"> });
    setDeleteTarget(null);
    toast({ title: "Member removed." });
  };

  const toggleFeature = (key: string, value: boolean) => {
    setForm((f) => ({ ...f, enabledFeatures: { ...f.enabledFeatures, [key]: value } }));
  };

  const loading = config === undefined || site === undefined;

  const pendingCount = (members ?? []).filter((m) => m.status === "pending_approval").length;

  return (
    <AppLayout siteId={siteId} pageContext="Portal Manager™">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portal Manager™</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Configure and manage the Client Portal for your website visitors.
          </p>
        </div>
        {form.enabled && (
          <a href={portalUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              View Portal
            </Button>
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {(["config", "members"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "config" ? <Settings className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
            {t === "config" ? "Configuration" : "Members"}
            {t === "members" && pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0 leading-4 font-semibold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <div className="space-y-6 max-w-2xl">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Portal Status</CardTitle>
                  <CardDescription>Enable or disable the Client Portal for this website.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FeatureToggle
                    label="Client Portal enabled"
                    featureKey="enabled"
                    checked={form.enabled}
                    onChange={(_, v) => setForm((f) => ({ ...f, enabled: v }))}
                  />

                  {form.enabled && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-medium text-slate-500 mb-1">Portal URL</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1.5 truncate">
                          {portalUrl}
                        </code>
                        <Button size="sm" variant="outline" onClick={handleCopy} className="flex-shrink-0 gap-1.5">
                          {copied ? (
                            <><CheckCircle className="h-3.5 w-3.5 text-green-600" /> Copied</>
                          ) : (
                            <><Copy className="h-3.5 w-3.5" /> Copy</>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">Share this URL with your customers so they can access their portal.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Branding</CardTitle>
                  <CardDescription>Customize how the portal looks to your customers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="welcomeMsg">Welcome message</Label>
                    <Textarea
                      id="welcomeMsg"
                      placeholder={`Welcome to ${site?.name ?? ""}`}
                      value={form.welcomeMessage}
                      onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
                      className="mt-1.5 resize-none"
                      rows={2}
                    />
                    <p className="text-xs text-slate-400 mt-1">Shown on the login page. Defaults to the site name.</p>
                  </div>
                  <div>
                    <Label htmlFor="logoUrl">Portal logo URL</Label>
                    <Input
                      id="logoUrl"
                      placeholder="https://example.com/logo.png"
                      value={form.logoUrl}
                      onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-slate-400 mt-1">Overrides the main site logo on portal pages. Leave blank to use the site logo.</p>
                  </div>
                  <div>
                    <Label htmlFor="primaryColor">Primary color</Label>
                    <div className="flex gap-2 mt-1.5">
                      <input
                        type="color"
                        value={form.primaryColor || site?.brandColorPrimary || "#16a34a"}
                        onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                        className="h-9 w-12 rounded border border-slate-200 cursor-pointer"
                      />
                      <Input
                        id="primaryColor"
                        placeholder="#16a34a"
                        value={form.primaryColor}
                        onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Portal accent color. Leave blank to use the site brand color.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registration Settings</CardTitle>
                  <CardDescription>Control how new customers join the portal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FeatureToggle
                    label="Allow public registration"
                    featureKey="registrationOpen"
                    checked={form.registrationOpen}
                    onChange={(_, v) => setForm((f) => ({ ...f, registrationOpen: v }))}
                  />
                  <FeatureToggle
                    label="Require admin approval before access"
                    featureKey="requireApproval"
                    checked={form.requireApproval}
                    onChange={(_, v) => setForm((f) => ({ ...f, requireApproval: v }))}
                  />
                  {form.requireApproval && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                      New registrations will show as "Pending" in the Members tab until you approve them.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Portal Features</CardTitle>
                  <CardDescription>Choose which sections are available to portal members.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: "courses", label: "My Courses" },
                    { key: "events", label: "My Events" },
                    { key: "documents", label: "Secure Documents" },
                    { key: "messages", label: "Messages" },
                    { key: "invoices", label: "Invoices & Receipts" },
                    { key: "certificates", label: "Certificates" },
                    { key: "support", label: "Support Tickets" },
                  ].map(({ key, label }) => (
                    <FeatureToggle
                      key={key}
                      label={label}
                      featureKey={key}
                      checked={form.enabledFeatures[key] ?? false}
                      onChange={toggleFeature}
                    />
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSave} className="gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  Save settings
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "members" && (
        <div>
          {members === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : members === null || members.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-700 font-medium mb-1">No members yet</h3>
              <p className="text-slate-400 text-sm">
                {form.enabled
                  ? "Once customers register, they'll appear here."
                  : "Enable the Client Portal first, then share the portal URL with your customers."}
              </p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Email</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Role</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide px-4 py-3">Joined</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map((member) => (
                      <tr key={String(member._id)} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {member.firstName} {member.lastName}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{member.email}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={member.role}
                            onValueChange={(v) => handleUpdateRole(member._id as Id<"portalUsers">, v)}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs border-slate-200">
                              <SelectValue />
                              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                            </SelectTrigger>
                            <SelectContent>
                              {PORTAL_ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="text-xs capitalize">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            {member.status === "pending_approval" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                onClick={() => handleUpdateStatus(member._id as Id<"portalUsers">, "active")}
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                            )}
                            {member.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                                onClick={() => handleUpdateStatus(member._id as Id<"portalUsers">, "deactivated")}
                              >
                                <UserX className="h-3.5 w-3.5" />
                                Deactivate
                              </Button>
                            )}
                            {member.status === "deactivated" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                onClick={() => handleUpdateStatus(member._id as Id<"portalUsers">, "active")}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Re-activate
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteTarget(String(member._id))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
              {(members ?? []).filter((m) => m.status === "active").length} active
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {pendingCount} pending approval
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-slate-400" />
              {(members ?? []).filter((m) => m.status === "deactivated").length} deactivated
            </span>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete their account and all sessions. They will need to register again to access the portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
