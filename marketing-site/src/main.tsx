import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const path = window.location.pathname.replace(/\/$/, "") || "/";
const routeKey = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
document.body.dataset.route = routeKey;

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
  const main = document.querySelector("main");
  if (main) main.id = "main-content";

  const header = document.querySelector(".header");
  if (header && !header.querySelector(".mobile-menu")) {
    const menu = document.createElement("details");
    menu.className = "mobile-menu";
    menu.innerHTML = '<summary aria-label="Open navigation">Menu</summary><div class="mobile-panel"><a href="/platform">Platform</a><a href="/website-management">Website Management</a><a href="/client-portals">Client Portals</a><a href="/forms-leads">Forms & Leads</a><a href="/media-content">Media & Content</a><a href="/automation">Automation</a><a href="/industries">Industries</a><a href="/pricing">Pricing</a><a href="/resources">Resources</a><a href="/about">About</a><a href="/contact">Request Demo</a></div>';
    header.appendChild(menu);
  }

  if (path === "/contact" && !document.querySelector(".demo-form-wrap")) {
    const anchor = document.querySelector(".contact-grid")?.parentElement;
    if (anchor) {
      const wrap = document.createElement("section");
      wrap.className = "demo-form-wrap";
      wrap.innerHTML = '<form class="demo-form" aria-label="TAYA demo request"><label>Name<input name="name" required autocomplete="name" /></label><label>Business / Organization<input name="business" required autocomplete="organization" /></label><label>Email<input name="email" type="email" required autocomplete="email" /></label><label>Phone<input name="phone" type="tel" autocomplete="tel" /></label><label>Primary need<select name="need"><option>Website management</option><option>Client portals</option><option>Forms & leads</option><option>Events / classes</option><option>Automation</option><option>Multi-site operations</option></select></label><label>Number of websites<input name="sites" type="number" min="1" inputmode="numeric" /></label><label class="full">What would you like TAYA to help you manage?<textarea name="message" required></textarea></label><label class="full"><small>Submitting opens your email app with your information pre-filled so you can review it before sending to Full Stack Tech & Solutions LLC.</small></label><div class="form-status" aria-live="polite"></div><button class="button primary full" type="submit">Prepare Demo Request →</button></form>';
      anchor.insertAdjacentElement("afterend", wrap);
      const form = wrap.querySelector("form") as HTMLFormElement;
      const status = wrap.querySelector(".form-status") as HTMLElement;
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        const data = new FormData(form);
        const body = [
          `Name: ${data.get("name")}`,
          `Business / Organization: ${data.get("business")}`,
          `Email: ${data.get("email")}`,
          `Phone: ${data.get("phone") || "Not provided"}`,
          `Primary need: ${data.get("need")}`,
          `Number of websites: ${data.get("sites") || "Not provided"}`,
          "",
          "What they want TAYA to help manage:",
          String(data.get("message") || ""),
        ].join("\n");
        status.className = "form-status ok";
        status.textContent = "Your request is ready. Your email app will open so you can review and send it.";
        window.location.href = `mailto:amorebey@gmail.com?subject=${encodeURIComponent("TAYA Demo Request")}&body=${encodeURIComponent(body)}`;
      });
    }
  }

  if (!localStorage.getItem("taya-cookie-choice")) {
    const banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookie preferences");
    banner.innerHTML = '<p><strong>Privacy choices</strong><br>TAYA uses essential browser storage for site functionality. Optional analytics will only be enabled after consent when analytics is configured. <a href="/privacy">Privacy Policy</a></p><div class="cookie-actions"><button class="cookie-essential" type="button">Essential only</button><button class="cookie-accept" type="button">Accept optional</button></div>';
    const save = (choice: string) => { localStorage.setItem("taya-cookie-choice", choice); banner.remove(); };
    banner.querySelector(".cookie-essential")?.addEventListener("click", () => save("essential"));
    banner.querySelector(".cookie-accept")?.addEventListener("click", () => save("accepted"));
    document.body.appendChild(banner);
  }
}, 350);
