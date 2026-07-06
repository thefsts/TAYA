// Import the pre-built esbuild bundle (produced by `pnpm --filter
// @workspace/api-server run build`), not the raw TS source. Vercel's own
// function bundler enforces strict Node16/NodeNext ESM import-extension
// rules when compiling TypeScript directly, which our esbuild-based source
// tree (extensionless relative imports) doesn't follow. Shipping the
// already-bundled JS file avoids that mismatch entirely.
// @ts-expect-error - built at deploy time by the Vercel buildCommand, not present in the repo
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
