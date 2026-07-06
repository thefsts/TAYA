import { Link, useLocation } from "wouter";
import { ArrowRight, ShieldCheck, Zap, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import fstsLogo from "@assets/fsts_header_logo_1783377175328.PNG";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <img src={fstsLogo} alt="Full Stack Tech Solutions" className="h-14 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="font-medium text-slate-600 hover:text-slate-900">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 sm:py-32">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-medium mb-8 border border-slate-200">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Mission-Ready Client Management</span>
        </div>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter text-slate-900 max-w-4xl mb-6">
          Command and control for your client websites.
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
          The internal platform for Full Stack Tech Solutions. Manage content, courses, events, and SEO across your entire portfolio from a single, dense control room.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/sign-in">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-base h-12 px-8 shadow-md">
              Access Command Center <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-8 mt-24 max-w-5xl w-full text-left">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-slate-100 text-primary rounded flex items-center justify-center mb-4">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Multi-Tenant Architecture</h3>
            <p className="text-slate-600 text-sm leading-relaxed">Switch between client sites instantly. Independent sandboxes, unified management interface.</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-slate-100 text-primary rounded flex items-center justify-center mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">High-Density Data</h3>
            <p className="text-slate-600 text-sm leading-relaxed">Built for professionals. Less whitespace, more data. See what matters without digging through menus.</p>
          </div>
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="h-10 w-10 bg-slate-100 text-primary rounded flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Strict Role Based Access</h3>
            <p className="text-slate-600 text-sm leading-relaxed">Granular permissions for FSTS staff and client teams. Editors edit, admins administrate.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center border-t border-slate-200 bg-white text-slate-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Full Stack Tech Solutions. All rights reserved.</p>
      </footer>
    </div>
  );
}
