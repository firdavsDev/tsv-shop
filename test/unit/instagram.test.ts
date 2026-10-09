import { describe, expect, it } from "vitest";
import { chooseFit } from "@/lib/images";
import {
  colorFor,
  groupPosts,
  guessCategory,
  parseCaption,
  parsePrice,
  parseSizes,
  slugify,
  type IgPost,
} from "../../scripts/lib/instagram";

const JACKET = `✨ Элегантный жакет в стиле милитари

Стильная модель с выразительной золотистой фурнитурой и аккуратным приталенным силуэтом.

📏 Размеры: S, M
💰 Цена: 650 000

Прекрасно сочетается как с классическими брюками и юбками, так и с джинсами ✨

Для заказа пишите в Direct 💌`;

const TOP = `🖤 Стильный топ с капюшоном — необычная база на каждый день

Приталенный крой красиво подчёркивает фигуру✨

🖤 Цвет: черный
📏 Размеры: S, M
💰 Цена: 180 000

Для заказа пишите в Direct 💌`;

const LEGGINGS = `PUSH-UP LEGGINGS 🖤

Эластичные легинсы с высокой посадкой.

Размеры: S/M/L
Цена: 280 000 сум

Для заказа — пишите в Direct 💌
Доставка по Ташкенту.`;

const COMBO = `KNIT SET 🩶

Уютный трикотажный комплект.

Размер: Standard
Цена: 420 000 сум

BASIC TOP 🖤🤍

Цвета: чёрный / айвори/ коричневый
Размер: Стандарт
Цена: 100 000 сум`;

describe("parseCaption", () => {
  it("reads title, description, sizes and price; drops the order boilerplate", () => {
    const p = parseCaption(JACKET)!;
    expect(p.title).toBe("Элегантный жакет в стиле милитари");
    expect(p.price).toBe(650000);
    expect(p.sizes).toEqual(["S", "M"]);
    expect(p.colors).toEqual([]);
    expect(p.description).toContain("Стильная модель с выразительной золотистой фурнитурой");
    expect(p.description).toContain("Прекрасно сочетается");
    expect(p.description).not.toMatch(/Цена|Размер|Direct/);
    expect(p.priceCount).toBe(1);
  });

  it("moves the subtitle after the dash into the description and reads colours", () => {
    const p = parseCaption(TOP)!;
    expect(p.title).toBe("Стильный топ с капюшоном");
    expect(p.description.startsWith("Необычная база на каждый день.")).toBe(true);
    expect(p.colors).toEqual(["черный"]);
  });

  it("handles 'Размеры: S/M/L' and 'Цена: 280 000 сум' and delivery lines", () => {
    const p = parseCaption(LEGGINGS)!;
    expect(p.title).toBe("PUSH-UP LEGGINGS");
    expect(p.price).toBe(280000);
    expect(p.sizes).toEqual(["S", "M", "L"]);
    expect(p.description).toBe("Эластичные легинсы с высокой посадкой.");
  });

  it("flags posts with several products and returns null without a price", () => {
    expect(parseCaption(COMBO)!.priceCount).toBe(2);
    expect(parseCaption("TSV — women’s store 🤍\n\nNew collection coming soon…")).toBeNull();
  });
});

describe("field parsers", () => {
  it.each([
    ["650 000", 650000],
    ["650.000", 650000],
    ["280 000 сум", 280000],
  ])("price %s → %d", (s, n) => expect(parsePrice(s)).toBe(n));

  it.each([
    ["S, M", ["S", "M"]],
    ["S / M", ["S", "M"]],
    ["XS / S / M / L", ["XS", "S", "M", "L"]],
    ["42 / 44 / 46 / 48", ["42", "44", "46", "48"]],
    ["L, XL, 2XL — подойдут на S, M, L, XL", ["L", "XL", "2XL"]],
    ["S — тянется", ["S"]],
    ["Standard", []],
    ["стандарт, подходит до L", []],
  ])("sizes %s", (s, out) => expect(parseSizes(s)).toEqual(out));

  it("maps colour names to the palette (Russian and English)", () => {
    expect(colorFor("черный ")).toEqual({ name_ru: "Чёрный", name_uz: "Qora", hex: "#1d1d1d" });
    expect(colorFor("Olive")).toMatchObject({ name_ru: "Оливковый" });
    expect(colorFor("чёрно- серый")).toMatchObject({ name_ru: "Чёрно-серый" });
    expect(colorFor("сливочное масло")).toMatchObject({ name_ru: "Сливочный" });
    expect(colorFor("перламутровый")).toBeNull();
  });

  it("transliterates slugs", () => {
    expect(slugify("Элегантный жакет в стиле милитари")).toBe("elegantnyy-zhaket-v-stile-militari");
    expect(slugify("PUSH-UP LEGGINGS")).toBe("push-up-leggings");
    expect(slugify("Платье maxi")).toBe("plate-maxi");
  });

  it("guesses categories from the title, then the caption", () => {
    expect(guessCategory("LEATHER JACKET", "")).toBe("verhnyaya-odezhda");
    expect(guessCategory("LEATHER SET", "")).toBe("kostyumy");
    expect(guessCategory("Платье-пиджак", "")).toBe("platya");
    expect(guessCategory("Стильный топ с капюшоном", "")).toBe("korsety-topy");
    expect(guessCategory("ICONIC DENIM", "")).toBe("bryuki");
    expect(guessCategory("MODERN CLASSIC", "Элегантный жакет с акцентными плечами")).toBe("zhakety");
    expect(guessCategory("TSV", "")).toBe("drugoe");
  });

  it("letterboxes wide images instead of cutting them", () => {
    expect(chooseFit(1254, 1254)).toBe("contain");
    expect(chooseFit(1295, 1213)).toBe("contain");
    expect(chooseFit(1365, 1820)).toBe("cover");
    expect(chooseFit(720, 1280)).toBe("cover");
  });
});

describe("groupPosts", () => {
  const post = (code: string, caption: string, type: IgPost["type"] = "photo", taken_at = 100): IgPost => ({
    code,
    taken_at,
    type,
    caption,
    images: [{ url: `https://x/${code}`, w: 1365, h: 1820, video: type === "video" }],
  });

  it("merges the same product posted twice (title + price), photos first, newest data wins", () => {
    const grey = TOP.replace("Цвет: черный", "Цвет: серый").replace("Размеры: S, M", "Размеры: L");
    const { products, skipped } = groupPosts([
      post("A", TOP, "photo", 300),
      post("R", TOP, "video", 400),
      post("B", grey, "photo", 200),
      post("C", JACKET, "photo", 100),
      post("X", COMBO, "carousel", 50),
      post("Z", "TSV 🤍", "photo", 10),
    ]);
    expect(products).toHaveLength(2);
    const top = products.find((p) => p.title === "Стильный топ с капюшоном")!;
    expect(top.codes).toEqual(["A", "B", "R"]);
    expect(top.images.map((i) => i.file)).toEqual(["A-1.jpg", "B-1.jpg", "R-1.jpg"]);
    expect(top.sizes).toEqual(["S", "M", "L"]);
    expect(top.colors.map((c) => c.name_ru)).toEqual(["Чёрный", "Серый"]);
    expect(top.slug).toBe("stilnyy-top-s-kapyushonom");
    expect(top.category).toBe("korsety-topy");
    expect(top.created_at).toBe(new Date(400 * 1000).toISOString());
    expect(skipped.map((s) => s.code).sort()).toEqual(["X", "Z"]);
  });

  it("keeps different products with the same title apart and gives them unique slugs", () => {
    const { products } = groupPosts([
      post("A", LEGGINGS),
      post("B", LEGGINGS.replace("280 000", "320 000")),
    ]);
    expect(products.map((p) => p.slug).sort()).toEqual(["push-up-leggings", "push-up-leggings-2"]);
  });
});
