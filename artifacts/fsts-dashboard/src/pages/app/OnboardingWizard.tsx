import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLocation } from "wouter";
import {
  Building2, Globe, Palette, Layout, FileText, Server,
  Plug, Package, Rocket, CheckCircle2, ChevronLeft,
  ChevronRight, ArrowLeft, ShieldX, Share2, PenLine,
  SearchCode, Activity, ShieldCheck, ClipboardList,
  Clock, Lock, UserRound, Mail, UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { WEBSITE_TYPE_OPTIONS } from "@/lib/siteModules";
import { Link } from "wouter";

// ── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: "Business Info",    icon: Building2  },
  { id: 1, label: "Purpose",          icon: Rocket     },
  { id: 2, label: "Structure",        icon: Layout     },
  { id: 3, label: "Branding",         icon: Palette    },
  { id: 4, label: "Template",         icon: FileText   },
  { id: 5, label: "Content",          icon: FileText   },
  { id: 6, label: "Domain",           icon: Globe      },
  { id: 7, label: "Integrations",     icon: Plug       },
  { id: 8, label: "Add-ons",          icon: Package    },
  { id: 9, label: "Client Owner",     icon: UserRound  },
  { id: 10, label: "Review & Launch", icon: Rocket     },
];

const PURPOSES = [
  { value: "generate_leads",      label: "Generate leads" },
  { value: "sell_products",       label: "Sell products" },
  { value: "promote_services",    label: "Promote services" },
  { value: "publish_articles",    label: "Publish articles / blog" },
  { value: "promote_events",      label: "Promote events" },
  { value: "accept_bookings",     label: "Accept bookings" },
  { value: "member_content",      label: "Provide member content" },
  { value: "display_portfolio",   label: "Display a portfolio" },
  { value: "business_info",       label: "Provide business information" },
  { value: "collect_applications", label: "Collect applications" },
  { value: "accept_donations",    label: "Accept donations" },
];

const PAGE_OPTIONS = [
  { value: "home",           label: "Home",                always: true },
  { value: "about",          label: "About" },
  { value: "services",       label: "Services" },
  { value: "products",       label: "Products" },
  { value: "blog",           label: "Blog" },
  { value: "events",         label: "Events" },
  { value: "faq",            label: "FAQ" },
  { value: "testimonials",   label: "Testimonials" },
  { value: "team",           label: "Team" },
  { value: "contact",        label: "Contact" },
  { value: "portfolio",      label: "Portfolio" },
  { value: "resources",      label: "Resources" },
  { value: "booking",        label: "Booking" },
  { value: "membership",     label: "Membership" },
  { value: "privacy_policy", label: "Privacy Policy" },
  { value: "terms",          label: "Terms & Conditions" },
];

const TEMPLATES = [
  { value: "modern_business",   label: "Modern Business",      desc: "Clean, professional layout built for service businesses." },
  { value: "bold_contemporary", label: "Bold & Contemporary",  desc: "High-impact visuals and strong typography for standout brands." },
  { value: "clean_minimal",     label: "Clean Minimal",        desc: "Simple, focused design with generous whitespace." },
  { value: "professional_classic", label: "Professional Classic", desc: "Timeless structure trusted by established businesses." },
  { value: "blank",             label: "Start Blank",          desc: "No starter layout — build from scratch." },
];

const FONTS_HEADING = ["Inter", "Poppins", "Montserrat", "Playfair Display", "Raleway", "Merriweather"];
const FONTS_BODY    = ["Inter", "Open Sans", "Lato", "Source Sans Pro", "Roboto"];

const DESIGN_STYLES = [
  { value: "modern",   label: "Modern",   desc: "Clean lines, flat shapes, contemporary feel." },
  { value: "classic",  label: "Classic",  desc: "Traditional proportions, timeless authority." },
  { value: "bold",     label: "Bold",     desc: "Strong contrast, large type, high energy." },
  { value: "minimal",  label: "Minimal",  desc: "Stripped-back, whitespace-first, elegant." },
];

const INTEGRATIONS = [
  { value: "operon_crm",            label: "Operon CRM",              desc: "Route leads and form submissions into your CRM." },
  { value: "google_analytics",      label: "Google Analytics",        desc: "Track website traffic and user behavior." },
  { value: "google_search_console", label: "Google Search Console",   desc: "Monitor search performance and indexing." },
  { value: "google_business",       label: "Google Business Profile", desc: "Sync business information with Google." },
  { value: "facebook",              label: "Facebook",                desc: "Connect your Facebook page." },
  { value: "instagram",             label: "Instagram",               desc: "Link your Instagram account." },
  { value: "linkedin",              label: "LinkedIn",                desc: "Connect your LinkedIn company page." },
  { value: "calendly",              label: "Calendly",                desc: "Embed booking links on your website." },
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "America/Puerto_Rico", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Amsterdam",
  "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul",
  "Australia/Sydney", "Pacific/Auckland",
];

// ── Types ──────────────────────────────────────────────────────────────────

interface StepData {
  // Step 0
  businessName: string;
  websiteName: string;
  industry: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
  // Step 1
  purposes: string[];
  // Step 2
  pages: string[];
  // Step 3
  brandColorPrimary: string;
  brandColorSecondary: string;
  fontHeading: string;
  fontBody: string;
  designStyle: string;
  // Step 4
  templateId: string;
  // Step 5
  contentSetup: string;
  /** Up to 3 pricing tier names for the Products page (e.g. ["Basic","Pro","Elite"]).
   *  Seeded as placeholder product titles on launch. Falls back to Starter/Professional/Enterprise when empty. */
  priceRange: string[];
  // Step 6
  domainChoice: string;
  customDomain: string;
  // Step 7
  integrations: string[];
  // Step 8
  addOnSelections: string[];
  // Step 9 — Client Owner
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  sendOwnerInvite: boolean;
}

const DEFAULT_DATA: StepData = {
  businessName: "", websiteName: "", industry: "business_website",
  description: "", phone: "", email: "", address: "", timezone: "America/New_York",
  purposes: [], pages: ["home", "about", "services", "contact"],
  brandColorPrimary: "#1d4ed8", brandColorSecondary: "#0f172a",
  fontHeading: "Inter", fontBody: "Inter", designStyle: "modern",
  templateId: "modern_business", contentSetup: "skip",
  priceRange: [],
  domainChoice: "later", customDomain: "",
  integrations: [],
  addOnSelections: [],
  ownerName: "", ownerEmail: "", ownerRole: "owner", sendOwnerInvite: true,
};

function generateSessionKey(): string {
  return `fsts-onboard-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">
          Step {step + 1} of {STEPS.length} — {STEPS[step].label}
        </span>
        <span className="text-sm text-slate-500">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Mini step dots */}
      <div className="mt-3 flex gap-1.5 flex-wrap">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 min-w-[16px] rounded-full transition-colors ${
              s.id < step ? "bg-blue-500" : s.id === step ? "bg-blue-700" : "bg-slate-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Checkbox helper ────────────────────────────────────────────────────────

function CheckboxCard({
  value, label, desc, checked, onChange, disabled,
}: {
  value: string; label: string; desc?: string;
  checked: boolean; onChange: (v: string, c: boolean) => void; disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
        disabled ? "opacity-60 cursor-not-allowed bg-slate-50" :
        checked ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(value, e.target.checked)}
        className="mt-0.5 accent-blue-600"
      />
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {desc && <div className="text-xs text-slate-500 mt-0.5">{desc}</div>}
      </div>
    </label>
  );
}

// ── Radio card helper ──────────────────────────────────────────────────────

function RadioCard({
  value, label, desc, selected, onSelect,
}: {
  value: string; label: string; desc?: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ${
        selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
      }`}
      onClick={onSelect}
    >
      <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
        selected ? "border-blue-600" : "border-slate-300"
      }`}>
        {selected && <div className="h-2 w-2 rounded-full bg-blue-600" />}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {desc && <div className="text-xs text-slate-500 mt-0.5">{desc}</div>}
      </div>
    </label>
  );
}

// ── Step renderers ─────────────────────────────────────────────────────────

function Step0({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Business Information</h2>
        <p className="text-sm text-slate-500 mt-1">Tell us about the business this website represents.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Business Name <span className="text-red-500">*</span></Label>
          <Input aria-label="Business Name" value={data.businessName} onChange={(e) => set({ businessName: e.target.value })} placeholder="Acme Corp" />
        </div>
        <div className="space-y-1.5">
          <Label>Website Name <span className="text-red-500">*</span></Label>
          <Input aria-label="Website Name" value={data.websiteName} onChange={(e) => set({ websiteName: e.target.value })} placeholder="Acme Corp Website" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Industry <span className="text-red-500">*</span></Label>
        <Select value={data.industry} onValueChange={(v) => set({ industry: v })}>
          <SelectTrigger aria-label="Industry"><SelectValue /></SelectTrigger>
          <SelectContent>
            {WEBSITE_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Business Description</Label>
        <Textarea
          aria-label="Business Description"
          value={data.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Briefly describe what this business does and who it serves…"
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Phone Number</Label>
          <Input aria-label="Phone Number" value={data.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+1 (555) 000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label>Business Email</Label>
          <Input aria-label="Business Email" type="email" value={data.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@example.com" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Business Address</Label>
        <Input aria-label="Business Address" value={data.address} onChange={(e) => set({ address: e.target.value })} placeholder="123 Main St, City, State ZIP" />
      </div>
      <div className="space-y-1.5">
        <Label>Time Zone</Label>
        <Select value={data.timezone} onValueChange={(v) => set({ timezone: v })}>
          <SelectTrigger aria-label="Time Zone"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Step1({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  const toggle = (v: string, checked: boolean) =>
    set({ purposes: checked ? [...data.purposes, v] : data.purposes.filter((p) => p !== v) });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Website Purpose</h2>
        <p className="text-sm text-slate-500 mt-1">Select everything this website is meant to do. Choose as many as apply.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PURPOSES.map((p) => (
          <CheckboxCard
            key={p.value} value={p.value} label={p.label}
            checked={data.purposes.includes(p.value)}
            onChange={toggle}
          />
        ))}
      </div>
    </div>
  );
}

function Step2({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  const toggle = (v: string, checked: boolean) => {
    if (v === "home") return; // always on
    set({ pages: checked ? [...data.pages, v] : data.pages.filter((p) => p !== v) });
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Website Structure</h2>
        <p className="text-sm text-slate-500 mt-1">Select the pages this website needs. You can add more pages later.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PAGE_OPTIONS.map((p) => (
          <CheckboxCard
            key={p.value} value={p.value} label={p.label}
            checked={data.pages.includes(p.value)}
            onChange={toggle}
            disabled={p.always}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">Home is always included. Privacy Policy and Terms are added to the footer, not the main navigation.</p>
    </div>
  );
}

function Step3({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Branding</h2>
        <p className="text-sm text-slate-500 mt-1">Set the visual foundation for this website. You can refine these later.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color" value={data.brandColorPrimary}
              onChange={(e) => set({ brandColorPrimary: e.target.value })}
              className="h-9 w-14 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
            />
            <Input
              aria-label="brand color primary"
              value={data.brandColorPrimary}
              onChange={(e) => set({ brandColorPrimary: e.target.value })}
              className="font-mono text-sm"
              maxLength={7}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Secondary Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color" value={data.brandColorSecondary}
              onChange={(e) => set({ brandColorSecondary: e.target.value })}
              className="h-9 w-14 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
            />
            <Input
              aria-label="brand color secondary"
              value={data.brandColorSecondary}
              onChange={(e) => set({ brandColorSecondary: e.target.value })}
              className="font-mono text-sm"
              maxLength={7}
            />
          </div>
        </div>
      </div>
      {/* Color preview */}
      <div
        className="h-10 rounded-lg flex items-center justify-center text-white text-sm font-medium gap-4 px-4"
        style={{ background: `linear-gradient(to right, ${data.brandColorPrimary}, ${data.brandColorSecondary})` }}
      >
        <span>Preview</span>
        <span className="opacity-70">→</span>
        <span style={{ color: data.brandColorSecondary === "#0f172a" ? "white" : data.brandColorPrimary }}>Button</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Heading Font</Label>
          <Select value={data.fontHeading} onValueChange={(v) => set({ fontHeading: v })}>
            <SelectTrigger aria-label="Heading Font"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONTS_HEADING.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Body Font</Label>
          <Select value={data.fontBody} onValueChange={(v) => set({ fontBody: v })}>
            <SelectTrigger aria-label="Body Font"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONTS_BODY.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Design Personality</Label>
        <div className="grid grid-cols-2 gap-2">
          {DESIGN_STYLES.map((s) => (
            <RadioCard
              key={s.value} value={s.value} label={s.label} desc={s.desc}
              selected={data.designStyle === s.value}
              onSelect={() => set({ designStyle: s.value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step4({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Template</h2>
        <p className="text-sm text-slate-500 mt-1">Choose a starting layout. This determines the initial page structure and section arrangement.</p>
      </div>
      <div className="space-y-2">
        {TEMPLATES.map((t) => (
          <RadioCard
            key={t.value} value={t.value} label={t.label} desc={t.desc}
            selected={data.templateId === t.value}
            onSelect={() => set({ templateId: t.value })}
          />
        ))}
      </div>
      <p className="text-xs text-slate-400">Full template previews and a template marketplace are coming soon. Templates can be changed after launch.</p>
    </div>
  );
}

function Step5({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  const options = [
    { value: "skip", label: "Skip — complete content later",   desc: "The site launches with placeholder text. Fill in real content from the dashboard." },
    { value: "own",  label: "I'll enter my own content now",   desc: "You'll fill in key content fields during setup." },
    { value: "ai",   label: "Generate AI starter content",     desc: "Coming soon — AI-generated copy based on your business information." },
  ];

  const hasProducts = data.pages.includes("products");

  const setTier = (idx: number, value: string) => {
    const next = [...(data.priceRange ?? []), "", ""].slice(0, 3) as [string, string, string];
    next[idx] = value;
    set({ priceRange: next });
  };
  const tiers = [
    data.priceRange?.[0] ?? "",
    data.priceRange?.[1] ?? "",
    data.priceRange?.[2] ?? "",
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Content Setup</h2>
        <p className="text-sm text-slate-500 mt-1">How would you like to handle the initial website content?</p>
      </div>
      <div className="space-y-2">
        {options.map((o) => (
          <RadioCard
            key={o.value} value={o.value} label={o.label} desc={o.desc}
            selected={data.contentSetup === o.value}
            onSelect={() => o.value !== "ai" && set({ contentSetup: o.value })}
          />
        ))}
      </div>

      {hasProducts && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Product Pricing Tiers <span className="text-slate-400 font-normal">(optional)</span></p>
            <p className="text-xs text-slate-500 mt-0.5">
              Name up to three pricing tiers for this client's Products page. These become the placeholder product titles — you can rename them any time from the dashboard.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["Tier 1", "Tier 2", "Tier 3"] as const).map((placeholder, idx) => (
              <div key={idx} className="space-y-1">
                <Label className="text-xs text-slate-500">{placeholder}</Label>
                <Input
                  aria-label={placeholder}
                  value={tiers[idx]}
                  onChange={(e) => setTier(idx, e.target.value)}
                  placeholder={["Starter", "Professional", "Enterprise"][idx]}
                  maxLength={40}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Leave blank to use the default names: Starter, Professional, Enterprise.</p>
        </div>
      )}
    </div>
  );
}

function Step6({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  const options = [
    { value: "existing", label: "Connect an existing domain",      desc: "You already own a domain and want to point it to this site." },
    { value: "temp",     label: "Use a temporary FSTS subdomain",  desc: "We'll create a *.fstsclientsystem.com subdomain while you set up your domain." },
    { value: "later",    label: "Configure domain later",          desc: "Skip domain setup now. The site will be accessible from the dashboard." },
  ];
  const generatedSubdomain = `${data.websiteName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30) || "new-site"}.fstsclientsystem.com`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Domain</h2>
        <p className="text-sm text-slate-500 mt-1">How will visitors reach this website?</p>
      </div>
      <div className="space-y-2">
        {options.map((o) => (
          <RadioCard
            key={o.value} value={o.value} label={o.label} desc={o.desc}
            selected={data.domainChoice === o.value}
            onSelect={() => set({ domainChoice: o.value })}
          />
        ))}
      </div>

      {data.domainChoice === "existing" && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-1.5">
            <Label>Domain Name</Label>
            <Input
              aria-label="Domain Name"
              value={data.customDomain}
              onChange={(e) => set({ customDomain: e.target.value })}
              placeholder="yourdomain.com"
            />
          </div>
          <div className="rounded bg-white border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 mb-2">DNS Connection Instructions</div>
            <div>1. Log in to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)</div>
            <div>2. Go to your domain's DNS settings</div>
            <div>3. Add or update the following records:</div>
            <div className="font-mono mt-2 space-y-1 bg-slate-50 p-2 rounded">
              <div>A record: @ → 76.76.21.21</div>
              <div>CNAME: www → cname.fstsclientsystem.com</div>
            </div>
            <div className="mt-2 text-slate-500">DNS changes can take up to 48 hours to propagate. SSL will be provisioned automatically once DNS is verified.</div>
          </div>
        </div>
      )}

      {data.domainChoice === "temp" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm font-medium text-blue-800 mb-1">Your temporary subdomain</div>
          <div className="font-mono text-sm text-blue-700">{generatedSubdomain}</div>
          <div className="text-xs text-blue-600 mt-1">You can connect a custom domain anytime from Website Settings.</div>
        </div>
      )}
    </div>
  );
}

function Step7({ data, set }: { data: StepData; set: (u: Partial<StepData>) => void }) {
  const toggle = (v: string, checked: boolean) =>
    set({ integrations: checked ? [...data.integrations, v] : data.integrations.filter((i) => i !== v) });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="text-sm text-slate-500 mt-1">Connect external services. You can configure credentials and complete setup from the dashboard after launch.</p>
      </div>
      <div className="space-y-2">
        {INTEGRATIONS.map((i) => (
          <CheckboxCard
            key={i.value} value={i.value} label={i.label} desc={i.desc}
            checked={data.integrations.includes(i.value)}
            onChange={toggle}
          />
        ))}
      </div>
    </div>
  );
}

// ── Add-on catalog (static; also seeded into Convex via addons:seedCatalog) ──

const ADDON_CATALOG = [
  {
    slug: "social-publisher-pro",
    name: "Social Publisher Pro",
    category: "Marketing",
    Icon: Share2,
    monthlyPrice: 49,
    pricingTier: "professional",
    features: ["Multi-platform scheduling (FB, IG, LinkedIn, X)", "Visual content calendar", "AI caption suggestions"],
    isBeta: false,
  },
  {
    slug: "ai-blog-writer",
    name: "AI Blog Writer",
    category: "Content",
    Icon: PenLine,
    monthlyPrice: 39,
    pricingTier: "professional",
    features: ["AI drafts from a topic prompt", "Brand-voice calibration", "One-click publish to your blog"],
    isBeta: false,
  },
  {
    slug: "smart-seo-pro",
    name: "Smart SEO Pro",
    category: "SEO",
    Icon: SearchCode,
    monthlyPrice: 29,
    pricingTier: "starter",
    features: ["Automated weekly SEO audits", "Page-by-page score with fix list", "Schema markup generator"],
    isBeta: false,
  },
  {
    slug: "website-health-pro",
    name: "Website Health Pro",
    category: "Health",
    Icon: Activity,
    monthlyPrice: 19,
    pricingTier: "starter",
    features: ["Real-time uptime monitoring", "Broken-link scanner", "Core Web Vitals dashboard"],
    isBeta: false,
  },
  {
    slug: "accessibility-pro",
    name: "Accessibility Pro",
    category: "Accessibility",
    Icon: ShieldCheck,
    monthlyPrice: 19,
    pricingTier: "starter",
    features: ["WCAG 2.1 AA automated scan", "Prioritised fix list with code hints", "Accessibility widget"],
    isBeta: true,
  },
  {
    slug: "forms-pro",
    name: "Forms Pro",
    category: "Forms",
    Icon: ClipboardList,
    monthlyPrice: 24,
    pricingTier: "starter",
    features: ["Multi-step forms with conditional logic", "File upload & e-signature fields", "Zapier / webhook output"],
    isBeta: false,
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Marketing: "bg-purple-100 text-purple-700",
  Content: "bg-blue-100 text-blue-700",
  SEO: "bg-green-100 text-green-700",
  Health: "bg-red-100 text-red-700",
  Accessibility: "bg-amber-100 text-amber-700",
  Forms: "bg-sky-100 text-sky-700",
};

function Step8({ data, set }: { data: StepData; set: (p: Partial<StepData>) => void }) {
  const toggle = (slug: string) => {
    const current = data.addOnSelections ?? [];
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    set({ addOnSelections: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Premium Add-ons</h2>
        <p className="text-sm text-slate-500 mt-1">
          Select add-ons to activate as a <span className="font-medium text-blue-600">14-day free trial</span> when this site launches. You can change these anytime from the site dashboard.
        </p>
      </div>

      <div className="grid gap-3">
        {ADDON_CATALOG.map((addon) => {
          const selected = (data.addOnSelections ?? []).includes(addon.slug);
          return (
            <button
              key={addon.slug}
              type="button"
              onClick={() => toggle(addon.slug)}
              className={`w-full text-left rounded-lg border p-4 transition-all ${
                selected
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`mt-0.5 flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center ${
                  selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  <addon.Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900 text-sm">{addon.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[addon.category] ?? "bg-slate-100 text-slate-600"}`}>
                      {addon.category}
                    </span>
                    {addon.isBeta && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Beta</span>
                    )}
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {addon.features.map((f) => (
                      <li key={f} className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-slate-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Price + checkbox */}
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    ${addon.monthlyPrice}<span className="text-xs font-normal text-slate-400">/mo</span>
                  </span>
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selected ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  }`}>
                    {selected && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              {selected && (
                <div className="mt-2 ml-12 flex items-center gap-1.5 text-xs text-blue-600">
                  <Clock className="h-3 w-3" />
                  <span>14-day free trial will start at launch</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {(data.addOnSelections ?? []).length === 0 && (
        <p className="text-center text-xs text-slate-400 pt-1">
          <Lock className="inline h-3 w-3 mr-1" />
          No add-ons selected — you can activate them anytime from the site dashboard.
        </p>
      )}
    </div>
  );
}

// ── Step 9: Client Owner ──────────────────────────────────────────────────

function Step9Owner({
  data, set,
}: {
  data: StepData;
  set: (p: Partial<StepData>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Client Owner</h2>
        <p className="text-sm text-slate-500 mt-1">
          Who will manage this website day to day? They'll sign in with the Admin Login and see only this website.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Owner name</Label>
        <Input
          aria-label="Owner name"
          placeholder="Jane Smith"
          value={data.ownerName}
          onChange={(e) => set({ ownerName: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Owner email</Label>
        <Input
          aria-label="Owner email"
          type="email"
          placeholder="jane@business.com"
          value={data.ownerEmail}
          onChange={(e) => set({ ownerEmail: e.target.value })}
        />
        <p className="text-xs text-slate-500">
          If they already have a TAYA login, their access to this website is attached automatically — no duplicate account is created.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Owner role</Label>
        <Select value={data.ownerRole} onValueChange={(v) => set({ ownerRole: v })}>
          <SelectTrigger aria-label="Owner role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">Owner — full control of this website</SelectItem>
            <SelectItem value="manager">Manager — manage content, orders, and team</SelectItem>
            <SelectItem value="content_editor">Content Editor — edit website content</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">The owner role can manage everything for this website, including inviting staff.</p>
      </div>

      <div className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4">
        <div className="pr-4">
          <div className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-slate-400" />
            Send sign-in invitation
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Sends a secure sign-in invitation to the owner's email. Leave off if you'll set up their access later.
          </p>
        </div>
        <Switch checked={data.sendOwnerInvite} onCheckedChange={(v) => set({ sendOwnerInvite: v })} />
      </div>

      <p className="text-xs text-slate-400">
        You can also assign or change the client at any time from Manage Users.
      </p>
    </div>
  );
}

function Step9({
  data, onLaunch, isLaunching,
}: {
  data: StepData;
  onLaunch: () => void;
  isLaunching: boolean;
}) {
  const readiness = [
    { label: "Business name",    ok: !!data.businessName },
    { label: "Website name",     ok: !!data.websiteName },
    { label: "Industry",         ok: !!data.industry },
    { label: "Website purpose",  ok: data.purposes.length > 0 },
    { label: "Page structure",   ok: data.pages.length > 0 },
    { label: "Brand colors",     ok: !!data.brandColorPrimary },
    { label: "Template",         ok: !!data.templateId },
    { label: "Content plan",     ok: !!data.contentSetup },
    { label: "Domain plan",      ok: !!data.domainChoice },
    { label: "Client owner",     ok: !!data.ownerEmail.trim() },
  ];
  const score = readiness.filter((r) => r.ok).length;
  const pct = Math.round((score / readiness.length) * 100);

  const genSubdomain = `${(data.websiteName || "new-site").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30)}.fstsclientsystem.com`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Review & Launch</h2>
        <p className="text-sm text-slate-500 mt-1">Confirm your settings and create the website. You can edit everything after launch.</p>
      </div>

      {/* Readiness score */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Launch Readiness</span>
          <span className={`text-lg font-bold ${pct === 100 ? "text-green-600" : pct >= 70 ? "text-yellow-600" : "text-red-500"}`}>{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {readiness.map((r) => (
            <div key={r.label} className="flex items-center gap-1.5">
              <CheckCircle2 className={`h-3.5 w-3.5 flex-shrink-0 ${r.ok ? "text-green-500" : "text-slate-300"}`} />
              <span className={r.ok ? "text-slate-700" : "text-slate-400"}>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm bg-white overflow-hidden">
        {[
          ["Business",   data.businessName || "—"],
          ["Website",    data.websiteName || "—"],
          ["Industry",   data.industry.replace(/_/g, " ")],
          ["Pages",      data.pages.length ? `${data.pages.length} pages selected` : "—"],
          ["Colors",     `${data.brandColorPrimary} / ${data.brandColorSecondary}`],
          ["Template",   TEMPLATES.find((t) => t.value === data.templateId)?.label ?? "—"],
          ["Domain",     data.domainChoice === "existing" ? (data.customDomain || "Not entered") : data.domainChoice === "temp" ? genSubdomain : "Configure later"],
          ["Integrations", data.integrations.length ? data.integrations.map((i) => INTEGRATIONS.find((x) => x.value === i)?.label ?? i).join(", ") : "None selected"],
          ["Add-ons", (data.addOnSelections ?? []).length ? (data.addOnSelections ?? []).map((s) => ADDON_CATALOG.find((a) => a.slug === s)?.name ?? s).join(", ") : "None selected"],
          ["Client owner", data.ownerEmail ? (data.ownerName ? `${data.ownerName} (${data.ownerEmail})` : data.ownerEmail) : "Not set — assign after launch"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline px-4 py-2.5 gap-3">
            <span className="text-slate-500 w-28 flex-shrink-0">{k}</span>
            <span className="text-slate-800 font-medium">{v}</span>
          </div>
        ))}
      </div>

      <Button
        onClick={onLaunch}
        disabled={isLaunching}
        className="w-full h-11 text-base"
      >
        {isLaunching ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Creating website…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Launch Website
          </span>
        )}
      </Button>
    </div>
  );
}

// ── Success screen ─────────────────────────────────────────────────────────

function LaunchSuccess({
  siteId, siteName, ownerEmail, ownerOutcome, inviteOutcome,
}: {
  siteId: string;
  siteName: string;
  ownerEmail?: string;
  ownerOutcome?: string | null;
  inviteOutcome?: "invited" | "existing_user" | "skipped" | "failed";
}) {
  const [, setLocation] = useLocation();

  const ownerStatus =
    !ownerEmail
      ? null
      : ownerOutcome === "created" && inviteOutcome === "invited"
        ? { tone: "ok", text: `Invitation sent to ${ownerEmail}. They can sign in and manage only this website.` }
        : ownerOutcome === "created" && inviteOutcome === "failed"
          ? { tone: "warn", text: `${ownerEmail} was assigned, but the sign-in invitation failed to send. You can retry it from Manage Users.` }
          : inviteOutcome === "existing_user"
            ? { tone: "ok", text: `${ownerEmail} already had a TAYA login — access to this website is attached. No duplicate account was created.` }
            : inviteOutcome === "failed"
              ? { tone: "warn", text: `${ownerEmail} was attached to this website, but the invitation update failed. You can retry from Manage Users.` }
              : { tone: "ok", text: `${ownerEmail} is assigned as the client owner.` };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Website Created!</h1>
        <p className="text-slate-500">
          <strong>{siteName}</strong> has been provisioned with all starter content, navigation, and settings. Open the workspace to begin adding content.
        </p>
        {ownerStatus && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm ${
              ownerStatus.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {ownerStatus.tone === "ok" ? (
              <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{ownerStatus.text}</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => setLocation("/app")}>Back to Sites</Button>
          <Button onClick={() => setLocation(`/app/sites/${siteId}`)}>
            Open Site Workspace <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main wizard component ──────────────────────────────────────────────────

export default function OnboardingWizard() {
  const me = useQuery(api.users.me);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<StepData>(DEFAULT_DATA);
  const [sessionKey] = useState(() => {
    const stored = localStorage.getItem("fsts_onboarding_session");
    if (stored) return stored;
    const key = generateSessionKey();
    localStorage.setItem("fsts_onboarding_session", key);
    return key;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{
    siteId: string;
    siteName: string;
    ownerEmail?: string;
    ownerOutcome?: string | null;
    inviteOutcome?: "invited" | "existing_user" | "skipped" | "failed";
  } | null>(null);
  const { toast } = useToast();

  const createSession = useMutation(api.onboarding.createSession);
  const saveStep = useMutation(api.onboarding.saveStep);
  const launchMutation = useMutation(api.onboarding.launch);
  const sendClerkInvite = useAction(api.clerkInvitations.invite);
  const markInvite = useMutation(api.invitationState.mark);

  const savedSession = useQuery(api.onboarding.getSession, { sessionKey });

  // Initialise session in Convex and restore saved progress
  useEffect(() => {
    if (!me?.isSuperAdmin) return;
    createSession({ sessionKey }).catch(() => {});
  }, [me?.isSuperAdmin, sessionKey, createSession]);

  useEffect(() => {
    if (savedSession && savedSession.status === "in_progress") {
      const saved = savedSession.stepData as Partial<StepData>;
      if (Object.keys(saved).length > 0) {
        setStepData((prev) => ({ ...prev, ...saved }));
        setCurrentStep(savedSession.currentStep);
      }
    }
  }, [savedSession]);

  // Loading
  if (me === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="space-y-3 w-full max-w-2xl px-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Access denied
  if (!me?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldX className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
          <p className="text-slate-500 text-sm">Only FSTS administrators can create new websites. Contact your administrator if you need a new site.</p>
          <Button variant="outline" asChild><Link href="/app">Back to Dashboard</Link></Button>
        </div>
      </div>
    );
  }

  // Success
  if (launchResult) {
    return (
      <LaunchSuccess
        siteId={launchResult.siteId}
        siteName={launchResult.siteName}
        ownerEmail={launchResult.ownerEmail}
        ownerOutcome={launchResult.ownerOutcome}
        inviteOutcome={launchResult.inviteOutcome}
      />
    );
  }

  const update = (partial: Partial<StepData>) =>
    setStepData((prev) => ({ ...prev, ...partial }));

  // Validation per step
  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 0: return !!stepData.businessName.trim() && !!stepData.websiteName.trim() && !!stepData.industry;
      case 1: return stepData.purposes.length > 0;
      case 2: return stepData.pages.length > 0;
      case 9: {
        // Owner email only required when an invitation will be sent.
        if (!stepData.sendOwnerInvite) return true;
        return !!stepData.ownerEmail.trim() && /.+@.+\..+/.test(stepData.ownerEmail.trim());
      }
      default: return true;
    }
  };

  const handleNext = async () => {
    if (!isStepValid()) {
      toast({ title: "Please complete required fields before continuing.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await saveStep({ sessionKey, step: currentStep, data: stepData });
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      toast({ title: "Could not save progress. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      const owner =
        stepData.ownerEmail.trim() && stepData.sendOwnerInvite
          ? {
              email: stepData.ownerEmail.trim(),
              name: stepData.ownerName.trim() || undefined,
              role: stepData.ownerRole,
            }
          : stepData.ownerEmail.trim()
            ? {
                email: stepData.ownerEmail.trim(),
                name: stepData.ownerName.trim() || undefined,
                role: stepData.ownerRole,
              }
            : undefined;

      const result = await launchMutation({ sessionKey, stepData, owner });

      // Issue the Clerk invitation after a successful launch so a failed
      // invitation can never orphan a half-launched site.
      let inviteOutcome: "invited" | "existing_user" | "skipped" | "failed" = "skipped";
      if (owner && stepData.sendOwnerInvite) {
        try {
          const invite = await sendClerkInvite({ email: owner.email });
          if (invite.status === "invited") {
            await markInvite({ email: owner.email, status: "invited", clerkInvitationId: invite.invitationId });
            inviteOutcome = "invited";
          } else {
            await markInvite({ email: owner.email, status: "existing_user" });
            inviteOutcome = "existing_user";
          }
        } catch {
          inviteOutcome = "failed";
        }
      }

      localStorage.removeItem("fsts_onboarding_session");
      setLaunchResult({
        siteId: result.siteId,
        siteName: stepData.websiteName || stepData.businessName,
        ownerEmail: owner?.email,
        ownerOutcome: result.owner?.outcome ?? null,
        inviteOutcome,
      });
    } catch (err) {
      toast({
        title: "Launch failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app"><ArrowLeft className="h-4 w-4 mr-1" />Sites</Link>
          </Button>
          <div className="h-4 w-px bg-slate-300" />
          <h1 className="text-base font-semibold text-slate-900">New Website</h1>
          {isSaving && <span className="text-xs text-slate-400 ml-auto">Saving…</span>}
        </div>

        <ProgressBar step={currentStep} />

        {/* Step card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {currentStep === 0 && <Step0 data={stepData} set={update} />}
          {currentStep === 1 && <Step1 data={stepData} set={update} />}
          {currentStep === 2 && <Step2 data={stepData} set={update} />}
          {currentStep === 3 && <Step3 data={stepData} set={update} />}
          {currentStep === 4 && <Step4 data={stepData} set={update} />}
          {currentStep === 5 && <Step5 data={stepData} set={update} />}
          {currentStep === 6 && <Step6 data={stepData} set={update} />}
          {currentStep === 7 && <Step7 data={stepData} set={update} />}
          {currentStep === 8 && <Step8 data={stepData} set={update} />}
          {currentStep === 9 && <Step9Owner data={stepData} set={update} />}

          {currentStep === 10 && (
            <Step9 data={stepData} onLaunch={handleLaunch} isLaunching={isLaunching} />
          )}

          {/* Navigation — hidden on review step (has its own launch button) */}
          {currentStep < 10 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={isSaving || !isStepValid()}
              >
                {isSaving ? "Saving…" : "Next"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Back nav on review step */}
          {currentStep === 10 && (
            <div className="mt-4 flex justify-start">
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Progress is saved automatically. You can close this tab and resume later.
        </p>
      </div>
    </div>
  );
}
