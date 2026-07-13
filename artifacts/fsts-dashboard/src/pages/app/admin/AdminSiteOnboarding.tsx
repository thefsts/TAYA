import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Redirect, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Building2,
  Settings,
  Users,
  CreditCard,
  Rocket,
  Globe,
  Layers,
  ArrowLeft,
} from "lucide-react";
import {
  WEBSITE_TYPE_OPTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  defaultModulesForWebsiteType,
} from "@/lib/siteModules";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/roleCapabilities";
import { Link } from "wouter";

type OnboardingStep = "details" | "settings" | "agency" | "modules" | "payment" | "users" | "review";

const STEPS: { id: OnboardingStep; label: string; icon: any }[] = [
  { id: "details", label: "Site Details", icon: Globe },
  { id: "settings", label: "Website Settings", icon: Settings },
  { id: "agency", label: "Agency", icon: Building2 },
  { id: "modules", label: "Modules", icon: Layers },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "users", label: "Users", icon: Users },
  { id: "review", label: "Review", icon: Rocket },
];

const PAYMENT_PROVIDERS = [
  { value: "square", label: "Square", description: "Point-of-sale and online payments via Square." },
  { value: "stripe", label: "Stripe", description: "Developer-friendly payments via Stripe." },
  { value: "paypal", label: "PayPal", description: "Checkout via PayPal." },
  { value: "none", label: "None (configure later)", description: "Skip payment setup for now." },
];

type UserRow = { email: string; role: string };

function StepIndicator({ current }: { current: OnboardingStep }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-1 mb-8">
      {STEPS.map((step, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              isComplete
                ? "bg-green-100 text-green-700"
                : isCurrent
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-400"
            }`}>
              {isComplete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-4 ${i < currentIdx ? "bg-green-300" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminSiteOnboarding() {
  const me = useQuery(api.users.me);
  const agencies = useQuery(api.agencies.list);
  const allUsers = useQuery(api.users.list);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const createSite = useMutation(api.sites.create);
  const updateIdentity = useMutation(api.siteSettings.updateIdentity);
  const addSiteRole = useMutation(api.users.addSiteRole);
  const provisionConnector = useMutation(api.paymentConnectors.provisionConnector);
  const setActiveConnector = useMutation(api.paymentConnectors.setActiveConnector);

  const [step, setStep] = useState<OnboardingStep>("details");
  const [isPending, setIsPending] = useState(false);
  const [createdSiteId, setCreatedSiteId] = useState<string | null>(null);

  const [details, setDetails] = useState({
    name: "",
    slug: "",
    status: "staging",
    domain: "",
    brandColorPrimary: "#1d4ed8",
    brandColorSecondary: "#0f172a",
    whiteLabelEnabled: false,
    poweredByFsts: true,
    websiteType: "business_website",
  });

  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");

  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>(
    defaultModulesForWebsiteType("business_website"),
  );

  const [siteSettings, setSiteSettings] = useState({
    businessName: "",
    tagline: "",
    timezone: "America/New_York",
    logoUrl: "",
  });

  const [paymentProvider, setPaymentProvider] = useState("none");

  const [userRows, setUserRows] = useState<UserRow[]>([{ email: "", role: "owner" }]);

  if (me === undefined) return <div className="p-8"><Skeleton className="h-10 w-48 mb-6" /></div>;
  if (!me || !me.isSuperAdmin) return <Redirect to="/app" />;

  function handleWebsiteTypeChange(type: string) {
    setDetails((d) => ({ ...d, websiteType: type }));
    setEnabledModules(defaultModulesForWebsiteType(type));
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function nextStep() {
    const order = STEPS.map((s) => s.id);
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  }

  function prevStep() {
    const order = STEPS.map((s) => s.id);
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  }

  async function handleCreate() {
    setIsPending(true);
    try {
      const site = await createSite({
        name: details.name,
        slug: details.slug,
        status: details.status,
        domain: details.domain || undefined,
        brandColorPrimary: details.brandColorPrimary,
        brandColorSecondary: details.brandColorSecondary,
        whiteLabelEnabled: details.whiteLabelEnabled,
        poweredByFsts: details.poweredByFsts,
        websiteType: details.websiteType,
        enabledModules,
        agencyId: selectedAgencyId ? (selectedAgencyId as Id<"agencies">) : undefined,
      });

      const newSiteId = site._id as Id<"sites">;
      setCreatedSiteId(newSiteId);

      // Write website settings (identity)
      if (siteSettings.businessName || siteSettings.tagline || siteSettings.timezone || siteSettings.logoUrl) {
        await updateIdentity({
          siteId: newSiteId,
          businessName: siteSettings.businessName || undefined,
          tagline: siteSettings.tagline || undefined,
          timezone: siteSettings.timezone || undefined,
          logoUrl: siteSettings.logoUrl || undefined,
        });
      }

      // Assign user roles
      const validRows = userRows.filter((r) => r.email.trim() && r.role);
      let assignedCount = 0;
      for (const row of validRows) {
        const user = (allUsers ?? []).find((u: any) => u.email === row.email);
        if (user) {
          await addSiteRole({ userId: user._id as Id<"users">, siteId: newSiteId, role: row.role });
          assignedCount++;
        }
      }

      // Provision payment connector and set it active
      if (paymentProvider !== "none") {
        await provisionConnector({ siteId: newSiteId, provider: paymentProvider });
        await setActiveConnector({ siteId: newSiteId, provider: paymentProvider });
      }

      const assignMsg = assignedCount > 0 ? ` ${assignedCount} user${assignedCount > 1 ? "s" : ""} assigned.` : "";
      const payMsg = paymentProvider !== "none" ? ` ${paymentProvider} connector activated.` : "";
      toast({ title: "Site created", description: `${details.name} is ready.${assignMsg}${payMsg}` });
      nextStep();
    } catch (err) {
      toast({
        title: "Failed to create site",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  const canProceedDetails =
    details.name.trim().length > 0 && details.slug.trim().length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/app">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sites
          </Button>
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">New Site Onboarding</h1>
        </div>
        <p className="text-sm text-slate-500 ml-11">
          Walk through each step to fully provision a new FSTS-WOS™ client site.
        </p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Site Details ─────────────────────────────────────────────── */}
      {step === "details" && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Site Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Site Name <span className="text-red-500">*</span></Label>
              <Input
                value={details.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDetails((d) => ({ ...d, name, slug: d.slug || autoSlug(name) }));
                }}
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL Slug <span className="text-red-500">*</span></Label>
              <Input
                value={details.slug}
                onChange={(e) => setDetails((d) => ({ ...d, slug: e.target.value }))}
                placeholder="acme-corp"
              />
              <p className="text-xs text-slate-500">Unique identifier used in internal URLs.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={details.status} onValueChange={(v) => setDetails((d) => ({ ...d, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Domain</Label>
              <Input
                value={details.domain}
                onChange={(e) => setDetails((d) => ({ ...d, domain: e.target.value }))}
                placeholder="example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Website Type</Label>
            <Select value={details.websiteType} onValueChange={handleWebsiteTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEBSITE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Sets default module configuration in the next step.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Primary Brand Color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={details.brandColorPrimary} onChange={(e) => setDetails((d) => ({ ...d, brandColorPrimary: e.target.value }))} className="h-10 w-14 p-1" />
                <Input value={details.brandColorPrimary} onChange={(e) => setDetails((d) => ({ ...d, brandColorPrimary: e.target.value }))} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Secondary Brand Color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={details.brandColorSecondary} onChange={(e) => setDetails((d) => ({ ...d, brandColorSecondary: e.target.value }))} className="h-10 w-14 p-1" />
                <Input value={details.brandColorSecondary} onChange={(e) => setDetails((d) => ({ ...d, brandColorSecondary: e.target.value }))} className="font-mono text-sm" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between py-1">
              <div>
                <Label>White-Label Enabled</Label>
                <p className="text-xs text-slate-500">Hides FSTS branding for agency reseller use.</p>
              </div>
              <Switch checked={details.whiteLabelEnabled} onCheckedChange={(v) => setDetails((d) => ({ ...d, whiteLabelEnabled: v }))} />
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <Label>"Powered by FSTS" Badge</Label>
                <p className="text-xs text-slate-500">Shows the FSTS attribution footer on the dashboard.</p>
              </div>
              <Switch checked={details.poweredByFsts} onCheckedChange={(v) => setDetails((d) => ({ ...d, poweredByFsts: v }))} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={nextStep} disabled={!canProceedDetails}>
              Next: Website Settings <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Website Settings ──────────────────────────────────────────── */}
      {step === "settings" && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Website Settings</h2>
          <p className="text-sm text-slate-500">
            Configure the business identity for this site. These values populate the site's Website Settings
            and can be edited later from the dashboard.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Business Name</Label>
              <Input
                value={siteSettings.businessName}
                onChange={(e) => setSiteSettings((s) => ({ ...s, businessName: e.target.value }))}
                placeholder={details.name || "e.g. Acme Corp"}
              />
              <p className="text-xs text-slate-500">Display name shown on the site (may differ from the internal site name).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Tagline</Label>
              <Input
                value={siteSettings.tagline}
                onChange={(e) => setSiteSettings((s) => ({ ...s, tagline: e.target.value }))}
                placeholder="e.g. Quality you can trust"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={siteSettings.timezone} onValueChange={(v) => setSiteSettings((s) => ({ ...s, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                  <SelectItem value="America/Phoenix">Arizona (AZ)</SelectItem>
                  <SelectItem value="America/Anchorage">Alaska (AK)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii (HI)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Logo URL</Label>
              <Input
                value={siteSettings.logoUrl}
                onChange={(e) => setSiteSettings((s) => ({ ...s, logoUrl: e.target.value }))}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-slate-500">Optional — can be set later from Media Library.</p>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={nextStep}>
              Next: Agency <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Agency ───────────────────────────────────────────────────── */}
      {step === "agency" && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">Agency Assignment</h2>
          <p className="text-sm text-slate-500">
            Optionally assign this site to an agency. Agency admins will be able to manage the site,
            and the agency branding will appear in the sidebar.
          </p>

          {agencies === undefined ? (
            <Skeleton className="h-10 w-full" />
          ) : (agencies ?? []).length === 0 ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              No agencies configured.{" "}
              <a href="/app/admin/agencies" className="text-primary hover:underline">Create one first</a>,
              or skip this step to proceed without an agency.
            </div>
          ) : (
            <div className="space-y-2">
              <div
                onClick={() => setSelectedAgencyId("")}
                className={`flex items-center gap-3 rounded-md border p-4 cursor-pointer transition-colors ${
                  !selectedAgencyId ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${!selectedAgencyId ? "border-primary bg-primary" : "border-slate-300"}`}>
                  {!selectedAgencyId && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">No agency (FSTS direct)</div>
                  <div className="text-xs text-slate-500">Site will be managed directly by FSTS super-admins.</div>
                </div>
              </div>
              {(agencies ?? []).map((agency: any) => (
                <div
                  key={agency._id}
                  onClick={() => setSelectedAgencyId(agency._id)}
                  className={`flex items-center gap-3 rounded-md border p-4 cursor-pointer transition-colors ${
                    selectedAgencyId === agency._id ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${selectedAgencyId === agency._id ? "border-primary bg-primary" : "border-slate-300"}`}>
                    {selectedAgencyId === agency._id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <div
                    className="h-6 w-6 rounded text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: agency.primaryColor }}
                  >
                    {agency.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{agency.name}</div>
                    <div className="text-xs text-slate-500">{agency.slug} · {agency.licensingStatus}</div>
                  </div>
                  {!agency.isActive && (
                    <Badge className="ml-auto bg-red-100 text-red-700">Disabled</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={nextStep}>
              Next: Modules <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Modules ──────────────────────────────────────────────────── */}
      {step === "modules" && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900">Module Configuration</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Choose which FSTS-WOS™ modules are available to this site. Pre-set based on "{details.websiteType}".
            </p>
          </div>

          <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
            {MODULE_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm font-medium text-slate-800">{MODULE_LABELS[key]}</span>
                </div>
                <Switch
                  checked={enabledModules[key] ?? true}
                  onCheckedChange={(v) => setEnabledModules((m) => ({ ...m, [key]: v }))}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={nextStep}>
              Next: Payment <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Payment Connector ────────────────────────────────────────── */}
      {step === "payment" && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900">Payment Connector</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Select the payment provider for this site. You can configure credentials after the site is created.
            </p>
          </div>

          <div className="space-y-2">
            {PAYMENT_PROVIDERS.map((p) => (
              <div
                key={p.value}
                onClick={() => setPaymentProvider(p.value)}
                className={`flex items-center gap-3 rounded-md border p-4 cursor-pointer transition-colors ${
                  paymentProvider === p.value ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${paymentProvider === p.value ? "border-primary bg-primary" : "border-slate-300"}`}>
                  {paymentProvider === p.value && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={nextStep}>
              Next: Users <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 5: Users ────────────────────────────────────────────────────── */}
      {step === "users" && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900">User Role Assignment</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Add users who should have access to this site. You can assign or change roles at any time from Admin → Users.
            </p>
          </div>

          <div className="space-y-3">
            {userRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Email</Label>
                  {allUsers ? (
                    <Select
                      value={row.email}
                      onValueChange={(v) => setUserRows((rows) => rows.map((r, j) => j === i ? { ...r, email: v } : r))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select existing user…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(allUsers ?? []).map((u: any) => (
                          <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={row.email}
                      onChange={(e) => setUserRows((rows) => rows.map((r, j) => j === i ? { ...r, email: e.target.value } : r))}
                      placeholder="user@example.com"
                    />
                  )}
                </div>
                <div className="w-44">
                  <Label className="text-xs text-slate-500 mb-1 block">Role</Label>
                  <Select
                    value={row.role}
                    onValueChange={(v) => setUserRows((rows) => rows.map((r, j) => j === i ? { ...r, role: v } : r))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {userRows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-6 text-red-500 hover:text-red-700"
                    onClick={() => setUserRows((rows) => rows.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUserRows((rows) => [...rows, { email: "", role: "owner" }])}
            >
              + Add another user
            </Button>
          </div>

          <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
            Users must have a Clerk account first (sign up via the dashboard). Roles are activated on their next login.
            You can also assign roles later in <strong>Admin → Users</strong>.
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={nextStep}>
              Review <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 6: Review & Create ──────────────────────────────────────────── */}
      {step === "review" && !createdSiteId && (
        <div className="bg-white border border-slate-200 rounded-md p-6 space-y-6">
          <h2 className="font-semibold text-slate-900">Review & Create</h2>

          <div className="divide-y divide-slate-100 rounded-md border border-slate-200 overflow-hidden text-sm">
            <div className="grid grid-cols-3 bg-slate-50 px-4 py-2 font-medium text-slate-500 text-xs uppercase tracking-wide">
              <span>Setting</span><span className="col-span-2">Value</span>
            </div>
            {[
              ["Site Name", details.name],
              ["Slug", details.slug],
              ["Status", details.status],
              ["Domain", details.domain || "—"],
              ["Website Type", details.websiteType],
              ["Agency", selectedAgencyId ? (agencies ?? []).find((a: any) => a._id === selectedAgencyId)?.name ?? "—" : "None (FSTS direct)"],
              ["Payment", PAYMENT_PROVIDERS.find((p) => p.value === paymentProvider)?.label ?? "None"],
              ["White-Label", details.whiteLabelEnabled ? "Yes" : "No"],
              ["Powered by FSTS", details.poweredByFsts ? "Yes" : "No"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 px-4 py-3">
                <span className="text-slate-500">{k}</span>
                <span className="col-span-2 font-medium text-slate-800">{v}</span>
              </div>
            ))}
            <div className="px-4 py-3">
              <span className="text-slate-500">Modules</span>
              <div className="col-span-2 flex flex-wrap gap-1 mt-1">
                {MODULE_KEYS.filter((k) => enabledModules[k]).map((k) => (
                  <Badge key={k} className="bg-green-50 text-green-700 border border-green-200 text-xs">{MODULE_LABELS[k]}</Badge>
                ))}
                {MODULE_KEYS.filter((k) => !enabledModules[k]).map((k) => (
                  <Badge key={k} className="bg-slate-100 text-slate-400 text-xs line-through">{MODULE_LABELS[k]}</Badge>
                ))}
              </div>
            </div>
            <div className="px-4 py-3">
              <span className="text-slate-500">Users</span>
              <div className="col-span-2 mt-1 space-y-1">
                {userRows.filter((r) => r.email).map((r, i) => (
                  <div key={i} className="text-xs text-slate-700 font-mono">{r.email} — <span className="font-sans font-medium">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}</span></div>
                ))}
                {!userRows.some((r) => r.email) && <span className="text-slate-400 text-xs">No users assigned at creation.</span>}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? "Creating…" : "Create Site"}
              {!isPending && <Rocket className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Done ─────────────────────────────────────────────────────────────── */}
      {step === "review" && createdSiteId && (
        <div className="bg-white border border-green-200 rounded-md p-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Site Created!</h2>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            <strong>{details.name}</strong> has been provisioned with all default records.
            You can now enter the site workspace or return to the site list.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => setLocation("/app")}>
              Back to Sites
            </Button>
            <Button onClick={() => setLocation(`/app/sites/${createdSiteId}`)}>
              Open Site Workspace
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
