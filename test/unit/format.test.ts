import { describe, expect, it } from "vitest";
import { formatNumber, formatPhone, formatPrice } from "@/lib/format";
import { imageUrl, objectPath } from "@/lib/images";
import { pick, pickOptional } from "@/lib/localize";

const NBSP = " ";

describe("format", () => {
  it("groups thousands with a no-break space", () => {
    expect(formatNumber(489000)).toBe(`489${NBSP}000`);
    expect(formatNumber(1250000)).toBe(`1${NBSP}250${NBSP}000`);
    expect(formatNumber(900)).toBe("900");
  });
  it("adds the currency per locale", () => {
    expect(formatPrice(489000, "ru")).toBe(`489${NBSP}000${NBSP}сум`);
    expect(formatPrice(489000, "uz")).toBe(`489${NBSP}000${NBSP}soʻm`);
  });
  it("pretty-prints phones", () => {
    expect(formatPhone("+998901234567")).toBe("+998 90 123 45 67");
    expect(formatPhone("weird")).toBe("weird");
  });
});

describe("localize", () => {
  it("falls back to Russian when Uzbek is empty", () => {
    expect(pick("uz", "Платье", "Koʻylak")).toBe("Koʻylak");
    expect(pick("uz", "Платье", null)).toBe("Платье");
    expect(pick("uz", "Платье", "  ")).toBe("Платье");
    expect(pick("ru", "Платье", "Koʻylak")).toBe("Платье");
    expect(pickOptional("uz", null, null)).toBeNull();
  });
});

describe("images", () => {
  it("builds public storage URLs", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co/";
    expect(objectPath("dress/k1-1", 480)).toBe("dress/k1-1-480.webp");
    expect(imageUrl("dress/k1-1", 1200)).toBe(
      "https://abc.supabase.co/storage/v1/object/public/products/dress/k1-1-1200.webp",
    );
  });

  it("can serve photos from another base (a CDN, or same-origin when tunnelling a demo)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    try {
      process.env.NEXT_PUBLIC_IMAGE_BASE_URL = "https://cdn.example.com/";
      expect(imageUrl("a/b-1", 480)).toBe("https://cdn.example.com/storage/v1/object/public/products/a/b-1-480.webp");
      process.env.NEXT_PUBLIC_IMAGE_BASE_URL = ""; // empty = same origin as the page
      expect(imageUrl("a/b-1", 480)).toBe("/storage/v1/object/public/products/a/b-1-480.webp");
    } finally {
      delete process.env.NEXT_PUBLIC_IMAGE_BASE_URL;
    }
  });
});
