// Stub for @workspace/web-bridge — only needed at test time.
// Mirrors the export surface actually consumed by the dashboard
// (generateBridgeSnippet in VerificationPanel.tsx). Tests that need the real
// snippet logic live in tests/convex-unit (web-bridge-contract.test.ts),
// which imports the real lib directly.
export const generateBridgeSnippet = (): string => "";
export default { generateBridgeSnippet };
