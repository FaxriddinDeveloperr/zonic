// Replacement for WEBASE.Utility.CustomPaswordHasher + HashHelper.CreateRandomSalt.
//
// ⚠️ The original hashing algorithm lives in the closed-source WEBASE package, so its
// exact bytes cannot be reproduced. This is SELF-CONSISTENT (register → login works),
// but users hashed by the original .NET system must re-register to log in.
//
// Scheme: PBKDF2-HMAC-SHA256, 100k iterations, 32-byte key, salt+hash stored as base64.
import * as crypto from 'crypto';

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const DIGEST = 'sha256';

export function createRandomSalt(): string {
  return crypto.randomBytes(16).toString('base64');
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('base64');
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashPassword(password, salt));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
