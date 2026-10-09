import type { Locale } from "@/i18n";
import { normalizeUzPhone } from "@/lib/phone";
import type { Color, OrderItem, Product } from "@/lib/types";

export type OrderErrorCode =
  | "phone"
  | "empty_cart"
  | "too_many_items"
  | "unavailable_item"
  | "size_required"
  | "size_sold_out"
  | "color_required"
  | "bad_qty";

/** Exactly what the browser sends. Untrusted. */
export type RawOrderInput = {
  items?: unknown;
  phone?: unknown;
  name?: unknown;
  comment?: unknown;
  locale?: unknown;
  website?: unknown; // honeypot
  initData?: unknown; // Telegram Mini App
  clientKey?: unknown; // idempotency key, one per checkout attempt
};

export type PricedLine = { product: Product; size: string | null; color: Color | null; qty: number; lineTotal: number };
export type ValidOrder = { phone: string; name: string | null; comment: string | null; locale: Locale; lines: PricedLine[]; total: number };
export type ValidationResult = { ok: true; order: ValidOrder } | { ok: false; code: OrderErrorCode; lineIndex?: number };

export const MAX_LINES = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

/** Idempotency key from the cart page: same key → same order, however many times it is sent. */
export function clientKeyOf(input: RawOrderInput): string | null {
  return typeof input.clientKey === "string" && /^[A-Za-z0-9-]{8,64}$/.test(input.clientKey) ? input.clientKey : null;
}

export function isHoneypotFilled(input: RawOrderInput): boolean {
  return typeof input.website === "string" && input.website.trim() !== "";
}

/** Product ids worth looking up: valid UUIDs only (anything else can't exist), de-duplicated. */
export function productIdsOf(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const ids = new Set<string>();
  for (const raw of items.slice(0, MAX_LINES)) {
    const id = (raw as Record<string, unknown> | null)?.productId;
    if (typeof id === "string" && UUID_RE.test(id)) ids.add(id);
  }
  return [...ids];
}

/** Validate and price an order. Prices come from `products` (the database), never from the client. */
export function validateOrder(input: RawOrderInput, products: ReadonlyMap<string, Product>): ValidationResult {
  const phone = normalizeUzPhone(typeof input.phone === "string" ? input.phone : "");
  if (!phone) return { ok: false, code: "phone" };
  if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false, code: "empty_cart" };
  if (input.items.length > MAX_LINES) return { ok: false, code: "too_many_items" };

  const lines: PricedLine[] = [];
  for (const [i, raw] of input.items.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const product = typeof r.productId === "string" ? products.get(r.productId) : undefined;
    if (!product || !product.in_stock) return { ok: false, code: "unavailable_item", lineIndex: i };

    const qty = r.qty;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > 10) {
      return { ok: false, code: "bad_qty", lineIndex: i };
    }

    let size: string | null = null;
    if (product.sizes.length > 0) {
      if (typeof r.size !== "string" || !product.sizes.includes(r.size)) return { ok: false, code: "size_required", lineIndex: i };
      if (product.sold_out_sizes.includes(r.size)) return { ok: false, code: "size_sold_out", lineIndex: i };
      size = r.size;
    }

    let color: Color | null = null;
    if (product.colors.length > 0) {
      color = product.colors.find((c) => c.id === r.colorId) ?? null;
      if (!color) return { ok: false, code: "color_required", lineIndex: i };
    }

    lines.push({ product, size, color, qty, lineTotal: product.price * qty });
  }

  return {
    ok: true,
    order: {
      phone,
      name: text(input.name, 60),
      comment: text(input.comment, 500),
      locale: input.locale === "uz" ? "uz" : "ru",
      lines,
      total: lines.reduce((s, l) => s + l.lineTotal, 0),
    },
  };
}

/** Frozen copy of the lines for the orders table. */
export function toOrderItems(lines: PricedLine[]): OrderItem[] {
  return lines.map((l) => ({
    product_id: l.product.id,
    slug: l.product.slug,
    title_ru: l.product.title_ru,
    title_uz: l.product.title_uz,
    size: l.size,
    color_ru: l.color?.name_ru ?? null,
    color_uz: l.color?.name_uz ?? null,
    qty: l.qty,
    unit_price: l.product.price,
    line_total: l.lineTotal,
  }));
}

/** Same products/sizes/colours/qty → same signature. Used to spot a double-submitted order. */
export function orderSignature(items: Pick<OrderItem, "product_id" | "size" | "color_ru" | "qty">[]): string {
  return items.map((i) => `${i.product_id}|${i.size ?? ""}|${i.color_ru ?? ""}|${i.qty}`).join(",");
}
