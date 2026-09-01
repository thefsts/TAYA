import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const titles: Record<string,string> = {
  "/":"TAYA™ | Tools. Automation. Your Advantage.",
  "/platform":"TAYA Platform | Website Operations",
  "/website-management":"Website Management | TAYA",
  "/client-portals":"Client Portals | TAYA",
  "/forms-leads":"Forms & Lead Management | TAYA",
  "/media-content":"Media & Content Management | TAYA",
  "/automation":"Website Automation | TAYA",
  "/industries":"Industries & Use Cases | TAYA",
  "/pricing":"TAYA Pricing & Deployment",
  "/resources":"TAYA Resources & FAQ",
  "/about":"About TAYA | Full Stack Tech & Solutions LLC",
  "/contact":"Request a TAYA Demo",
  "/privacy":"TAYA Privacy Policy",
  "/terms":"TAYA Terms & Conditions",
  "/accessibility":"TAYA Accessibility",
};
const descriptions: Record<string,string> = {
  "/":"Manage, protect and automate website operations with TAYA — controlled content, client portals, forms, media and business-ready workflows.",
  "/platform":"Explore the TAYA website operations platform, including Design Lock™, structured CMS controls, role-aware access and multi-site operations.",
  "/website-management":"Keep professional websites current with controlled content management while protecting approved code, layouts and branding.",
  "/client-portals":"Provide secure branded client access with role-aware permissions and controlled self-service through TAYA.",
  "/forms-leads":"Capture website inquiries, organize form submissions and keep lead activity connected to your business workflows.",
  "/media-content":"Manage approved images, flyers and documents in a governed media library built for website operations.",
  "/automation":"Use TAYA automation for date-aware, capacity-aware and lifecycle-driven website content operations.",
  "/industries":"See how TAYA supports training, professional services, membership organizations, multi-location businesses and event-driven operations.",
  "/pricing":"Request current TAYA deployment pricing based on website scope, users, modules and implementation requirements.",
  "/resources":"Get answers to common questions about TAYA website management, Design Lock™, automation, client portals and multi-site operations.",
  "/about":"Learn why Full Stack Tech & Solutions LLC created TAYA for governed, scalable website operations.",
  "/contact":"Request a TAYA demo and discuss your website operations, client access and automation needs with Full Stack Tech & Solutions LLC.",
  "/privacy":"Review the privacy practices for the TAYA public marketing website operated by Full Stack Tech & Solutions LLC.",
  "/terms":"Review the terms governing use of the public TAYA marketing website.",
  "/accessibility":"Learn about TAYA website accessibility practices and how to report an accessibility barrier.",
};

document.title = titles[path] || "TAYA™ | Website Operations Platform";
const description = document.querySelector('meta[name="description"]');
if (description) description.setAttribute("content", descriptions[path] || descriptions["/"]);
const canonical = document.createElement("link");
canonical.rel = "canonical";
canonical.href = window.location.origin + path;
document.head.appendChild(canonical);
const ogUrl = document.createElement("meta");
ogUrl.setAttribute("property", "og:url");
ogUrl.content = canonical.href;
document.head.appendChild(ogUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

window.setTimeout(() => {
  if (localStorage.getItem("taya-cookie-choice")) return;
  const banner = document.createElement("div");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-label", "Cookie preferences");
  banner.innerHTML = '<p><strong>Privacy choices</strong><br>TAYA uses essential browser storage for site functionality. Optional analytics will only be enabled after consent when analytics is configured. <a href="/privacy">Privacy Policy</a></p><div class="cookie-actions"><button class="cookie-essential" type="button">Essential only</button><button class="cookie-accept" type="button">Accept optional</button></div>';
  const save = (choice: string) => { localStorage.setItem("taya-cookie-choice", choice); banner.remove(); };
  banner.querySelector(".cookie-essential")?.addEventListener("click", () => save("essential"));
  banner.querySelector(".cookie-accept")?.addEventListener("click", () => save("accepted"));
  document.body.appendChild(banner);
}, 350);
