import { beforeEach, describe, expect, it } from "vitest";
import { admin, anon, resetOrders } from "./db";

describe("row level security", () => {
  beforeEach(resetOrders);

  it("anon sees published products only", async () => {
    const { data, error } = await anon().from("products").select("slug");
    expect(error).toBeNull();
    const slugs = data!.map((p) => p.slug);
    expect(slugs).toContain("shelkovoe-plate-midi");
    expect(slugs).not.toContain("chernovik-plate");
  });

  it("anon cannot read orders", async () => {
    const { error: insErr } = await admin().from("orders").insert({
      id: "ABCDEF", phone: "+998901234567", locale: "ru", source: "web", items: [], total: 0,
    });
    expect(insErr).toBeNull();
    const { data, error } = await anon().from("orders").select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("anon cannot write anything", async () => {
    const ins = await anon().from("orders").insert({
      id: "BCDEFG", phone: "+998901234567", locale: "ru", source: "web", items: [], total: 0,
    });
    expect(ins.error).not.toBeNull();
    const upd = await anon().from("products").update({ price: 1 }).eq("slug", "bluza-iz-shelka").select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
    const { data } = await admin().from("products").select("price").eq("slug", "bluza-iz-shelka").single();
    expect(data!.price).toBe(275000);
  });

  it("database rejects bad catalog data", async () => {
    const db = admin();
    const { data: cat } = await db.from("categories").select("id").eq("slug", "platya").single();
    const bad = await db.from("products").insert({
      slug: "Bad Slug", title_ru: "x", price: 0, category_id: cat!.id,
    });
    expect(bad.error).not.toBeNull();
    const soldOutNotInSizes = await db.from("products").insert({
      slug: "ok-slug", title_ru: "x", price: 1000, category_id: cat!.id, sizes: ["S"], sold_out_sizes: ["XL"],
    });
    expect(soldOutNotInSizes.error).not.toBeNull();
  });
});
