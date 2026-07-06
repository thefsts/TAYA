---
name: Vercel serverless functions enforce Node16/NodeNext ESM import extensions
description: Why a TypeScript Express app that builds fine locally (esbuild, moduleResolution "bundler") fails to type-check when Vercel compiles it directly as a serverless function entry
---

## The problem
A repo whose own tsconfig uses `moduleResolution: "bundler"` (extensionless relative
imports allowed, e.g. `import x from "./foo"`) can build and typecheck perfectly inside
the monorepo, yet still fail on Vercel with errors like:

```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
when '--moduleResolution' is 'node16' or 'nodenext'.
```

This happens when a Vercel serverless function (e.g. `api/[...path].ts`) imports the raw
`.ts` source of an app that lives outside any tsconfig Vercel's own function compiler can
see. Vercel's zero-config Node.js function builder defaults to strict Node16/NodeNext ESM
rules (especially once `package.json` has `"type": "module"`), which is stricter than
whatever tsconfig governs local development.

## The fix
Don't let Vercel's function compiler process the app's raw multi-file TS source at all.
Instead, point the serverless function's `import` at an **already-bundled** `.mjs` output
(e.g. a second esbuild entry point that bundles `src/app.ts` — same bundler used for the
existing standalone-server build, just a different entry point without the `app.listen()`
side effect) and add that build step to `vercel.json`'s `buildCommand` before the frontend
build. The function file then only imports a single flat JS file with an explicit
extension, so Vercel's stricter resolution rules never see the internal extensionless
imports.

**Why:** Discovered porting an Express+esbuild monorepo app to Vercel as a serverless
function — the app had always been designed to ship as a bundled esbuild output, never as
raw TS compiled directly by a third-party toolchain with different resolution defaults.
**How to apply:** Whenever wrapping an existing bundler-built Node app as a Vercel
serverless function, always import the bundled output, never the raw source tree.
