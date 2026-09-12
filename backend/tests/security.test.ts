import { describe, expect, it } from 'vitest';
import {
  createRecoveryCodes,
  decryptMfaSecret,
  encryptMfaSecret,
  hashPassword,
  verifyPassword,
  verifyTotp,
} from '../src/modules/identity/security.js';

describe('password security', () => {
  it('stores an Argon2id hash that verifies without storing the password', async () => {
    const password = 'correct horse battery staple';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false);
  });

  it('verifies RFC 6238-compatible TOTP codes with clock skew tolerance', () => {
    expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000)).toBe(true);
    expect(verifyTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '000000', 59_000)).toBe(false);
  });

  it('encrypts MFA secrets and creates one-time-format recovery codes', () => {
    const encrypted = encryptMfaSecret('TESTSECRET123');
    expect(decryptMfaSecret(encrypted)).toBe('TESTSECRET123');
    const codes = createRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-F0-9]{5}-[A-F0-9]{5}$/.test(code))).toBe(true);
  });
});
