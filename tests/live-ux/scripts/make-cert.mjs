/**
 * Generate a self-signed cert for 127.0.0.1 (harness HTTPS origins).
 * Reused by server.mjs on boot (idempotent: only writes when missing).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const CERT_DIR = join(here, "..", "certs");
export const CERT_FILE = join(CERT_DIR, "cert.pem");
export const KEY_FILE = join(CERT_DIR, "key.pem");

export function ensureCert() {
  if (existsSync(CERT_FILE) && existsSync(KEY_FILE)) return;
  mkdirSync(CERT_DIR, { recursive: true });
  execFileSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", KEY_FILE,
      "-out", CERT_FILE,
      "-days", "3650",
      "-subj", "/CN=127.0.0.1",
      "-addext", "subjectAltName=IP:127.0.0.1,DNS:127.0.0.1,DNS:localhost",
    ],
    { stdio: "inherit" },
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ensureCert();
  console.log("cert ready:", CERT_FILE);
}
