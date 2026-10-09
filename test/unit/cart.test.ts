import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addLine, cartTotal, countItems, lineKey, parseStored, removeLine, setLineQty, type CartLine,
} from "@/lib/cart";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  productId: "p1",
  slug: "dress",
  size: "M",
  colorId: "c1",
  qty: 1,
  snapshot: { title_ru: "Платье", title_uz: null, price: 100000, image: null, color_ru: "Чёрный", color_uz: "Qora" },
  ...over,
});

describe("cart operations", () => {
  it("merges the same product+size+colour and clamps qty to 10", () => {
    let lines = addLine([], line());
    lines = addLine(lines, line({ qty: 4 }));
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(5);
    lines = addLine(lines, line({ qty: 9 }));
    expect(lines[0].qty).toBe(10);
  });

  it("keeps different sizes/colours as separate lines", () => {
    const lines = addLine(addLine([], line()), line({ size: "L" }));
    expect(lines).toHaveLength(2);
    expect(countItems(lines)).toBe(2);
    expect(cartTotal(lines)).toBe(200000);
  });

  it("setLineQty updates or removes", () => {
    const lines = addLine([], line());
    const key = lineKey(lines[0]);
    expect(setLineQty(lines, key, 3)[0].qty).toBe(3);
    expect(setLineQty(lines, key, 0)).toEqual([]);
    expect(removeLine(lines, key)).toEqual([]);
  });

  it("ignores garbage in storage", () => {
    expect(parseStored(null)).toEqual([]);
    expect(parseStored("not json")).toEqual([]);
    expect(parseStored('{"a":1}')).toEqual([]);
    expect(parseStored(JSON.stringify([line(), { productId: 1 }, { ...line(), qty: -2 }]))).toHaveLength(1);
  });
});

describe("cart store (Review Focus #4: blocked storage)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps working in memory when localStorage throws", async () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal("localStorage", throwing);
    const { cart } = await import("@/lib/cart");
    expect(cart.get()).toEqual([]);
    cart.add(line());
    cart.add(line());
    expect(cart.get()[0].qty).toBe(2);
    cart.clear();
    expect(cart.get()).toEqual([]);
  });

  it("notifies subscribers on change", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    const { cart, CART_KEY } = await import("@/lib/cart");
    const cb = vi.fn();
    const off = cart.subscribe(cb);
    cart.add(line());
    expect(cb).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(CART_KEY)!)).toHaveLength(1);
    off();
  });
});
