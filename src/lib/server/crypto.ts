import { createHash } from "node:crypto";
import { getSessionSecret } from "@/lib/server/env";

async function getWebCryptoKey(): Promise<CryptoKey> {
  const raw = createHash("sha256").update(getSessionSecret()).digest();
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getWebCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(combined).toString("base64");
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  const key = await getWebCryptoKey();
  const combined = Buffer.from(ciphertext, "base64");
  const iv = combined.subarray(0, 12);
  const data = combined.subarray(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
