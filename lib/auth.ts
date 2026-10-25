// Password hashing (scrypt) and signed session tokens (HMAC-SHA256), using only Node's crypto.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const b64u = (b: Buffer) => b.toString("base64url");

export function signSession(userId: string, secret: string, ttlSeconds = 60 * 60 * 24 * 7, now = Date.now()): string {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const payload = b64u(Buffer.from(JSON.stringify({ uid: userId, exp: Math.floor(now / 1000) + ttlSeconds })));
  const sig = b64u(createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || secret.length < 32) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof uid !== "string" || typeof exp !== "number" || exp * 1000 < now) return null;
    return uid;
  } catch {
    return null;
  }
}

/** Tiny in-memory sliding-window limiter (single-process; use Redis in production). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private max: number;
  private windowMs: number;
  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }
  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return "Password must contain letters and a number.";
  return null;
}
