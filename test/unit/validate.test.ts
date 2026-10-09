import { describe, expect, it } from "vitest";
import { clientKeyOf, isHoneypotFilled, orderSignature, productIdsOf, toOrderItems, validateOrder } from "@/lib/order/validate";
import type { Color, Product } from "@/lib/types";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const color = (id: string, name_ru: string): Color => ({ id, name_ru, name_uz: null, hex: "#000000" });
const product = (over: Partial<Product> = {}): Product => ({
  id: ID,
  slug: "dress",
  created_at: "2026-10-01T00:00:00Z",
  title_ru: "Платье",
  title_uz: null,
  description_ru: null,
  description_uz: null,
  price: 489000,
  old_price: null,
  category: { slug: "platya", name_ru: "Платья", name_uz: null },
  sizes: ["S", "M", "XL"],
  sold_out_sizes: ["XL"],
  in_stock: true,
  images: [],
  colors: [color("c-black", "Чёрный"), color("c-cream", "Молочный")],
  is_new: false,
  ...over,
});
const catalog = (...ps: Product[]) => new Map(ps.map((p) => [p.id, p]));
const item = (over: Record<string, unknown> = {}) => ({ productId: ID, size: "M", colorId: "c-black", qty: 1, ...over });

describe("validateOrder", () => {
  it("prices from the catalog, never from the client", () => {
    const r = validateOrder(
      { phone: "90 123 45 67", items: [item({ qty: 2, price: 1 })], name: "  Дилноза ", locale: "uz" },
      catalog(product()),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.phone).toBe("+998901234567");
    expect(r.order.name).toBe("Дилноза");
    expect(r.order.comment).toBeNull();
    expect(r.order.locale).toBe("uz");
    expect(r.order.total).toBe(978000);
    expect(r.order.lines[0]).toMatchObject({ size: "M", qty: 2, lineTotal: 978000 });
    expect(r.order.lines[0].color?.name_ru).toBe("Чёрный");
  });

  it.each([
    [{ phone: "123" }, "phone", undefined],
    [{ items: [] }, "empty_cart", undefined],
    [{ items: "nope" }, "empty_cart", undefined],
    [{ items: Array.from({ length: 31 }, () => item()) }, "too_many_items", undefined],
    [{ items: [item(), item({ productId: ID2 })] }, "unavailable_item", 1],
    [{ items: [item({ size: "XL" })] }, "size_sold_out", 0],
    [{ items: [item({ size: null })] }, "size_required", 0],
    [{ items: [item({ size: "XXL" })] }, "size_required", 0],
    [{ items: [item({ colorId: "c-red" })] }, "color_required", 0],
    [{ items: [item({ qty: 0 })] }, "bad_qty", 0],
    [{ items: [item({ qty: 11 })] }, "bad_qty", 0],
    [{ items: [item({ qty: 1.5 })] }, "bad_qty", 0],
  ])("rejects %j with %s", (patch, code, lineIndex) => {
    const r = validateOrder({ phone: "901234567", items: [item()], ...patch }, catalog(product()));
    expect(r).toEqual({ ok: false, code, ...(lineIndex === undefined ? {} : { lineIndex }) });
  });

  it("rejects products that went out of stock", () => {
    const r = validateOrder({ phone: "901234567", items: [item()] }, catalog(product({ in_stock: false })));
    expect(r).toEqual({ ok: false, code: "unavailable_item", lineIndex: 0 });
  });

  it("accepts products without sizes or colours", () => {
    const r = validateOrder(
      { phone: "901234567", items: [{ productId: ID, qty: 1 }] },
      catalog(product({ sizes: [], sold_out_sizes: [], colors: [] })),
    );
    expect(r.ok && r.order.lines[0]).toMatchObject({ size: null, color: null });
  });

  it("caps name/comment length and defaults the locale to ru", () => {
    const r = validateOrder(
      { phone: "901234567", items: [item()], name: "x".repeat(100), comment: "y".repeat(900), locale: "en" },
      catalog(product()),
    );
    expect(r.ok && r.order.name!.length).toBe(60);
    expect(r.ok && r.order.comment!.length).toBe(500);
    expect(r.ok && r.order.locale).toBe("ru");
  });
});

describe("helpers", () => {
  it("collects only UUID product ids, de-duplicated", () => {
    expect(productIdsOf([item(), item(), { productId: "x' or 1=1" }, null, { productId: ID2 }])).toEqual([ID, ID2]);
    expect(productIdsOf("nope")).toEqual([]);
  });
  it("accepts only well-formed idempotency keys", () => {
    expect(clientKeyOf({ clientKey: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b" })).toBe("3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b");
    expect(clientKeyOf({ clientKey: "short" })).toBeNull();
    expect(clientKeyOf({ clientKey: "x".repeat(65) })).toBeNull();
    expect(clientKeyOf({ clientKey: "bad key; drop" })).toBeNull();
    expect(clientKeyOf({ clientKey: 42 })).toBeNull();
    expect(clientKeyOf({})).toBeNull();
  });
  it("detects the honeypot", () => {
    expect(isHoneypotFilled({ website: "http://spam" })).toBe(true);
    expect(isHoneypotFilled({ website: "  " })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
  });
  it("snapshots items and builds a stable signature", () => {
    const r = validateOrder({ phone: "901234567", items: [item({ qty: 2 })] }, catalog(product()));
    if (!r.ok) throw new Error("expected ok");
    const items = toOrderItems(r.order.lines);
    expect(items[0]).toEqual({
      product_id: ID, slug: "dress", title_ru: "Платье", title_uz: null, size: "M", color_ru: "Чёрный", color_uz: null,
      qty: 2, unit_price: 489000, line_total: 978000,
    });
    expect(orderSignature(items)).toBe(`${ID}|M|Чёрный|2`);
  });
});
