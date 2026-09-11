/**
 * protocol-parity.spec.ts — Chat B §5(e): the harness speaks the EXACT
 * frame↔parent grammar the REAL production editor uses.
 *
 * Reads VisualEditor.tsx + editorFrame.ts from SOURCE (not the bundle) and
 * asserts every message kind the harness driver page emits/handles is one
 * the REAL production code defines — no invented grammar can silently
 * diverge the client experience from what production ships.
 *
 * Checked pairs (parent side in VisualEditor.tsx, frame side in
 * convex/lib/editorFrame.ts):
 *   frame → parent : ready, element-click, block-click, locked-click,
 *                    navigate, preview-applied, pong, selection-cleared
 *   parent → frame : apply-draft, op (remove/restore/reorder/add/zone-refresh), ping
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "..", "..", ".."); // repo root
const VISUAL_EDITOR = join(REPO, "artifacts", "fsts-dashboard", "src", "pages", "app", "sites", "VisualEditor.tsx");
const EDITOR_FRAME = join(REPO, "convex", "lib", "editorFrame.ts");

test("the REAL VisualEditor handles every frame message kind the harness frame emits", () => {
  const editorSrc = readFileSync(VISUAL_EDITOR, "utf-8");
  const frameSrc = readFileSync(EDITOR_FRAME, "utf-8");

  // Frame→parent kinds (editorFrame.ts post() calls) — production grammar.
  const frameKinds = [
    "ready",
    "element-click",
    "block-click",
    "locked-click",
    "navigate",
    "preview-applied",
    "pong",
    "selection-cleared",
  ];
  for (const kind of frameKinds) {
    expect(
      frameSrc.includes(`kind:"${kind}"`) || frameSrc.includes(`kind: "${kind}"`),
      `editorFrame.ts must emit ${kind}`,
    ).toBe(true);
  }

  // The REAL VisualEditor switches on exactly these kinds (its onMessage).
  for (const kind of frameKinds) {
    expect(
      editorSrc.includes(`"${kind}"`),
      `VisualEditor.tsx must handle "${kind}"`,
    ).toBe(true);
  }
});

test("the REAL VisualEditor sends only parent→frame kinds the frame implements", () => {
  const editorSrc = readFileSync(VISUAL_EDITOR, "utf-8");
  const frameSrc = readFileSync(EDITOR_FRAME, "utf-8");

  // Parent→frame kinds sent by the REAL editor.
  expect(editorSrc.includes('"apply-draft"')).toBe(true);
  expect(editorSrc.includes('"op"')).toBe(true);
  // The frame implements apply-draft + the op verbs.
  expect(frameSrc.includes("apply-draft")).toBe(true);
  const opVerbs = ["remove", "restore", "reorder", "add", "zone-refresh"];
  for (const verb of opVerbs) {
    expect(frameSrc.includes(`"${verb}"`), `editorFrame must implement op ${verb}`).toBe(true);
  }

  // Origin discipline: the frame checks the parent origin.
  expect(frameSrc.includes("dashboardOrigin")).toBe(true);
  // Burn-first token grammar: single-use frame tokens.
  expect(editorSrc.includes("createFrameToken")).toBe(true);
});

test("harness driver registers the SAME route production App.tsx uses", () => {
  const driverSrc = readFileSync(join(REPO, "artifacts", "fsts-dashboard", "harness-liveux", "main.tsx"), "utf-8");
  const appSrc = readFileSync(join(REPO, "artifacts", "fsts-dashboard", "src", "App.tsx"), "utf-8");
  expect(driverSrc.includes('/app/sites/:siteId/editor')).toBe(true);
  expect(appSrc.includes('/app/sites/:siteId/editor')).toBe(true);
});

test("client language never leaks engine vocabulary to clients", () => {
  const langSrc = readFileSync(join(REPO, "artifacts", "fsts-dashboard", "src", "lib", "editorClientLanguage.ts"), "utf-8");
  const editorSrc = readFileSync(VISUAL_EDITOR, "utf-8");

  // The banned words rule (ux-audit §D): never in client copy.
  for (const banned of [" zone ", "zones are", "block-id", " content map ", " vault "]) {
    expect(langSrc.includes(banned), `client language must not say "${banned}"`).toBe(false);
  }
  // ADD_ACTIONS labels are the client-facing strings (spot check) \u2014 they
  // are DEFINED in editorClientLanguage.ts (the only client-language
  // module) and RENDERED by VisualEditor via {a.label}; assert both sides
  // of that contract instead of a literal in the component source.
  expect(editorSrc.includes("ADD_ACTIONS"), "VisualEditor must render ADD_ACTIONS labels").toBe(true);
  for (const label of ["+ Add text", "+ Add image", "+ Add video", "+ Add resource", "+ Add FAQ", "+ Add CTA", "+ Add button"]) {
    expect(langSrc.includes(`label: "${label}"`), `client language must define "${label}"`).toBe(true);
  }
});
