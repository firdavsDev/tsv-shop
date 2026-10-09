import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time compare for shared secrets. An empty secret never matches (unset env ≠ open door). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length > 0 && ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** We never store raw IPs: a salted hash is enough to rate-limit. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
