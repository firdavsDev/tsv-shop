import { useSyncExternalStore } from "react";

/** Display-only copy of product data. The server always re-prices from the database. */
export type CartSnapshot = {
  title_ru: string;
  title_uz: string | null;
  price: number;
  image: string | null;
  color_ru: string | null;
  color_uz: string | null;
};

export type CartLine = {
  productId: string;
  slug: string;
  size: string | null;
  colorId: string | null;
  qty: number;
  snapshot: CartSnapshot;
};

export const MAX_QTY = 10;
export const CART_KEY = "tsv-cart-v1";

const clampQty = (q: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(q)));

export const lineKey = (l: Pick<CartLine, "productId" | "size" | "colorId">) =>
  `${l.productId}|${l.size ?? ""}|${l.colorId ?? ""}`;

export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  const i = lines.findIndex((l) => lineKey(l) === key);
  if (i === -1) return [...lines, { ...line, qty: clampQty(line.qty) }];
  return lines.map((l, j) => (j === i ? { ...l, qty: clampQty(l.qty + line.qty), snapshot: line.snapshot } : l));
}

export function setLineQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  if (qty <= 0) return removeLine(lines, key);
  return lines.map((l) => (lineKey(l) === key ? { ...l, qty: clampQty(qty) } : l));
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => lineKey(l) !== key);
}

export const countItems = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty, 0);
export const cartTotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty * l.snapshot.price, 0);

function isLine(v: unknown): v is CartLine {
  const l = v as CartLine;
  return (
    !!l &&
    typeof l.productId === "string" &&
    typeof l.slug === "string" &&
    Number.isInteger(l.qty) &&
    l.qty > 0 &&
    !!l.snapshot &&
    typeof l.snapshot.price === "number" &&
    typeof l.snapshot.title_ru === "string"
  );
}

export function parseStored(raw: string | null): CartLine[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter(isLine).map((l) => ({ ...l, qty: clampQty(l.qty) })) : [];
  } catch {
    return [];
  }
}

// ---- Store: one in-memory copy, mirrored to localStorage when it is available. ----

let memory: CartLine[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      memory = parseStored(localStorage.getItem(CART_KEY));
    } catch {
      memory = []; // storage blocked (private mode, policy): keep the cart in memory for this visit
    }
  }
  return memory;
}

function write(next: CartLine[]) {
  memory = next;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  } catch {
    // ignore: in-memory cart still works
  }
  listeners.forEach((l) => l());
}

export const cart = {
  get: read,
  add: (line: CartLine) => write(addLine(read(), line)),
  setQty: (key: string, qty: number) => write(setLineQty(read(), key, qty)),
  remove: (key: string) => write(removeLine(read(), key)),
  clear: () => write([]),
  subscribe(cb: () => void) {
    listeners.add(cb);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CART_KEY) return;
      memory = parseStored(e.newValue); // another tab changed the cart
      cb();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", onStorage);
    };
  },
};

const EMPTY: CartLine[] = [];

/** Cart lines for client components. Empty during SSR, real lines after hydration. */
export function useCart(): CartLine[] {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}

const noSubscribe = () => () => {};

/** False during SSR and hydration, true once the browser cart is readable (avoids an "empty cart" flash). */
export function useCartReady(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
