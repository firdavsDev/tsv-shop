const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars: no 0/O/1/I, so it's easy to say on the phone
export const ORDER_ID_RE = /^[2-9A-HJ-NP-Z]{6}$/;

/** "K7Q2M9". 32^6 ≈ 1e9 ids; collisions are retried on insert. 256 % 32 === 0, so no modulo bias. */
export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}
