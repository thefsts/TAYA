/**
 * @convex/_generated/api shim for the live-UX parent bundle.
 *
 * The generated api module in production is `anyApi` — a Proxy that turns
 * property chains into references. Our harness shim turns them into dot
 * strings ("editorZones.addBlock") that the convex/react shim passes to
 * the dispatcher (/harness/api) as the `path` field.
 */
import { makeApiPath } from "./convex-react";
export const api = makeApiPath("api") as any;
export const internal = makeApiPath("api") as any;
export const components = makeApiPath("api") as any;
