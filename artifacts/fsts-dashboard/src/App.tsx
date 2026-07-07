import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, SignIn, SignUp, Show, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect, useRef } from "react";
import { api } from "@convex/_generated/api";
import fstsLogo from "@assets/fsts_header_logo_1783377175328.PNG";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import SitesList from "@/pages/app/SitesList";
import SiteDashboard from "@/pages/app/SiteDashboard";

import AdminUsers from "@/pages/app/admin/AdminUsers";
import AdminSites from "@/pages/app/admin/AdminSites";
import HomepageEditor from "@/pages/app/sites/HomepageEditor";
import CoursesList from "@/pages/app/sites/CoursesList";
import EventsList from "@/pages/app/sites/EventsList";
import ArticlesList from "@/pages/app/sites/ArticlesList";
import SeoSettings from "@/pages/app/sites/SeoSettings";
import MediaLibrary from "@/pages/app/sites/MediaLibrary";
import FooterEditor from "@/pages/app/sites/FooterEditor";
import ContactInfo from "@/pages/app/sites/ContactInfo";
import PaymentsConfig from "@/pages/app/sites/PaymentsConfig";
import EmailConfig from "@/pages/app/sites/EmailConfig";
import CrmConnectionConfig from "@/pages/app/sites/CrmConnectionConfig";
import VersionHistory from "@/pages/app/sites/VersionHistory";
import ActivityLog from "@/pages/app/sites/ActivityLog";
import BackupsList from "@/pages/app/sites/BackupsList";
import HelpCenter from "@/pages/app/sites/HelpCenter";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

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

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL in .env file");
}
const convex = new ConvexReactClient(convexUrl);

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

  useEffect(() => {
    if (isAuthenticated && !isLoading && !provisioned.current) {
      provisioned.current = true;
      provisionMe().catch(() => {});
    }
  }, [isAuthenticated, isLoading, provisionMe]);

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
  return (
    <div className="flex flex-col min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <AuthPageBrand />
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
  return (
    <>
      <Show when="signed-in">
        <RedirectToApp setLocation={setLocation} />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function AppRouter() {
  const [, setLocation] = useLocation();

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
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/app" component={SitesList} />
          <Route path="/app/admin/users" component={AdminUsers} />
          <Route path="/app/admin/sites" component={AdminSites} />

          <Route path="/app/sites/:siteId" component={SiteDashboard} />
          <Route path="/app/sites/:siteId/homepage" component={HomepageEditor} />
          <Route path="/app/sites/:siteId/courses" component={CoursesList} />
          <Route path="/app/sites/:siteId/events" component={EventsList} />
          <Route path="/app/sites/:siteId/articles" component={ArticlesList} />
          <Route path="/app/sites/:siteId/seo" component={SeoSettings} />
          <Route path="/app/sites/:siteId/media" component={MediaLibrary} />
          <Route path="/app/sites/:siteId/footer" component={FooterEditor} />
          <Route path="/app/sites/:siteId/contact" component={ContactInfo} />
          <Route path="/app/sites/:siteId/payments" component={PaymentsConfig} />
          <Route path="/app/sites/:siteId/email" component={EmailConfig} />
          <Route path="/app/sites/:siteId/crm" component={CrmConnectionConfig} />
          <Route path="/app/sites/:siteId/history" component={VersionHistory} />
          <Route path="/app/sites/:siteId/activity" component={ActivityLog} />
          <Route path="/app/sites/:siteId/backups" component={BackupsList} />
          <Route path="/app/sites/:siteId/help" component={HelpCenter} />

          <Route component={NotFound} />
        </Switch>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <AppRouter />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
