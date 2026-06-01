import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, dirname, basename } from "path";

const WORKSPACE_ROOT = join(import.meta.dirname, "../..");
const TEST_RESULTS_DIR = join(
  WORKSPACE_ROOT,
  "tests/visual-regression/test-results"
);
const REPORT_PATH = join(
  WORKSPACE_ROOT,
  "tests/visual-regression/visual-diff-report.html"
);

interface DiffEntry {
  component: string;
  diffPath: string;
  actualPath: string | null;
  expectedPath: string | null;
}

function walkDir(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function toBase64(filePath: string): string {
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath).toString("base64");
}

function extractComponentName(diffFile: string): string {
  // Playwright names diff attachments after the snapshot name:
  //   "<SnapshotName>-diff.png"  e.g. "CoursesListingPage-diff.png"
  return basename(diffFile, "-diff.png");
}

function collectDiffs(): DiffEntry[] {
  const allFiles = walkDir(TEST_RESULTS_DIR);
  const diffFiles = allFiles.filter((f) => f.endsWith("-diff.png"));

  return diffFiles.map((diffPath) => {
    const dir = dirname(diffPath);
    const base = basename(diffPath, "-diff.png");
    const actualPath = join(dir, `${base}-actual.png`);
    const expectedPath = join(dir, `${base}-expected.png`);
    return {
      component: extractComponentName(diffPath),
      diffPath,
      actualPath: existsSync(actualPath) ? actualPath : null,
      expectedPath: existsSync(expectedPath) ? expectedPath : null,
    };
  });
}

function imgTag(b64: string, label: string): string {
  if (!b64) {
    return `<div class="missing"><em>${label} not found</em></div>`;
  }
  return `<img src="data:image/png;base64,${b64}" alt="${label}" title="${label}" />`;
}

function generateHtml(entries: DiffEntry[]): string {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const cards = entries
    .map((e) => {
      const expectedB64 = toBase64(e.expectedPath ?? "");
      const actualB64 = toBase64(e.actualPath ?? "");
      const diffB64 = toBase64(e.diffPath);
      const relDiff = relative(WORKSPACE_ROOT, e.diffPath);

      return `
    <section class="card">
      <h2>${e.component}</h2>
      <p class="path">${relDiff}</p>
      <div class="images">
        <figure>
          <figcaption>Baseline (expected)</figcaption>
          ${imgTag(expectedB64, "expected")}
        </figure>
        <figure>
          <figcaption>Current (actual)</figcaption>
          ${imgTag(actualB64, "actual")}
        </figure>
        <figure>
          <figcaption>Pixel diff</figcaption>
          ${imgTag(diffB64, "diff")}
        </figure>
      </div>
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visual Diff Report — ${timestamp}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      padding: 2rem;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid #334155;
      padding-bottom: 1rem;
    }
    header h1 { font-size: 1.5rem; color: #f1f5f9; }
    header p { color: #94a3b8; font-size: 0.875rem; margin-top: 0.25rem; }
    .summary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #7f1d1d;
      color: #fecaca;
      border: 1px solid #991b1b;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 2rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .card h2 {
      font-size: 1.125rem;
      color: #f8fafc;
      margin-bottom: 0.25rem;
    }
    .path {
      font-family: monospace;
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 1rem;
    }
    .images {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    figure {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    figcaption {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
    }
    img {
      width: 100%;
      border-radius: 0.25rem;
      border: 1px solid #334155;
      display: block;
    }
    .missing {
      background: #1e293b;
      border: 1px dashed #334155;
      border-radius: 0.25rem;
      padding: 1rem;
      color: #64748b;
      font-size: 0.875rem;
      text-align: center;
    }
    .no-diffs {
      text-align: center;
      color: #4ade80;
      font-size: 1.25rem;
      padding: 4rem 0;
    }
  </style>
</head>
<body>
  <header>
    <h1>Visual Diff Report</h1>
    <p>Generated at ${timestamp}</p>
  </header>

  ${
    entries.length === 0
      ? `<div class="no-diffs">No visual differences detected — all components match their baselines.</div>`
      : `<div class="summary">&#9888; ${entries.length} component${entries.length === 1 ? "" : "s"} changed</div>`
  }

  ${cards}
</body>
</html>`;
}

function main() {
  const diffs = collectDiffs();

  if (diffs.length === 0) {
    console.log("[visual-diff-report] No diff images found — all tests passed.");
    process.exit(0);
  }

  console.log(
    `[visual-diff-report] ${diffs.length} component${diffs.length === 1 ? "" : "s"} with visual changes:`
  );
  for (const d of diffs) {
    console.log(`  - ${d.component}`);
  }

  const html = generateHtml(diffs);
  writeFileSync(REPORT_PATH, html, "utf8");

  const relReport = relative(WORKSPACE_ROOT, REPORT_PATH);
  console.log(`[visual-diff-report] Report written to: ${relReport}`);
}

main();
