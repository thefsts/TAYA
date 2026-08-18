#!/usr/bin/env node
/**
 * FSTS Improvement Roadmap PDF Generator
 * Generates artifacts/fsts-dashboard/public/fsts-dashboard-roadmap.pdf
 *
 * Data source: scripts/roadmap-data.json
 * Add new improvements to that file; this script reads it at run-time.
 */

import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CHROMIUM = "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
const TMP_HTML = "/tmp/fsts-roadmap.html";
const TMP_PDF  = "/tmp/fsts-roadmap.pdf";
const OUT_DIR  = resolve(ROOT, "artifacts/fsts-dashboard/public");
const OUT_PDF  = resolve(OUT_DIR, "fsts-dashboard-roadmap.pdf");

// --- Load data from canonical source ---

const DATA_FILE = resolve(__dirname, "roadmap-data.json");
const { categories: CATEGORIES, waves: WAVES } = JSON.parse(
  readFileSync(DATA_FILE, "utf8"),
);

// --- Priority colour map (static display config, not roadmap data) ---

const PRIORITY_COLORS = {
  P0: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5", label: "Critical" },
  P1: { bg: "#fff7ed", text: "#9a3412", border: "#fdba74", label: "Required" },
  P2: { bg: "#eff6ff", text: "#1e40af", border: "#93c5fd", label: "Important" },
  P3: { bg: "#f0fdf4", text: "#166534", border: "#86efac", label: "Enhancement" },
};

// --- Build counts ---

const ALL_ITEMS = CATEGORIES.flatMap((c) => c.items.map((i) => ({ ...i, category: c.title })));
const TOTAL = ALL_ITEMS.length;
const P0_COUNT = ALL_ITEMS.filter((i) => i.priority === "P0").length;
const P1_COUNT = ALL_ITEMS.filter((i) => i.priority === "P1").length;
const P2_COUNT = ALL_ITEMS.filter((i) => i.priority === "P2").length;
const P3_COUNT = ALL_ITEMS.filter((i) => i.priority === "P3").length;

// Wave counts
const waveItems = (n) => ALL_ITEMS.filter((i) => i.wave === n);

// --- HTML Builder ---

function tag(tag, attrs, content) {
  const attrStr = Object.entries(attrs || {}).map(([k, v]) => `${k}="${v}"`).join(" ");
  return `<${tag}${attrStr ? " " + attrStr : ""}>${content}</${tag}>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml() {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const coverPage = `
<div class="cover-page">
  <div class="cover-badge">INTERNAL ENGINEERING DOCUMENT</div>
  <div class="cover-logo">FSTS</div>
  <div class="cover-title">FSTS Website Operating System(TM)</div>
  <div class="cover-subtitle">Improvement Roadmap &amp; Execution Plan</div>
  <div class="cover-meta-grid">
    <div class="cover-meta-card">
      <div class="cover-meta-num">${TOTAL}</div>
      <div class="cover-meta-label">Total Improvements</div>
    </div>
    <div class="cover-meta-card">
      <div class="cover-meta-num">${CATEGORIES.length}</div>
      <div class="cover-meta-label">Categories</div>
    </div>
    <div class="cover-meta-card">
      <div class="cover-meta-num">5</div>
      <div class="cover-meta-label">Execution Waves</div>
    </div>
    <div class="cover-meta-card">
      <div class="cover-meta-num">${P0_COUNT}</div>
      <div class="cover-meta-label">P0 Critical</div>
    </div>
  </div>
  <div class="cover-description">
    This document converts all ${TOTAL} approved improvements into a prioritized, wave-based engineering execution plan for the FSTS-WOS(TM) platform. Items are organized by functional area, assigned a priority tier (P0-P3), and placed into execution waves aligned to the Corsair launch milestone and Website #2 readiness goal.
  </div>
  <div class="cover-arch-note">
    <strong>Architecture Principle:</strong> Every improvement must be evaluated for reuse across many independent client websites. The FSTS-WOS(TM) is not built around Corsair -- it is a multi-tenant platform that must support service businesses, e-commerce stores, training companies, membership organizations, and any future business type without changing core dashboard code.
  </div>
  <div class="cover-footer">
    <span>Generated ${today}</span>
    <span>FSTS Client Dashboard -- For FSTS Team Members Only</span>
  </div>
</div>
`;

  // Priority summary bar
  const prioritySummary = `
<div class="page-break"></div>
<div class="section-header" style="background:#1e293b; color:white; padding:20px 24px; border-radius:8px; margin-bottom:20px;">
  <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.6; margin-bottom:6px;">Executive Summary</div>
  <div style="font-size:20px; font-weight:700;">Priority Distribution &amp; Execution Waves</div>
</div>

<div class="priority-grid">
  ${Object.entries(PRIORITY_COLORS).map(([p, c]) => {
    const count = ALL_ITEMS.filter((i) => i.priority === p).length;
    return `
    <div class="priority-card" style="background:${c.bg}; border:1px solid ${c.border};">
      <div class="priority-card-label" style="color:${c.text};">${p} -- ${c.label}</div>
      <div class="priority-card-num" style="color:${c.text};">${count}</div>
      <div class="priority-card-sub" style="color:${c.text};">${Math.round(count / TOTAL * 100)}% of total</div>
    </div>`;
  }).join("")}
</div>

<div class="wave-grid">
  ${WAVES.map((w) => {
    const items = waveItems(w.num);
    const p0 = items.filter((i) => i.priority === "P0").length;
    return `
    <div class="wave-card" style="background:${w.lightColor}; border-left:4px solid ${w.color};">
      <div class="wave-card-title" style="color:${w.color};">${escapeHtml(w.title)}</div>
      <div class="wave-card-desc">${escapeHtml(w.description)}</div>
      ${w.milestone ? `<div class="wave-milestone">? ${escapeHtml(w.milestone)}</div>` : ""}
      <div class="wave-count"><span style="color:${w.color}; font-weight:700;">${items.length} items</span>${p0 > 0 ? ` &nbsp;?&nbsp; ${p0} P0` : ""}</div>
    </div>`;
  }).join("")}
</div>

<div class="toc-section">
  <div class="toc-title">Table of Contents</div>
  <div class="toc-grid">
    ${CATEGORIES.map((c, idx) => `
    <div class="toc-item">
      <span class="toc-num" style="background:${c.color};">${String(idx + 1).padStart(2, "0")}</span>
      <span class="toc-label">${escapeHtml(c.title)}</span>
      <span class="toc-count">${c.items.length}</span>
    </div>`).join("")}
  </div>
</div>
`;

  // Wave overview pages
  const waveOverview = WAVES.map((w) => {
    const items = waveItems(w.num);
    return `
<div class="page-break"></div>
<div class="wave-header" style="background:${w.color};">
  <div class="wave-header-num">Wave ${w.num}</div>
  <div class="wave-header-title">${escapeHtml(w.title.replace(`Wave ${w.num} -- `, ""))}</div>
  <div class="wave-header-desc">${escapeHtml(w.description)}</div>
  ${w.milestone ? `<div class="wave-header-milestone">? ${escapeHtml(w.milestone)}</div>` : ""}
</div>
<table class="wave-table">
  <thead>
    <tr>
      <th style="width:50px;">ID</th>
      <th style="width:70px;">Priority</th>
      <th style="width:130px;">Category</th>
      <th>Improvement</th>
      <th style="width:140px;">Tags</th>
    </tr>
  </thead>
  <tbody>
    ${items.sort((a, b) => {
      const p = ["P0","P1","P2","P3"];
      return p.indexOf(a.priority) - p.indexOf(b.priority) || a.id - b.id;
    }).map((item) => {
      const pc = PRIORITY_COLORS[item.priority];
      const cat = CATEGORIES.find((c) => c.items.some((i) => i.id === item.id));
      return `
    <tr>
      <td class="id-cell">#${item.id}</td>
      <td><span class="priority-badge" style="background:${pc.bg}; color:${pc.text}; border:1px solid ${pc.border};">${item.priority}</span></td>
      <td class="cat-cell">${escapeHtml(cat.title)}</td>
      <td class="what-cell">${escapeHtml(item.what)}</td>
      <td class="tags-cell">${item.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
`;
  }).join("");

  // Category detail pages
  const categoryPages = CATEGORIES.map((cat) => `
<div class="page-break"></div>
<div class="cat-header" style="background:${cat.color}; border-color:${cat.borderColor};">
  <div class="cat-header-inner">
    <div class="cat-header-count" style="background:rgba(255,255,255,0.2);">${cat.items.length} improvements</div>
    <div class="cat-header-title">${escapeHtml(cat.title)}</div>
  </div>
</div>
<table class="detail-table">
  <thead>
    <tr>
      <th style="width:42px;">#</th>
      <th style="width:42px;">ID</th>
      <th style="width:54px;">Priority</th>
      <th style="width:50px;">Wave</th>
      <th style="width:220px;">What It Does</th>
      <th>Why It Makes the Dashboard Better</th>
      <th style="width:120px;">Tags</th>
    </tr>
  </thead>
  <tbody>
    ${cat.items.map((item, idx) => {
      const pc = PRIORITY_COLORS[item.priority];
      const wv = WAVES.find((w) => w.num === item.wave);
      return `
    <tr style="background:${idx % 2 === 0 ? "white" : cat.lightColor};">
      <td class="row-num">${idx + 1}</td>
      <td class="id-cell">#${item.id}</td>
      <td><span class="priority-badge" style="background:${pc.bg}; color:${pc.text}; border:1px solid ${pc.border};">${item.priority}</span></td>
      <td><span class="wave-badge" style="background:${wv.lightColor}; color:${wv.color}; border:1px solid ${wv.color}40;">W${item.wave}</span></td>
      <td class="what-cell">${escapeHtml(item.what)}</td>
      <td class="why-cell">${escapeHtml(item.why)}</td>
      <td class="tags-cell">${item.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
`).join("");

  // Architecture requirements page
  const archPage = `
<div class="page-break"></div>
<div class="section-header" style="background:#1e293b; color:white; padding:20px 24px; border-radius:8px; margin-bottom:20px;">
  <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.6; margin-bottom:6px;">Architectural Foundation</div>
  <div style="font-size:20px; font-weight:700;">FSTS-WOS(TM) Multi-Site &amp; E-Commerce Architecture Requirements</div>
</div>

<div class="arch-grid">
  <div class="arch-card">
    <div class="arch-card-title">?? Core Rule</div>
    <div class="arch-card-body">Do not design the FSTS-WOS(TM) around Corsair specifically. Every feature, model, permission, automation, CMS module, API, and component must be evaluated for reuse across many independent client websites.</div>
  </div>
  <div class="arch-card">
    <div class="arch-card-title">? Client Design Lock</div>
    <div class="arch-card-body">Clients manage approved content, media, products, services, classes, forms, and SEO. They cannot modify source code, structural layouts, design system, backend, or deployment infrastructure. FSTS controls all templates.</div>
  </div>
  <div class="arch-card">
    <div class="arch-card-title">? Multi-Tenant Isolation</div>
    <div class="arch-card-body">Every record must belong to the appropriate tenant. A client must never read, modify, search, export, or indirectly discover another client's products, orders, customers, payments, registrations, media, leads, or configuration.</div>
  </div>
  <div class="arch-card">
    <div class="arch-card-title">? Provider-Agnostic Commerce</div>
    <div class="arch-card-body">Square is the first supported payment provider, but the architecture must allow additional providers later. Use provider abstraction for payments, refunds, customers, orders, discounts, and webhooks. Store provider IDs separately from FSTS IDs.</div>
  </div>
  <div class="arch-card">
    <div class="arch-card-title">? Success Test</div>
    <div class="arch-card-body"><strong>Can we onboard a completely different business -- including a full e-commerce business -- without changing the core dashboard code?</strong> The answer must eventually be YES. Corsair proves #1. Website #2 proves repeatability. An e-commerce client proves platform flexibility. #10 proves scalability.</div>
  </div>
  <div class="arch-card">
    <div class="arch-card-title">? Checklist for Every Task</div>
    <div class="arch-card-body">
      <ol style="padding-left:16px; margin:0; font-size:10px; line-height:1.8;">
        <li>Is this reusable across tenants?</li>
        <li>Does it assume Corsair-specific behavior?</li>
        <li>Does it work for non-Corsair businesses?</li>
        <li>Does it work when the relevant module is disabled?</li>
        <li>Does it maintain tenant isolation?</li>
        <li>Does it respect the client design lock?</li>
        <li>Could it work for an e-commerce site?</li>
        <li>Does it scale to dozens or hundreds of sites?</li>
      </ol>
    </div>
  </div>
</div>

<div class="supported-types">
  <div class="supported-title">Supported Business Types (Platform Must Handle All)</div>
  <div class="supported-grid">
    ${["Service Businesses","E-Commerce Stores","Training Companies","Course/Class Businesses","Event Businesses","Membership Organizations","Professional Services","Restaurants & Hospitality","Nonprofits","Contractors","Retail Businesses","Product + Service Hybrids","Digital Products","Physical Products","Appointments/Bookings","Subscriptions/Memberships"].map((t) => `<div class="supported-item">${escapeHtml(t)}</div>`).join("")}
  </div>
</div>
`;

  // Final stats page
  const statsPage = `
<div class="page-break"></div>
<div class="section-header" style="background:#1e293b; color:white; padding:20px 24px; border-radius:8px; margin-bottom:20px;">
  <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.6; margin-bottom:6px;">Roadmap Summary</div>
  <div style="font-size:20px; font-weight:700;">Execution Statistics &amp; Top Priorities</div>
</div>

<div class="stats-grid">
  <div class="stat-box"><div class="stat-num">${TOTAL}</div><div class="stat-label">Total Improvements</div></div>
  <div class="stat-box"><div class="stat-num">${P0_COUNT}</div><div class="stat-label">P0 Critical</div></div>
  <div class="stat-box"><div class="stat-num">${P1_COUNT}</div><div class="stat-label">P1 Required</div></div>
  <div class="stat-box"><div class="stat-num">${P2_COUNT}</div><div class="stat-label">P2 Important</div></div>
  <div class="stat-box"><div class="stat-num">${P3_COUNT}</div><div class="stat-label">P3 Enhancement</div></div>
  <div class="stat-box"><div class="stat-num">${waveItems(1).length}</div><div class="stat-label">Wave 1 Items</div></div>
  <div class="stat-box"><div class="stat-num">${waveItems(2).length}</div><div class="stat-label">Wave 2 Items</div></div>
  <div class="stat-box"><div class="stat-num">${CATEGORIES.length}</div><div class="stat-label">Categories</div></div>
</div>

<div class="top10-section">
  <div class="top10-title">Top 10 Highest-Value Immediate Actions</div>
  <table class="top10-table">
    <thead>
      <tr><th>#</th><th>ID</th><th>Improvement</th><th>Priority</th><th>Rationale</th></tr>
    </thead>
    <tbody>
      ${[
        { id: 211, rationale: "Clients cannot sign in -- blocking all revenue" },
        { id: 203, rationale: "Validates payment flow after idempotency changes" },
        { id: 206, rationale: "Stops $0/corrupt orders reaching Square" },
        { id: 204, rationale: "Protects all future payment integrations" },
        { id: 92, rationale: "Services not appearing on live website (#1 CMS gap)" },
        { id: 202, rationale: "Paid customers must receive order confirmation" },
        { id: 65, rationale: "Email config requires developer access today" },
        { id: 193, rationale: "Ghost registrations = payments for cancelled classes" },
        { id: 85, rationale: "Blank screens instead of access-denied messages" },
        { id: 135, rationale: "Price changes must reflect within 60 seconds" },
      ].map((t, idx) => {
        const item = ALL_ITEMS.find((i) => i.id === t.id);
        if (!item) return "";
        const pc = PRIORITY_COLORS[item.priority];
        return `<tr>
          <td style="text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
          <td class="id-cell">#${t.id}</td>
          <td style="font-size:10px;">${escapeHtml(item.what)}</td>
          <td><span class="priority-badge" style="background:${pc.bg}; color:${pc.text}; border:1px solid ${pc.border};">${item.priority}</span></td>
          <td style="font-size:10px; color:#64748b;">${escapeHtml(t.rationale)}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</div>

<div class="doc-footer">
  <div>FSTS Website Operating System(TM) -- Internal Engineering Roadmap</div>
  <div>For FSTS team members only ? Do not share with clients ? Generated ${today}</div>
</div>
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FSTS Improvement Roadmap</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; background: white; }

  /* --- Cover --- */
  .cover-page { page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e293b 100%); color: white; padding: 60px 48px; text-align: center; }
  .cover-badge { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; padding: 4px 12px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 32px; }
  .cover-logo { font-size: 48px; font-weight: 900; letter-spacing: -2px; margin-bottom: 8px; background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .cover-title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .cover-subtitle { font-size: 18px; opacity: 0.7; margin-bottom: 48px; }
  .cover-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; width: 100%; max-width: 600px; margin-bottom: 40px; }
  .cover-meta-card { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 16px; }
  .cover-meta-num { font-size: 36px; font-weight: 900; }
  .cover-meta-label { font-size: 10px; opacity: 0.7; margin-top: 4px; }
  .cover-description { max-width: 560px; font-size: 12px; line-height: 1.7; opacity: 0.8; margin-bottom: 24px; }
  .cover-arch-note { max-width: 560px; background: rgba(255,255,255,0.1); border-left: 3px solid #60a5fa; padding: 12px 16px; font-size: 11px; line-height: 1.6; text-align: left; border-radius: 0 6px 6px 0; margin-bottom: 40px; }
  .cover-footer { display: flex; gap: 24px; font-size: 10px; opacity: 0.5; }

  /* --- Page breaks --- */
  .page-break { page-break-before: always; }

  /* --- Priority grid --- */
  .priority-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .priority-card { border-radius: 8px; padding: 16px; text-align: center; }
  .priority-card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .priority-card-num { font-size: 32px; font-weight: 900; }
  .priority-card-sub { font-size: 10px; opacity: 0.7; margin-top: 4px; }

  /* --- Wave grid --- */
  .wave-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 10px; margin-bottom: 24px; }
  .wave-card { border-radius: 6px; padding: 14px 16px; }
  .wave-card-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .wave-card-desc { font-size: 10px; color: #475569; margin-bottom: 6px; }
  .wave-milestone { font-size: 10px; font-style: italic; margin-bottom: 4px; color: #475569; }
  .wave-count { font-size: 11px; }

  /* --- TOC --- */
  .toc-section { margin-top: 8px; }
  .toc-title { font-size: 13px; font-weight: 700; margin-bottom: 12px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .toc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .toc-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .toc-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 700; flex-shrink: 0; }
  .toc-label { flex: 1; font-size: 11px; font-weight: 500; }
  .toc-count { font-size: 11px; font-weight: 700; color: #64748b; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; }

  /* --- Wave header --- */
  .wave-header { padding: 24px 28px; border-radius: 8px; color: white; margin-bottom: 16px; }
  .wave-header-num { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.75; margin-bottom: 4px; }
  .wave-header-title { font-size: 22px; font-weight: 800; margin-bottom: 6px; }
  .wave-header-desc { font-size: 12px; opacity: 0.85; margin-bottom: 6px; }
  .wave-header-milestone { font-size: 11px; background: rgba(255,255,255,0.2); display: inline-block; padding: 3px 10px; border-radius: 4px; margin-top: 6px; }

  /* --- Wave table --- */
  .wave-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .wave-table th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  .wave-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-size: 10px; }
  .wave-table tr:nth-child(even) td { background: #f8fafc; }

  /* --- Category header --- */
  .cat-header { border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .cat-header-inner { padding: 18px 24px; color: white; }
  .cat-header-count { display: inline-block; font-size: 10px; font-weight: 600; padding: 3px 10px; border-radius: 12px; margin-bottom: 8px; }
  .cat-header-title { font-size: 20px; font-weight: 800; }

  /* --- Detail table --- */
  .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .detail-table th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 7px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  .detail-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }

  /* --- Shared cells --- */
  .id-cell { font-size: 10px; font-weight: 700; color: #64748b; white-space: nowrap; }
  .row-num { font-size: 10px; color: #94a3b8; text-align: center; }
  .cat-cell { font-size: 9px; color: #475569; }
  .what-cell { font-size: 10px; line-height: 1.5; }
  .why-cell { font-size: 10px; color: #475569; line-height: 1.5; }
  .tags-cell { font-size: 9px; }

  /* --- Badges --- */
  .priority-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
  .wave-badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
  .tag { display: inline-block; font-size: 8px; background: #f1f5f9; color: #475569; padding: 1px 5px; border-radius: 3px; margin: 1px; white-space: nowrap; }

  /* --- Architecture page --- */
  .arch-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
  .arch-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .arch-card-title { font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #1e293b; }
  .arch-card-body { font-size: 10px; color: #475569; line-height: 1.6; }
  .supported-types { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .supported-title { font-size: 12px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
  .supported-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .supported-item { font-size: 9px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; color: #475569; }

  /* --- Stats --- */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-num { font-size: 32px; font-weight: 900; color: #1e293b; }
  .stat-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  .top10-section { margin-bottom: 24px; }
  .top10-title { font-size: 13px; font-weight: 700; margin-bottom: 12px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .top10-table { width: 100%; border-collapse: collapse; }
  .top10-table th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  .top10-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }

  /* --- Footer --- */
  .doc-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }

  /* --- Section header --- */
  .section-header { margin-top: 24px; }

  /* --- Print --- */
  @media print {
    @page { size: A4; margin: 16mm 14mm; }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page-break { page-break-before: always; }
    .cover-page { page-break-after: always; }
    .wave-header, .cat-header-inner, .cover-page { print-color-adjust: exact; }
  }
</style>
</head>
<body>
${coverPage}
${prioritySummary}
${waveOverview}
${categoryPages}
${archPage}
${statsPage}
</body>
</html>`;
}

// --- Main ---

console.log("? Building HTML...");
const html = buildHtml();
writeFileSync(TMP_HTML, html, "utf8");
console.log(`   ? Wrote ${(html.length / 1024).toFixed(1)} KB to ${TMP_HTML}`);

console.log("??  Generating PDF via Chromium...");
const chromiumCmd = [
  CHROMIUM,
  "--headless",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--print-to-pdf=${TMP_PDF}`,
  "--print-to-pdf-no-header",
  `file://${TMP_HTML}`,
].join(" ");

try {
  execSync(chromiumCmd, { stdio: "pipe", timeout: 60000 });
} catch (err) {
  console.error("Chromium stderr:", err.stderr?.toString() || "(none)");
  console.error("Chromium stdout:", err.stdout?.toString() || "(none)");
  throw err;
}

const pdfStat = statSync(TMP_PDF);
console.log(`   ? PDF generated: ${(pdfStat.size / 1024).toFixed(1)} KB`);

// Copy to artifact public dir
if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

execSync(`cp "${TMP_PDF}" "${OUT_PDF}"`);
const outStat = statSync(OUT_PDF);
console.log(`\n? Done! PDF written to: ${OUT_PDF}`);
console.log(`   File size: ${(outStat.size / 1024).toFixed(1)} KB`);
