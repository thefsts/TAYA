import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk, useUser } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { ConvexProvider, ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import fstsLogo from "@assets/fsts_header_logo_1783377175328.PNG";
import DesignLockGuard from "@/components/DesignLockGuard";

// Lazy-loaded pages — each route is its own chunk so clients only download
// the code for the pages they actually visit.
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const SitesList = lazy(() => import("@/pages/app/SitesList"));
const SiteDashboard = lazy(() => import("@/pages/app/SiteDashboard"));

const AdminUsers = lazy(() => import("@/pages/app/admin/AdminUsers"));
const AdminSites = lazy(() => import("@/pages/app/admin/AdminSites"));
const AdminAccessControl = lazy(() => import("@/pages/app/admin/AdminAccessControl"));
const AdminDesignLock = lazy(() => import("@/pages/app/admin/AdminDesignLock"));
const AdminAgencies = lazy(() => import("@/pages/app/admin/AdminAgencies"));
const AdminPlatformControls = lazy(() => import("@/pages/app/admin/AdminPlatformControls"));
const AdminSiteOnboarding = lazy(() => import("@/pages/app/admin/AdminSiteOnboarding"));
const OnboardingWizard = lazy(() => import("@/pages/app/OnboardingWizard"));
const AdminPlatformRunbook = lazy(() => import("@/pages/app/admin/AdminPlatformRunbook"));
const AdminRoles = lazy(() => import("@/pages/app/admin/AdminRoles"));

const HomepageEditor = lazy(() => import("@/pages/app/sites/HomepageEditor"));
const CoursesList = lazy(() => import("@/pages/app/sites/CoursesList"));
const EventsList = lazy(() => import("@/pages/app/sites/EventsList"));
const ArticlesList = lazy(() => import("@/pages/app/sites/ArticlesList"));
const SeoSettings = lazy(() => import("@/pages/app/sites/SeoSettings"));
const MediaLibrary = lazy(() => import("@/pages/app/sites/MediaLibrary"));
const FooterEditor = lazy(() => import("@/pages/app/sites/FooterEditor"));
const ContactInfo = lazy(() => import("@/pages/app/sites/ContactInfo"));
const PaymentsConfig = lazy(() => import("@/pages/app/sites/PaymentsConfig"));
const Commerce = lazy(() => import("@/pages/app/sites/Commerce"));
const EmailConfig = lazy(() => import("@/pages/app/sites/EmailConfig"));
const CrmConnectionConfig = lazy(() => import("@/pages/app/sites/CrmConnectionConfig"));
const VersionHistory = lazy(() => import("@/pages/app/sites/VersionHistory"));
const ActivityLog = lazy(() => import("@/pages/app/sites/ActivityLog"));
const BackupsList = lazy(() => import("@/pages/app/sites/BackupsList"));
const HelpCenter = lazy(() => import("@/pages/app/sites/HelpCenter"));
const FaqManager = lazy(() => import("@/pages/app/sites/FaqManager"));
const TestimonialsManager = lazy(() => import("@/pages/app/sites/TestimonialsManager"));
const FormSubmissions = lazy(() => import("@/pages/app/sites/FormSubmissions"));
const HealthMonitor = lazy(() => import("@/pages/app/sites/HealthMonitor"));
const PolicyEditor = lazy(() => import("@/pages/app/sites/PolicyEditor"));
const NavigationManager = lazy(() => import("@/pages/app/sites/NavigationManager"));
const AnnouncementBanner = lazy(() => import("@/pages/app/sites/AnnouncementBanner"));
const CtaManager = lazy(() => import("@/pages/app/sites/CtaManager"));
const DownloadsManager = lazy(() => import("@/pages/app/sites/DownloadsManager"));
const TeamManager = lazy(() => import("@/pages/app/sites/TeamManager"));
const ServicesManager = lazy(() => import("@/pages/app/sites/ServicesManager"));
const CareersManager = lazy(() => import("@/pages/app/sites/CareersManager"));
const PopupManager = lazy(() => import("@/pages/app/sites/PopupManager"));

// WOS Phase 2 — Website Settings
const WebsiteSettings = lazy(() => import("@/pages/app/sites/WebsiteSettings"));

// Phase 3 — Form Builder
const FormsList = lazy(() => import("@/pages/app/sites/FormsList"));
const FormBuilder = lazy(() => import("@/pages/app/sites/FormBuilder"));
const PublicForm = lazy(() => import("@/pages/PublicForm"));

// Phase 5 — Square Commerce
const SquareCommerce = lazy(() => import("@/pages/app/sites/SquareCommerce"));

// Phase 9 — Client Permissions™
const MyPermissions = lazy(() => import("@/pages/app/sites/MyPermissions"));

// WOS Phase 1 — Payment Connector Framework™
const PaymentProviders = lazy(() => import("@/pages/app/sites/PaymentProviders"));

// WOS Phase 8 — Automation Engine™
const AutomationRules = lazy(() => import("@/pages/app/sites/AutomationRules"));

// Website Reviews Module™
const ReviewsManager = lazy(() => import("@/pages/app/sites/ReviewsManager"));

// Products / Offerings Manager
const ProductsManager = lazy(() => import("@/pages/app/sites/ProductsManager"));

// Phase 80 — Client Portal™ / Multi-Portal Authentication System™
const PortalLogin = lazy(() => import("@/pages/portal/PortalLogin"));
const PortalRegister = lazy(() => import("@/pages/portal/PortalRegister"));
const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard"));
const PortalManager = lazy(() => import("@/pages/app/sites/PortalManager"));

function withPortalConvex<P extends object>(Component: React.ComponentType<P>) {
  return function PortalPage(props: P) {
    if (!convex) return null;
    return (
      <ConvexProvider client={convex}>
        <Component {...props} />
      </ConvexProvider>
    );
  };
}

function PortalRootRedirect() {
  const params = useParams<{ siteSlug: string }>();
  const [, setLocation] = useLocation();
  const siteSlug = params.siteSlug ?? "";
  useEffect(() => {
    const raw = localStorage.getItem(`portal_session_${siteSlug}`);
    setLocation(raw ? `/portal/${siteSlug}/dashboard` : `/portal/${siteSlug}/login`);
  }, [siteSlug, setLocation]);
  return null;
}

const PortalLoginPage = withPortalConvex(PortalLogin);
const PortalRegisterPage = withPortalConvex(PortalRegister);
const PortalDashboardPage = withPortalConvex(PortalDashboard);
const PortalRootPage = withPortalConvex(PortalRootRedirect);

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkKeyIsTestInProd =
  import.meta.env.PROD === true && clerkPubKey.startsWith("pk_test_");

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

function isValidConvexUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const convexUrlPresent = !!convexUrl;
const convexUrlValid = convexUrlPresent && isValidConvexUrl(convexUrl);

if (!import.meta.env.PROD && (!convexUrlPresent || !convexUrlValid)) {
  throw new Error("Missing or invalid VITE_CONVEX_URL in .env file");
}

const convexUrlMissingInProd = import.meta.env.PROD === true && !convexUrlPresent;
const convexUrlInvalidInProd = import.meta.env.PROD === true && convexUrlPresent && !convexUrlValid;

const convex: ConvexReactClient | null = convexUrlValid
  ? new ConvexReactClient(convexUrl)
  : null;

if (!import.meta.env.PROD && convex) {
  (window as any).__convex = convex;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${fstsLogo}`,
  },
  variables: {
    colorPrimary: "hsl(84 65% 25%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white border border-slate-200 shadow-xl rounded-md w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-slate-900",
    headerSubtitle: "text-sm text-slate-500",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "text-sm font-medium text-slate-900",
    footerActionLink: "font-semibold text-primary hover:text-primary/90",
    footerActionText: "text-slate-500",
    dividerText: "text-xs font-medium text-slate-500",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-sm text-green-600",
    alertText: "text-sm text-red-600 font-medium",
    logoBox: "mb-6 flex justify-center",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border-slate-200 bg-white hover:bg-slate-50 text-slate-900",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-white shadow-sm font-medium",
    formFieldInput: "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    footerAction: "bg-slate-50 border-t border-slate-200 py-4",
    dividerLine: "bg-slate-200",
    alert: "bg-red-50 border border-red-200 rounded-md p-3",
    otpCodeFieldInput: "border-slate-200 bg-white text-slate-900",
    formFieldRow: "space-y-4",
    main: "p-6",
  },
};

function AuthBootstrap() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const provisionMe = useMutation(api.users.provisionMe);
  const provisioned = useRef(false);
  const { signOut } = useClerk();

  useEffect(() => {
    if (isAuthenticated && !isLoading && !provisioned.current) {
      provisioned.current = true;
      provisionMe().catch((err: Error) => {
        if (err?.message?.includes("Account is deactivated")) {
          signOut({ redirectUrl: `${basePath}/sign-in?deactivated=1` });
        }
      });
    }
  }, [isAuthenticated, isLoading, provisionMe, signOut]);

  return null;
}

function DeactivationGuard() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);
  const { signOut } = useClerk();

  useEffect(() => {
    if (isAuthenticated && me !== undefined && me !== null && me.isActive === false) {
      signOut({ redirectUrl: `${basePath}/sign-in?deactivated=1` });
    }
  }, [isAuthenticated, me, signOut]);

  return null;
}

function AuthPageBrand() {
  return (
    <div className="flex flex-col items-center mb-8">
      <img src={fstsLogo} alt="Full Stack Tech Solutions" className="h-16 w-auto mb-3" />
      <p className="text-sm font-medium text-slate-500 tracking-wide">
        Client Dashboard
      </p>
    </div>
  );
}

function SignInPage() {
  const isDeactivated = new URLSearchParams(window.location.search).get("deactivated") === "1";
  return (
    <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <AuthPageBrand />
      {isDeactivated && (
        <div className="mb-4 w-full max-w-[440px] rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your account has been deactivated. Please contact your administrator.
        </div>
      )}
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <AuthPageBrand />
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function RedirectToApp({ setLocation }: { setLocation: (to: string) => void }) {
  useEffect(() => {
    setLocation("/app");
  }, [setLocation]);
  return null;
}

function HomeRedirect() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation("/app");
    }
  }, [isLoaded, isSignedIn, setLocation]);

  return <Landing />;
}

function withDesignLock<P extends object>(Component: React.ComponentType<P>) {
  return function GuardedComponent(props: P) {
    return <DesignLockGuard><Component {...props} /></DesignLockGuard>;
  };
}

const FooterEditorGuarded = withDesignLock(FooterEditor);
const PaymentsConfigGuarded = withDesignLock(PaymentsConfig);
const CommerceGuarded = withDesignLock(Commerce);
const EmailConfigGuarded = withDesignLock(EmailConfig);
const CrmConnectionConfigGuarded = withDesignLock(CrmConnectionConfig);
const HealthMonitorGuarded = withDesignLock(HealthMonitor);
const NavigationManagerGuarded = withDesignLock(NavigationManager);
const VersionHistoryGuarded = withDesignLock(VersionHistory);
const ActivityLogGuarded = withDesignLock(ActivityLog);
const BackupsListGuarded = withDesignLock(BackupsList);

function AppRouter() {
  const [, setLocation] = useLocation();

  if (!convex) return null;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <AuthBootstrap />
        <DeactivationGuard />
        <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/forms/:siteSlug/:formSlug" component={PublicForm} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/app" component={SitesList} />
          <Route path="/app/admin/users" component={AdminUsers} />
          <Route path="/app/admin/sites" component={AdminSites} />
          <Route path="/app/admin/access-control" component={AdminAccessControl} />
          <Route path="/app/admin/design-lock" component={AdminDesignLock} />
          <Route path="/app/admin/agencies" component={AdminAgencies} />
          <Route path="/app/admin/platform-controls" component={AdminPlatformControls} />
          <Route path="/app/admin/onboarding" component={AdminSiteOnboarding} />
          <Route path="/app/onboard" component={OnboardingWizard} />
          <Route path="/app/admin/runbook" component={AdminPlatformRunbook} />
          <Route path="/app/admin/roles" component={AdminRoles} />

          <Route path="/app/sites/:siteId" component={SiteDashboard} />
          <Route path="/app/sites/:siteId/homepage" component={HomepageEditor} />
          <Route path="/app/sites/:siteId/courses" component={CoursesList} />
          <Route path="/app/sites/:siteId/events" component={EventsList} />
          <Route path="/app/sites/:siteId/articles" component={ArticlesList} />
          <Route path="/app/sites/:siteId/seo" component={SeoSettings} />
          <Route path="/app/sites/:siteId/media" component={MediaLibrary} />
          <Route path="/app/sites/:siteId/footer" component={FooterEditorGuarded} />
          <Route path="/app/sites/:siteId/contact" component={ContactInfo} />
          <Route path="/app/sites/:siteId/payments" component={PaymentsConfigGuarded} />
          <Route path="/app/sites/:siteId/commerce" component={SquareCommerce} />
          <Route path="/app/sites/:siteId/email" component={EmailConfigGuarded} />
          <Route path="/app/sites/:siteId/crm" component={CrmConnectionConfigGuarded} />
          <Route path="/app/sites/:siteId/faq" component={FaqManager} />
          <Route path="/app/sites/:siteId/testimonials" component={TestimonialsManager} />
          <Route path="/app/sites/:siteId/inbox" component={FormSubmissions} />
          <Route path="/app/sites/:siteId/health" component={HealthMonitorGuarded} />
          <Route path="/app/sites/:siteId/policies" component={PolicyEditor} />
          <Route path="/app/sites/:siteId/nav" component={NavigationManagerGuarded} />
          <Route path="/app/sites/:siteId/announcement" component={AnnouncementBanner} />
          <Route path="/app/sites/:siteId/cta" component={CtaManager} />
          <Route path="/app/sites/:siteId/downloads" component={DownloadsManager} />
          <Route path="/app/sites/:siteId/team" component={TeamManager} />
          <Route path="/app/sites/:siteId/services" component={ServicesManager} />
          <Route path="/app/sites/:siteId/careers" component={CareersManager} />
          <Route path="/app/sites/:siteId/popup" component={PopupManager} />
          <Route path="/app/sites/:siteId/history" component={VersionHistoryGuarded} />
          <Route path="/app/sites/:siteId/activity" component={ActivityLogGuarded} />
          <Route path="/app/sites/:siteId/backups" component={BackupsListGuarded} />
          <Route path="/app/sites/:siteId/help" component={HelpCenter} />

          {/* WOS Phase 2 — Website Settings */}
          <Route path="/app/sites/:siteId/settings" component={WebsiteSettings} />

          {/* Phase 3 — Form Builder */}
          <Route path="/app/sites/:siteId/forms" component={FormsList} />
          <Route path="/app/sites/:siteId/forms/:formId" component={FormBuilder} />

          {/* Phase 9 — Client Permissions™ */}
          <Route path="/app/sites/:siteId/permissions" component={MyPermissions} />

          {/* WOS Phase 1 — Payment Connector Framework™ */}
          <Route path="/app/sites/:siteId/payment-providers" component={PaymentProviders} />

          {/* WOS Phase 8 — Automation Engine™ */}
          <Route path="/app/sites/:siteId/automation" component={AutomationRules} />

          {/* Website Reviews Module™ */}
          <Route path="/app/sites/:siteId/reviews" component={ReviewsManager} />

          {/* Phase 80 — Client Portal™ */}
          <Route path="/app/sites/:siteId/portal" component={PortalManager} />

          {/* Products / Offerings Manager */}
          <Route path="/app/sites/:siteId/products" component={ProductsManager} />

          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function App() {
  if (clerkKeyIsTestInProd) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-red-800">
            Invalid Clerk Key for Production
          </h1>
          <p className="mb-4 text-sm text-red-700">
            A development Clerk key (<code className="rounded bg-red-100 px-1 font-mono text-xs">pk_test_…</code>) is set but this app is running in production mode. Clerk blocks development keys in production, which causes a blank page or crash.
          </p>
          <p className="text-sm font-medium text-red-800">
            Fix: Set <code className="rounded bg-red-100 px-1 font-mono text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> to a{" "}
            <code className="rounded bg-red-100 px-1 font-mono text-xs">pk_live_</code> key in your Vercel project settings.
          </p>
        </div>
      </div>
    );
  }

  if (convexUrlMissingInProd) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-red-800">
            Missing Convex URL
          </h1>
          <p className="mb-4 text-sm text-red-700">
            <code className="rounded bg-red-100 px-1 font-mono text-xs">VITE_CONVEX_URL</code> is not set. Without it the app cannot connect to the backend and shows a blank page or crash.
          </p>
          <p className="text-sm font-medium text-red-800">
            Fix: Set <code className="rounded bg-red-100 px-1 font-mono text-xs">VITE_CONVEX_URL</code> to your Convex deployment URL in your Vercel project settings. Find it in the{" "}
            <strong>Convex Dashboard → your deployment → Settings → URL &amp; Deploy Key</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (convexUrlInvalidInProd) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-red-800">
            Invalid Convex URL
          </h1>
          <p className="mb-4 text-sm text-red-700">
            <code className="rounded bg-red-100 px-1 font-mono text-xs">VITE_CONVEX_URL</code> is set but is not a valid URL. The app cannot connect to the backend and will crash on load.
          </p>
          <p className="text-sm font-medium text-red-800">
            Fix: Set <code className="rounded bg-red-100 px-1 font-mono text-xs">VITE_CONVEX_URL</code> to a valid{" "}
            <code className="rounded bg-red-100 px-1 font-mono text-xs">https://</code> URL from{" "}
            <strong>Convex Dashboard → your deployment → Settings → URL &amp; Deploy Key</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
          <Switch>
            {/* Phase 80 — Client Portal™ public routes (no Clerk auth) */}
            <Route path="/portal/:siteSlug/login" component={PortalLoginPage} />
            <Route path="/portal/:siteSlug/register" component={PortalRegisterPage} />
            <Route path="/portal/:siteSlug/dashboard" component={PortalDashboardPage} />
            <Route path="/portal/:siteSlug" component={PortalRootPage} />
            {/* Dashboard routes (Clerk auth) */}
            <Route component={AppRouter} />
          </Switch>
        </Suspense>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
