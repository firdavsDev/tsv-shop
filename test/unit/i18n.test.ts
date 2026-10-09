import { describe, expect, it } from "vitest";
import { getDict, isLocale } from "@/i18n";
import { pluralRu } from "@/i18n/plural";
import { ru } from "@/i18n/ru";
import { uz } from "@/i18n/uz";

function shape(v: unknown): unknown {
  if (typeof v === "function") return "fn";
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, x]) => [k, shape(x)]),
    );
  }
  return typeof v;
}

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("i18n", () => {
  it("uz has exactly the same keys and shapes as ru", () => {
    expect(shape(uz)).toEqual(shape(ru));
  });
  it("has no empty strings", () => {
    for (const s of [...strings(ru), ...strings(uz)]) expect(s.trim()).not.toBe("");
  });
  it("uses ʻ (U+02BB) in Uzbek, never a plain apostrophe after o/g", () => {
    for (const s of strings(uz)) expect(s).not.toMatch(/[oOgG]['’‘]/);
  });
  it("recognises locales", () => {
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("uz")).toBe(true);
    expect(isLocale("en")).toBe(false);
    expect(getDict("uz").cart.title).toBe("Savat");
  });
  it("pluralises Russian", () => {
    const f: [string, string, string] = ["товар", "товара", "товаров"];
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => pluralRu(n, f))).toEqual([
      "товар", "товара", "товаров", "товаров", "товаров", "товар", "товара", "товаров", "товаров",
    ]);
    expect(ru.catalog.count(3)).toBe("3 товара");
    expect(uz.catalog.count(3)).toBe("3 ta mahsulot");
  });
});
