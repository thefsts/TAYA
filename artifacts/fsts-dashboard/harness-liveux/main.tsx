// Live-UX harness driver page — parent dashboard origin.
//
// This is the CLIENT-FACING driver: it mounts the REAL VisualEditor component
// (the same source the production dashboard ships) inside the REAL AppLayout,
// on the harness dashboard origin (https://127.0.0.1:4173).
//
// The convex/react hooks are shimmed to the harness dispatcher (/harness/api),
// which talks to the REAL pipeline functions over the in-memory store. The
// iframe therefore loads the REAL /api/editor/frame route from the harness
// convex origin, which serves the REAL annotatePage + buildFrameDocument.
//
// URL: https://127.0.0.1:4173/app/sites/<siteId>/editor
// Acting user is controlled by the harness control API (/harness/acting-user).
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./driver.css";
import VisualEditor from "@/pages/app/sites/VisualEditor";

const rootEl = document.getElementById("root")!;
createRoot(rootEl).render(
  <StrictMode>
    {/* App.tsx wraps the whole app in TooltipProvider (Radix context); the
        sidebar and editor use Tooltips, so the driver must too. */}
    <TooltipProvider>
      {/* Same route registration as production App.tsx ('/app/sites/:siteId/editor')
          so the REAL VisualEditor reads siteId via useParams exactly like the
          deployed dashboard does — never a prop handoff. */}
      <Route path="/app/sites/:siteId/editor" component={VisualEditor} />
      <Toaster />
    </TooltipProvider>
  </StrictMode>,
);
