import { Link } from "wouter";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Globe2,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  MonitorCog,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import fstsLogo from "@assets/fsts_header_logo_1783377175328.PNG";

const capabilities = [
  { icon: MonitorCog, title: "Website Operations", copy: "Update approved content, services, products, FAQs, testimonials, navigation and site information without touching source code." },
  { icon: CalendarCheck, title: "Events & Classes", copy: "Manage dates, capacity and registrations while automatically moving expired offerings out of active views." },
  { icon: FileText, title: "Forms & Leads", copy: "Create controlled forms, review submissions and keep customer inquiries organized in one operational workspace." },
  { icon: ImageIcon, title: "Media & Flyers", copy: "Upload approved photos, documents and flyers through a governed media library built for day-to-day client use." },
  { icon: SearchCheck, title: "SEO Controls", copy: "Maintain page titles, descriptions and search-facing content without exposing the underlying application or layout system." },
  { icon: UsersRound, title: "Client Portals", copy: "Give customers a secure branded portal experience with role-aware access and operational controls." },
];

const workflow = [
  "Your website design and code remain protected.",
  "Clients update only the content and tools they are authorized to manage.",
  "Time-sensitive classes and events can close and archive automatically.",
  "FSTS administrators retain oversight, recovery and platform controls.",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="TAYA home">
            <img src={fstsLogo} alt="Full Stack Tech & Solutions" className="h-11 w-auto" />
            <div className="hidden border-l border-slate-200 pl-3 sm:block">
              <div className="text-sm font-extrabold tracking-[0.18em] text-slate-950">TAYA™</div>
              <div className="text-[11px] font-medium text-slate-500">Website Operating System</div>
            </div>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex" aria-label="Primary navigation">
            <a href="#platform" className="hover:text-slate-950">Platform</a>
            <a href="#capabilities" className="hover:text-slate-950">Capabilities</a>
            <a href="#security" className="hover:text-slate-950">Security</a>
            <a href="#industries" className="hover:text-slate-950">Use Cases</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/sign-in"><Button variant="ghost" className="font-semibold">Sign In</Button></Link>
            <a href="#demo"><Button className="font-semibold shadow-sm">Request Demo</Button></a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
          <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(132,204,22,.22),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,.10),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:py-24 lg:grid-cols-[1.12fr_.88fr] lg:px-8 lg:py-28">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 text-sm font-semibold text-lime-200">
                <Sparkles className="h-4 w-4" /> Technology • Automation • Yield • Administration
              </div>
              <h1 className="text-4xl font-black tracking-[-0.045em] sm:text-6xl lg:text-7xl">Run your website like a business system.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">TAYA gives organizations a secure command center for website content, events, forms, media, SEO and client operations—without giving everyday users access to the code or locked design system.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#demo"><Button size="lg" className="h-12 px-7 text-base font-bold">Request a Demo <ArrowRight className="ml-2 h-4 w-4" /></Button></a>
                <a href="#platform"><Button size="lg" variant="outline" className="h-12 border-white/20 bg-white/5 px-7 text-base font-bold text-white hover:bg-white/10 hover:text-white">Explore TAYA</Button></a>
              </div>
              <div className="mt-10 grid max-w-2xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
                {["Protected layouts", "Role-based access", "Operational automation"].map((item) => <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-lime-300" />{item}</div>)}
              </div>
            </div>

            <div className="self-center rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div><div className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">TAYA Command Center</div><div className="mt-1 text-sm text-slate-400">Website operations overview</div></div>
                  <ShieldCheck className="h-7 w-7 text-lime-300" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[['Active Sites','12'],['Open Forms','24'],['Upcoming Events','18'],['Media Assets','486']].map(([label,value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="text-2xl font-black">{value}</div><div className="mt-1 text-xs text-slate-400">{label}</div></div>)}
                </div>
                <div className="mt-3 rounded-xl border border-lime-300/20 bg-lime-300/[0.06] p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-lime-200"><Workflow className="h-4 w-4" /> Automated lifecycle controls</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Full classes close automatically. Past events move out of active listings. Your team stays in control without repetitive cleanup.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {["Content management", "Operational workflows", "Client portal controls", "FSTS administrative oversight"].map((item) => <div key={item} className="bg-slate-50 px-6 py-5 text-center text-sm font-bold text-slate-700">{item}</div>)}
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.22em] text-primary">One operational layer</div>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Your site stays professionally built. Your team gets safe controls.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">TAYA separates site ownership and engineering from day-to-day content operations. That means clients can keep their website current without accidentally changing layouts, breaking code or bypassing the design system.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{icon:LockKeyhole,title:"Design Lock",copy:"Code, layout and protected styling remain under controlled administrative ownership."},{icon:Layers3,title:"Structured CMS",copy:"Manage approved website sections through purpose-built tools instead of a generic page builder."},{icon:Workflow,title:"Automation",copy:"Reduce repetitive site maintenance with rules for dated content, capacity and operational state."},{icon:Globe2,title:"Multi-Site Ready",copy:"Operate multiple client properties from a consistent platform with tenant-aware controls."}].map(({icon:Icon,title,copy}) => <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><Icon className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></div>)}
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-y border-slate-200 bg-slate-50 py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-3xl"><div className="text-sm font-black uppercase tracking-[0.22em] text-primary">Core capabilities</div><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Everything clients need to keep the site moving.</h2><p className="mt-5 text-lg leading-8 text-slate-600">TAYA turns common website maintenance into clear, governed workflows instead of developer tickets and risky direct edits.</p></div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{capabilities.map(({icon:Icon,title,copy}) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p></article>)}</div>
          </div>
        </section>

        <section id="security" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="rounded-3xl bg-slate-950 p-8 text-white sm:p-10">
              <ShieldCheck className="h-10 w-10 text-lime-300" />
              <h2 className="mt-6 text-3xl font-black tracking-tight">Built around controlled access—not unrestricted editing.</h2>
              <p className="mt-4 leading-7 text-slate-300">TAYA is designed so authorized users can operate the website while sensitive administrative, code and design controls stay protected.</p>
              <div className="mt-7 space-y-4">{workflow.map((item) => <div key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-300" /><span className="text-sm leading-6 text-slate-200">{item}</span></div>)}</div>
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-[0.22em] text-primary">Operational intelligence</div>
              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Less manual website cleanup.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">Classes and events should not stay open forever. TAYA can use dates and capacity to help determine when an offering is full or expired, close active registration, and transition old listings into past-event states automatically.</p>
              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-6"><div className="flex items-center gap-3"><CalendarCheck className="h-6 w-6 text-primary" /><div className="font-black">Lifecycle-aware content</div></div><p className="mt-3 text-sm leading-6 text-slate-600">Designed for classes, training providers, events, service businesses, memberships and other organizations where website information changes on a schedule.</p></div>
            </div>
          </div>
        </section>

        <section id="industries" className="border-y border-slate-200 bg-slate-50 py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="text-center"><div className="text-sm font-black uppercase tracking-[0.22em] text-primary">Flexible by industry</div><h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">A governed website operations system for growing organizations.</h2></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Training & education","Professional services","Membership organizations","Multi-location businesses"].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-6 text-center font-black">{item}</div>)}</div></div>
        </section>

        <section id="demo" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
          <div className="overflow-hidden rounded-3xl bg-primary px-6 py-12 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14">
            <div className="max-w-2xl"><div className="text-sm font-black uppercase tracking-[0.2em] text-white/70">See TAYA in action</div><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Give clients control without giving away the keys to the code.</h2><p className="mt-4 leading-7 text-white/80">Talk with Full Stack Tech & Solutions about deploying TAYA for your website operations and client workflows.</p></div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:ml-10"><Link href="/sign-in"><Button size="lg" variant="secondary" className="font-bold">Client Sign In</Button></Link><a href="mailto:amorebey@gmail.com"><Button size="lg" variant="outline" className="border-white/30 bg-transparent font-bold text-white hover:bg-white/10 hover:text-white">Request Demo <MessageSquareText className="ml-2 h-4 w-4" /></Button></a></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1.2fr_.8fr] lg:px-8">
          <div><img src={fstsLogo} alt="Full Stack Tech & Solutions" className="h-12 w-auto rounded bg-white p-1" /><div className="mt-4 text-lg font-black text-white">TAYA™ Website Operating System</div><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">A Full Stack Tech & Solutions LLC platform for secure website operations, controlled client management and business-ready digital workflows.</p></div>
          <div className="grid grid-cols-2 gap-6 text-sm"><div><div className="font-black text-white">Platform</div><div className="mt-3 space-y-2 text-slate-400"><a href="#capabilities" className="block hover:text-white">Capabilities</a><a href="#security" className="block hover:text-white">Security</a><Link href="/sign-in"><span className="block hover:text-white">Sign In</span></Link></div></div><div><div className="font-black text-white">Company</div><div className="mt-3 space-y-2 text-slate-400"><a href="#demo" className="block hover:text-white">Request Demo</a><span className="block">Full Stack Tech & Solutions LLC</span></div></div></div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-500">Copyright © {new Date().getFullYear()} Full Stack Tech & Solutions LLC. All Rights Reserved.</div>
      </footer>
    </div>
  );
}
