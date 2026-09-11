/**
 * TLS smoke test: Node fetch must reach a self-signed HTTPS origin when
 * NODE_EXTRA_CA_CERTS points at the harness cert (crawl + frame fetchPage).
 */
import https from "node:https";
import { readFileSync } from "node:fs";
import { ensureCert, CERT_FILE, KEY_FILE } from "./make-cert.mjs";

ensureCert();
const server = https.createServer(
  { key: readFileSync(KEY_FILE), cert: readFileSync(CERT_FILE) },
  (_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<html><body><h1>tls ok</h1></body></html>");
  },
);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const url = `https://127.0.0.1:${port}/`;
try {
  const res = await fetch(url);
  const text = await res.text();
  console.log("status:", res.status, "body-has:", text.includes("tls ok"));
  console.log("SMOKE-TLS-PASS");
} catch (e) {
  console.log("SMOKE-TLS-FAIL:", e?.cause?.code ?? e?.message ?? String(e));
} finally {
  server.close();
}
