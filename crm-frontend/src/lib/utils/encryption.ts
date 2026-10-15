import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.warn('WARNING: ENCRYPTION_KEY is not set or not 32 characters long. Encryption might fail.');
}

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) return text; // Fallback for dev if missing
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY) as any, iv as any);
  let encrypted: any = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final() as any] as any[]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  if (!ENCRYPTION_KEY || !text.includes(':')) return text; // Fallback for dev if missing or unencrypted
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY) as any, iv as any);
  let decrypted: any = decipher.update(encryptedText as any);
  decrypted = Buffer.concat([decrypted, decipher.final() as any] as any[]);
  return decrypted.toString();
}
