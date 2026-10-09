import { describe, expect, it } from "vitest";
import { getCategories, getCategory, getProduct, getProducts, getProductsForOrder } from "@/lib/catalog";
import { admin } from "./db";

describe("catalog", () => {
  it("lists categories in sort order", async () => {
    const cats = await getCategories();
    expect(cats.map((c) => c.slug)).toEqual(["platya", "kostyumy", "bluzy", "bryuki", "verhnyaya-odezhda"]);
    expect(await getCategory("nope")).toBeNull();
  });

  it("hides categories that have no published products", async () => {
    const db = admin();
    await db.from("categories").insert({ slug: "pustaya", name_ru: "Пустая", sort: 99 });
    try {
      expect((await getCategories()).map((c) => c.slug)).not.toContain("pustaya");
      expect(await getCategory("pustaya")).toBeNull();
    } finally {
      await db.from("categories").delete().eq("slug", "pustaya");
    }
  });

  it("lists published products newest first, with colours in order", async () => {
    const products = await getProducts();
    const slugs = products.map((p) => p.slug);
    expect(slugs[0]).toBe("shelkovoe-plate-midi");
    expect(slugs).not.toContain("chernovik-plate");
    // Review Focus #5: a published product with no photos is still listed.
    expect(slugs).toContain("kostyum-trojka-bez-foto");
    const dress = products.find((p) => p.slug === "shelkovoe-plate-midi")!;
    expect(dress.colors.map((c) => c.name_ru)).toEqual(["Чёрный", "Шампань"]);
    expect(dress.category.slug).toBe("platya");
    expect(dress.sold_out_sizes).toEqual(["XL"]);
    expect(dress.is_new).toBe(true); // seeded 1 day ago
    expect(products.find((p) => p.slug === "kostyum-trojka")!.is_new).toBe(false); // 30 days ago
  });

  it("filters by category", async () => {
    const cat = (await getCategory("bryuki"))!;
    const products = await getProducts({ categoryId: cat.id });
    expect(products.map((p) => p.slug).sort()).toEqual(["bryuki-palazzo", "bryuki-so-strelkami"]);
  });

  it("gets one product, hides drafts", async () => {
    expect((await getProduct("bluza-iz-shelka"))?.title_ru).toBe("Блуза из шёлка");
    expect(await getProduct("chernovik-plate")).toBeNull();
    expect(await getProduct("missing")).toBeNull();
  });

  it("reads products for an order, including sold-out ones (validation decides)", async () => {
    const all = await getProducts();
    const ids = all.filter((p) => ["kostyum-trojka", "bluza-iz-shelka"].includes(p.slug)).map((p) => p.id);
    const fresh = await getProductsForOrder(ids);
    expect(fresh).toHaveLength(2);
    expect(fresh.find((p) => p.slug === "kostyum-trojka")!.in_stock).toBe(false);
    expect(await getProductsForOrder([])).toEqual([]);
  });
});
