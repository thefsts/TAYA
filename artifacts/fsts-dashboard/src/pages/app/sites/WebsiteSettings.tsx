import { useEffect, useState } from "react";
import { AppLayout } from "@/pages/app/SiteDashboard";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Palette,
  Phone,
  Search,
  Plug,
  ScrollText,
  CheckCircle2,
  CalendarX2,
} from "lucide-react";
import { ImagePickerField } from "@/components/ImagePickerField";
import { SITE_PRESETS } from "@/config/imagePresets";
import { WEBSITE_TYPE_OPTIONS } from "@/lib/siteModules";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type BusinessHourRow = {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type SocialLinks = {
  facebook: string;
  instagram: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  tiktok: string;
};

const DEFAULT_HOURS: BusinessHourRow[] = DAYS_OF_WEEK.map((day) => ({
  day,
  isOpen: day !== "Saturday" && day !== "Sunday",
  openTime: "09:00",
  closeTime: "17:00",
}));

const DEFAULT_SOCIAL: SocialLinks = {
  facebook: "",
  instagram: "",
  twitter: "",
  linkedin: "",
  youtube: "",
  tiktok: "",
};

const FONT_OPTIONS = [
  { value: "system", label: "System Default" },
  { value: "inter", label: "Inter" },
  { value: "poppins", label: "Poppins" },
  { value: "roboto", label: "Roboto" },
  { value: "open-sans", label: "Open Sans" },
  { value: "lato", label: "Lato" },
  { value: "montserrat", label: "Montserrat" },
  { value: "playfair-display", label: "Playfair Display" },
  { value: "merriweather", label: "Merriweather" },
  { value: "nunito", label: "Nunito" },
  { value: "raleway", label: "Raleway" },
  { value: "source-serif-4", label: "Source Serif 4" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "America/Detroit",
  "America/Indiana/Indianapolis",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Zurich",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

function SavedBadge({ ts }: { ts?: number | null }) {
  if (!ts) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Saved {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function SectionHeader({ title, description, ts, children }: { title: string; description: string; ts?: number | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <SavedBadge ts={ts} />
        {children}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase w-32"
          maxLength={7}
          placeholder="#000000"
        />
        <span
          className="h-10 w-10 rounded border border-slate-200 flex-shrink-0"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  );
}


export default function WebsiteSettings({ params }: { params: { siteId: string } }) {
  const siteId = params.siteId as Id<"sites">;
  const { toast } = useToast();

  const data = useQuery(api.siteSettings.get, { siteId });
  const saveIdentity = useMutation(api.siteSettings.updateIdentity);
  const saveBranding = useMutation(api.siteSettings.updateBranding);
  const saveContact = useMutation(api.siteSettings.updateContact);
  const saveSeo = useMutation(api.siteSettings.updateSeo);
  const saveIntegrations = useMutation(api.siteSettings.updateIntegrations);
  const saveLegal = useMutation(api.siteSettings.updateLegal);
  const saveEventDisplay = useMutation(api.siteSettings.updateEventDisplay);

  const [pending, setPending] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [websiteType, setWebsiteType] = useState("business_website");
  const [timezone, setTimezone] = useState("America/New_York");

  const [colorPrimary, setColorPrimary] = useState("#1d4ed8");
  const [colorSecondary, setColorSecondary] = useState("#0f172a");
  const [colorAccent, setColorAccent] = useState("#7c3aed");
  const [fontHeading, setFontHeading] = useState("system");
  const [fontBody, setFontBody] = useState("system");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHourRow[]>(DEFAULT_HOURS);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(DEFAULT_SOCIAL);

  const [seoGlobalTitle, setSeoGlobalTitle] = useState("");
  const [seoGlobalDescription, setSeoGlobalDescription] = useState("");
  const [seoOgImageUrl, setSeoOgImageUrl] = useState("");

  const [analyticsGa4, setAnalyticsGa4] = useState("");
  const [analyticsGtm, setAnalyticsGtm] = useState("");
  const [analyticsPixel, setAnalyticsPixel] = useState("");
  const [cookieConsentEnabled, setCookieConsentEnabled] = useState(false);
  const [cookiePolicyUrl, setCookiePolicyUrl] = useState("");

  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [termsOfServiceUrl, setTermsOfServiceUrl] = useState("");
  const [legalCookiePolicyUrl, setLegalCookiePolicyUrl] = useState("");

  const [showCancelledEvents, setShowCancelledEvents] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBusinessName((data as any).businessName ?? "");
    setTagline((data as any).tagline ?? "");
    setLogoUrl((data as any).logoUrl ?? "");
    setFaviconUrl((data as any).faviconUrl ?? "");
    setWebsiteType((data as any).websiteType ?? "business_website");
    setTimezone((data as any).timezone ?? "America/New_York");

    setColorPrimary((data as any).brandColorPrimary ?? "#1d4ed8");
    setColorSecondary((data as any).brandColorSecondary ?? "#0f172a");
    setColorAccent((data as any).brandColorAccent ?? "#7c3aed");
    setFontHeading((data as any).fontHeading ?? "system");
    setFontBody((data as any).fontBody ?? "system");

    setPhone((data as any).phone ?? "");
    setEmail((data as any).email ?? "");
    setAddress((data as any).address ?? "");
    const bh = (data as any).businessHours;
    setBusinessHours(Array.isArray(bh) && bh.length > 0 ? bh : DEFAULT_HOURS);
    const sl = (data as any).socialLinks;
    setSocialLinks(sl && typeof sl === "object" ? { ...DEFAULT_SOCIAL, ...sl } : DEFAULT_SOCIAL);

    setSeoGlobalTitle((data as any).seoGlobalTitle ?? "");
    setSeoGlobalDescription((data as any).seoGlobalDescription ?? "");
    setSeoOgImageUrl((data as any).seoOgImageUrl ?? "");

    setAnalyticsGa4((data as any).analyticsGa4 ?? "");
    setAnalyticsGtm((data as any).analyticsGtm ?? "");
    setAnalyticsPixel((data as any).analyticsPixel ?? "");
    setCookieConsentEnabled((data as any).cookieConsentEnabled ?? false);
    setCookiePolicyUrl((data as any).cookiePolicyUrl ?? "");

    setPrivacyPolicyUrl((data as any).privacyPolicyUrl ?? "");
    setTermsOfServiceUrl((data as any).termsOfServiceUrl ?? "");
    setLegalCookiePolicyUrl((data as any).cookiePolicyUrl ?? "");

    setShowCancelledEvents((data as any).showCancelledEvents ?? false);
  }, [data]);

  function updateHour(index: number, field: keyof BusinessHourRow, value: string | boolean) {
    setBusinessHours((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function updateSocial(key: keyof SocialLinks, value: string) {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(section: string, fn: () => Promise<unknown>) {
    setPending(section);
    try {
      await fn();
      toast({ title: "Saved successfully" });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setPending(null);
    }
  }

  if (data === undefined) {
    return (
      <AppLayout siteId={params.siteId}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (data === null) {
    return (
      <AppLayout siteId={params.siteId}>
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Unable to load Website Settings — you may not have access to this site or the module is disabled.
        </div>
      </AppLayout>
    );
  }

  const d = data as any;

  return (
    <AppLayout siteId={params.siteId}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Website Settings™</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your site identity, branding, contact details, SEO defaults, integrations, and legal pages.
        </p>
      </div>

      <Tabs defaultValue="identity" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-lg flex-wrap h-auto gap-1">
          <TabsTrigger value="identity" className="flex items-center gap-1.5 text-xs font-medium">
            <Building2 className="h-3.5 w-3.5" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5 text-xs font-medium">
            <Palette className="h-3.5 w-3.5" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-1.5 text-xs font-medium">
            <Phone className="h-3.5 w-3.5" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-1.5 text-xs font-medium">
            <Search className="h-3.5 w-3.5" />
            SEO
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5 text-xs font-medium">
            <Plug className="h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="legal" className="flex items-center gap-1.5 text-xs font-medium">
            <ScrollText className="h-3.5 w-3.5" />
            Legal
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1.5 text-xs font-medium">
            <CalendarX2 className="h-3.5 w-3.5" />
            Events
          </TabsTrigger>
        </TabsList>

        {/* ── Identity ── */}
        <TabsContent value="identity">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="Identity"
              description="Your business name, logo, and core site configuration."
              ts={d.identityUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "identity"}
                onClick={() =>
                  handleSave("identity", () =>
                    saveIdentity({
                      siteId,
                      businessName: businessName || undefined,
                      tagline: tagline || undefined,
                      logoUrl: logoUrl || undefined,
                      faviconUrl: faviconUrl || undefined,
                      websiteType: websiteType || undefined,
                      timezone: timezone || undefined,
                    })
                  )
                }
              >
                {pending === "identity" ? "Saving…" : "Save Identity"}
              </Button>
            </SectionHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Business Name</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tagline</Label>
                  <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Building great things" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Website Type</Label>
                  <Select value={websiteType} onValueChange={setWebsiteType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEBSITE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ImagePickerField
                siteId={params.siteId}
                label="Logo"
                value={logoUrl}
                onChange={setLogoUrl}
                initialPreset={SITE_PRESETS.find((p) => p.label === "Logo")}
                hint="Recommended: SVG or PNG with transparent background, 300×100."
              />

              <ImagePickerField
                siteId={params.siteId}
                label="Favicon"
                value={faviconUrl}
                onChange={setFaviconUrl}
                initialPreset={SITE_PRESETS.find((p) => p.label === "Favicon")}
                hint="Recommended: 64×64 PNG — square crop enforced."
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Branding ── */}
        <TabsContent value="branding">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="Branding"
              description="Brand colors and typography used across your website."
              ts={d.brandingUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "branding"}
                onClick={() =>
                  handleSave("branding", () =>
                    saveBranding({
                      siteId,
                      brandColorPrimary: colorPrimary || undefined,
                      brandColorSecondary: colorSecondary || undefined,
                      brandColorAccent: colorAccent || undefined,
                      fontHeading: fontHeading || undefined,
                      fontBody: fontBody || undefined,
                    })
                  )
                }
              >
                {pending === "branding" ? "Saving…" : "Save Branding"}
              </Button>
            </SectionHeader>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Brand Colors</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ColorField label="Primary" value={colorPrimary} onChange={setColorPrimary} />
                  <ColorField label="Secondary" value={colorSecondary} onChange={setColorSecondary} />
                  <ColorField label="Accent" value={colorAccent} onChange={setColorAccent} />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Typography</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Heading Font</Label>
                    <Select value={fontHeading} onValueChange={setFontHeading}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body Font</Label>
                    <Select value={fontBody} onValueChange={setFontBody}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(fontHeading !== "system" || fontBody !== "system") && (
                  <div
                    className="mt-4 p-4 rounded-md border border-slate-100 bg-slate-50"
                    style={{
                      fontFamily: fontBody === "system" ? undefined : fontBody,
                    }}
                  >
                    <p
                      className="text-lg font-bold text-slate-900 mb-1"
                      style={{ fontFamily: fontHeading === "system" ? undefined : fontHeading }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </p>
                    <p className="text-sm text-slate-600">
                      Body text preview — your site's paragraph and UI copy will use this font at various sizes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Contact ── */}
        <TabsContent value="contact">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="Contact"
              description="Contact details, business hours, and social media links."
              ts={d.contactUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "contact"}
                onClick={() =>
                  handleSave("contact", () =>
                    saveContact({
                      siteId,
                      phone: phone || undefined,
                      email: email || undefined,
                      address: address || undefined,
                      businessHours,
                      socialLinks,
                    })
                  )
                }
              >
                {pending === "contact" ? "Saving…" : "Save Contact"}
              </Button>
            </SectionHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State 00000" />
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Business Hours</h3>
                <div className="space-y-2">
                  {businessHours.map((row, i) => (
                    <div key={row.day} className="flex items-center gap-3">
                      <div className="w-28 flex-shrink-0">
                        <span className="text-sm font-medium text-slate-700">{row.day}</span>
                      </div>
                      <Switch
                        checked={row.isOpen}
                        onCheckedChange={(v) => updateHour(i, "isOpen", v)}
                      />
                      <span className="text-xs text-slate-500 w-12">
                        {row.isOpen ? "Open" : "Closed"}
                      </span>
                      {row.isOpen ? (
                        <>
                          <Input
                            type="time"
                            value={row.openTime}
                            onChange={(e) => updateHour(i, "openTime", e.target.value)}
                            className="w-32 text-sm"
                          />
                          <span className="text-slate-400 text-xs">to</span>
                          <Input
                            type="time"
                            value={row.closeTime}
                            onChange={(e) => updateHour(i, "closeTime", e.target.value)}
                            className="w-32 text-sm"
                          />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Closed all day</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Social Links</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(DEFAULT_SOCIAL) as (keyof SocialLinks)[]).map((platform) => (
                    <div key={platform} className="space-y-1.5">
                      <Label className="capitalize">{platform === "tiktok" ? "TikTok" : platform.charAt(0).toUpperCase() + platform.slice(1)}</Label>
                      <Input
                        value={socialLinks[platform]}
                        onChange={(e) => updateSocial(platform, e.target.value)}
                        placeholder={`https://${platform}.com/yourpage`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── SEO ── */}
        <TabsContent value="seo">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="SEO Defaults"
              description="Global SEO settings applied site-wide unless overridden per page."
              ts={d.seoUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "seo"}
                onClick={() =>
                  handleSave("seo", () =>
                    saveSeo({
                      siteId,
                      seoGlobalTitle: seoGlobalTitle || undefined,
                      seoGlobalDescription: seoGlobalDescription || undefined,
                      seoOgImageUrl: seoOgImageUrl || undefined,
                    })
                  )
                }
              >
                {pending === "seo" ? "Saving…" : "Save SEO"}
              </Button>
            </SectionHeader>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label>Global Title Template</Label>
                <Input
                  value={seoGlobalTitle}
                  onChange={(e) => setSeoGlobalTitle(e.target.value)}
                  placeholder="My Business | %page%"
                />
                <p className="text-xs text-slate-400">Use <code className="bg-slate-100 rounded px-1">%page%</code> as a placeholder for the page-specific title.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Global Meta Description</Label>
                <Textarea
                  rows={3}
                  value={seoGlobalDescription}
                  onChange={(e) => setSeoGlobalDescription(e.target.value)}
                  placeholder="A short description of your business (150–160 characters)"
                />
                <p className="text-xs text-slate-400">{seoGlobalDescription.length}/160 characters</p>
              </div>
              <ImagePickerField
                siteId={params.siteId}
                label="Default OG / Social Share Image"
                value={seoOgImageUrl}
                onChange={setSeoOgImageUrl}
                initialPreset={SITE_PRESETS.find((p) => p.label === "Article Thumbnail")}
                hint="Recommended: 1200×630 px for best social sharing results."
              />
            </div>
          </div>
        </TabsContent>

        {/* ── Integrations ── */}
        <TabsContent value="integrations">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="Integrations"
              description="Analytics tracking IDs and cookie consent configuration."
              ts={d.integrationsUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "integrations"}
                onClick={() =>
                  handleSave("integrations", () =>
                    saveIntegrations({
                      siteId,
                      analyticsGa4: analyticsGa4 || undefined,
                      analyticsGtm: analyticsGtm || undefined,
                      analyticsPixel: analyticsPixel || undefined,
                      cookieConsentEnabled,
                      cookiePolicyUrl: cookiePolicyUrl || undefined,
                    })
                  )
                }
              >
                {pending === "integrations" ? "Saving…" : "Save Integrations"}
              </Button>
            </SectionHeader>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Analytics</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Google Analytics 4 (GA4) Measurement ID</Label>
                    <Input
                      value={analyticsGa4}
                      onChange={(e) => setAnalyticsGa4(e.target.value)}
                      placeholder="G-XXXXXXXXXX"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Google Tag Manager (GTM) Container ID</Label>
                    <Input
                      value={analyticsGtm}
                      onChange={(e) => setAnalyticsGtm(e.target.value)}
                      placeholder="GTM-XXXXXXX"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Meta (Facebook) Pixel ID</Label>
                    <Input
                      value={analyticsPixel}
                      onChange={(e) => setAnalyticsPixel(e.target.value)}
                      placeholder="123456789012345"
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Cookie Consent</h3>
                <div className="flex items-center gap-3 mb-3">
                  <Switch checked={cookieConsentEnabled} onCheckedChange={setCookieConsentEnabled} />
                  <Label>Show cookie consent banner</Label>
                </div>
                {cookieConsentEnabled && (
                  <div className="space-y-1.5">
                    <Label>Cookie Policy URL</Label>
                    <Input
                      value={cookiePolicyUrl}
                      onChange={(e) => setCookiePolicyUrl(e.target.value)}
                      placeholder="https://example.com/cookie-policy"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Legal ── */}
        <TabsContent value="legal">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="Legal Pages"
              description="Links to your legal documents shown in the site footer and cookie banner."
              ts={d.legalUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "legal"}
                onClick={() =>
                  handleSave("legal", () =>
                    saveLegal({
                      siteId,
                      privacyPolicyUrl: privacyPolicyUrl || undefined,
                      termsOfServiceUrl: termsOfServiceUrl || undefined,
                      cookiePolicyUrl: legalCookiePolicyUrl || undefined,
                    })
                  )
                }
              >
                {pending === "legal" ? "Saving…" : "Save Legal"}
              </Button>
            </SectionHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Privacy Policy URL</Label>
                <Input
                  value={privacyPolicyUrl}
                  onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                  placeholder="https://example.com/privacy-policy"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Terms of Service URL</Label>
                <Input
                  value={termsOfServiceUrl}
                  onChange={(e) => setTermsOfServiceUrl(e.target.value)}
                  placeholder="https://example.com/terms"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cookie Policy URL</Label>
                <Input
                  value={legalCookiePolicyUrl}
                  onChange={(e) => setLegalCookiePolicyUrl(e.target.value)}
                  placeholder="https://example.com/cookie-policy"
                />
              </div>
              <div className="mt-4 p-4 rounded-md bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong className="text-slate-700">Note:</strong> These URLs are used by your FSTS-powered website to link to your legal documents from the footer and cookie consent banner. Make sure each page is publicly accessible.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
        {/* ── Events ── */}
        <TabsContent value="events">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 max-w-2xl">
            <SectionHeader
              title="Events Display"
              description="Control how events appear on your public website."
              ts={d.eventsUpdatedAt}
            >
              <Button
                size="sm"
                disabled={pending === "events"}
                onClick={() =>
                  handleSave("events", () =>
                    saveEventDisplay({
                      siteId,
                      showCancelledEvents,
                    })
                  )
                }
              >
                {pending === "events" ? "Saving…" : "Save Events"}
              </Button>
            </SectionHeader>

            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                <Switch
                  id="showCancelledEvents"
                  checked={showCancelledEvents}
                  onCheckedChange={setShowCancelledEvents}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="showCancelledEvents" className="text-sm font-medium text-slate-800 cursor-pointer">
                    Show cancelled events on the website
                  </Label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, events with a <strong>Cancelled</strong> status will appear in a dedicated
                    cancelled section on your public website. Disabled by default.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
