// Live-UX harness driver page — parent dashboard origin.
//
// This is the CLIENT-FACING driver: it mounts the REAL dashboard components
// (the same sources the production dashboard ships) on the harness dashboard
// origin (https://127.0.0.1:4173).
//
// The convex/react hooks are shimmed to the harness dispatcher (/harness/api),
// which talks to the REAL pipeline functions over the in-memory store. The
// iframe therefore loads the REAL /api/editor/frame route from the harness
// convex origin, which serves the REAL annotatePage + buildFrameDocument.
// @clerk/react is shimmed too — the harness acting-user control endpoint is
// the login layer (no Clerk credentials in this environment).
//
// Routes (same registrations as production App.tsx):
//   /app/sites/:siteId            -> SiteDashboard   (§8 health card evidence)
//   /app/sites/:siteId/editor     -> VisualEditor    (the editing rail)
//   /app/sites/:siteId/settings   -> WebsiteSettings (§9 analytics evidence)
//   /app/sites/:siteId/health     -> HealthMonitor   (View Site Health CTA)
//
// Acting user is controlled by the harness control API (/harness/acting-user).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./driver.css";
import VisualEditor from "@/pages/app/sites/VisualEditor";
import SiteDashboard from "@/pages/app/SiteDashboard";
import WebsiteSettings from "@/pages/app/sites/WebsiteSettings";
import HealthMonitor from "@/pages/app/sites/HealthMonitor";
import FormBuilder from "@/pages/app/sites/FormBuilder";

const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(
  <StrictMode>
    {/* App.tsx wraps the whole app in TooltipProvider (Radix context); the
        sidebar and editor use Tooltips, so the driver must too. */}
    <TooltipProvider>
      {/* Same route registrations as production App.tsx so the REAL
          components read siteId via useParams exactly like the deployed
          dashboard does — never a prop handoff. */}
      <Switch>
        <Route path="/app/sites/:siteId" component={SiteDashboard} />
        <Route path="/app/sites/:siteId/editor" component={VisualEditor} />
        <Route path="/app/sites/:siteId/settings" component={WebsiteSettings} />
        <Route path="/app/sites/:siteId/health" component={HealthMonitor} />
        {/* §5 forms — the EXISTING FormBuilder the VisualEditor Forms panel
            routes to (same registration as production App.tsx). */}
        <Route path="/app/sites/:siteId/forms/:formId" component={FormBuilder} />
      </Switch>
      <Toaster />
    </TooltipProvider>
  </StrictMode>,
);
