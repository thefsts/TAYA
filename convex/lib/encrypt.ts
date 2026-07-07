const KEY_BYTES = 32;

async function getKey(): Promise<CryptoKey> {
  const envKey = process.env.CRM_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "CRM_ENCRYPTION_KEY environment variable is not set. " +
      "Set a 32+ character random string in the Convex dashboard environment variables " +
      "before storing any CRM credentials.",
    );
  }
  const raw = new Uint8Array(KEY_BYTES);
  const encoded = new TextEncoder().encode(envKey);
  raw.set(encoded.slice(0, KEY_BYTES));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptField(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(12 + cipherBuf.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipherBuf), 12);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptField(ciphertext: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}
