import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.CRM_CONNECTOR_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("CRM_CONNECTOR_ENCRYPTION_KEY must be set to store CRM connector credentials");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("CRM_CONNECTOR_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex chars)");
  }
  return key;
}

/** Encrypts a plaintext secret to `iv.authTag.ciphertext`, all base64url. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted CRM secret");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

export function last4(secret: string): string {
  return secret.length <= 4 ? secret : secret.slice(-4);
}
