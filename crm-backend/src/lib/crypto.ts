import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getEnv } from "./env";

// AES-256-GCM refresh-token encryption. Key = TOKEN_ENCRYPTION_KEY (32 chars).
// Format: base64(iv):base64(authTag):base64(ciphertext)

export function encryptToken(plaintext: string): string {
  const key = Buffer.from(getEnv().TOKEN_ENCRYPTION_KEY, "utf8");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptToken(payload: string): string {
  const key = Buffer.from(getEnv().TOKEN_ENCRYPTION_KEY, "utf8");
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
