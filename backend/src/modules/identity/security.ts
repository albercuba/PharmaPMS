import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import argon2 from 'argon2';

export const SESSION_COOKIE = 'pharmapms_session';
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(passwordHash: string, password: string) {
  return argon2.verify(passwordHash, password);
}

const MFA_ISSUER = 'PharmaPMS';
const MFA_KEY = createHash('sha256')
  .update(process.env.SESSION_SECRET ?? 'pharmapms-test-mfa-key')
  .digest();

export function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function createOtpAuthUri(email: string, secret: string) {
  return `otpauth://totp/${encodeURIComponent(`${MFA_ISSUER}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(MFA_ISSUER)}&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, code: string, at = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(at / 1000 / 30);
  return [-1, 0, 1].some((offset) =>
    safeEqual(generateTotp(secret, counter + offset), code),
  );
}

export function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MFA_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptMfaSecret(payload: string) {
  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split('.');
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Invalid MFA secret');
  const decipher = createDecipheriv('aes-256-gcm', MFA_KEY, Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function createRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const value = randomBytes(5).toString('hex').toUpperCase();
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}

function generateTotp(secret: string, counter: number) {
  const key = base32Decode(secret);
  const data = Buffer.alloc(8);
  data.writeBigInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(data).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, '0');
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function base32Encode(buffer: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...value.replace(/=+$/, '').toUpperCase()]
    .map((character) => {
      const index = alphabet.indexOf(character);
      if (index < 0) throw new Error('Invalid TOTP secret');
      return index.toString(2).padStart(5, '0');
    })
    .join('');
  const output: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    output.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(output);
}
