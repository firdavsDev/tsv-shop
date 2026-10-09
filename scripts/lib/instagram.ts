/**
 * Turn exported Instagram posts (scripts/instagram-export.js format) into product drafts.
 * Pure functions: no network, no database. The import script does the writing.
 */

export type IgImage = { url: string; w: number; h: number; video: boolean };
export type IgPost = { code: string; taken_at: number; type: string; caption: string; images: IgImage[] };

export type ParsedCaption = {
  title: string;
  description: string;
  price: number;
  sizes: string[];
  colors: string[]; // raw colour names as written in the caption
  priceCount: number; // > 1 means several products in one post
};

export type PaletteColor = { name_ru: string; name_uz: string; hex: string };

export type ProductDraft = {
  slug: string;
  title: string;
  description: string;
  price: number;
  sizes: string[];
  colors: PaletteColor[];
  unknownColors: string[];
  category: string;
  created_at: string;
  codes: string[];
  images: { file: string; w: number; h: number; video: boolean }[];
};

export type Skipped = { code: string; reason: string };

/** Store categories for the real catalog (slug → names). Created on import when used. */
export const CATEGORIES = [
  { slug: "korsety-topy", name_ru: "Корсеты и топы", name_uz: "Korset va toplar", sort: 1 },
  { slug: "platya", name_ru: "Платья", name_uz: "Koʻylaklar", sort: 2 },
  { slug: "kostyumy", name_ru: "Костюмы и комплекты", name_uz: "Kostyum va toʻplamlar", sort: 3 },
  { slug: "zhakety", name_ru: "Жакеты и пиджаки", name_uz: "Jaket va pidjaklar", sort: 4 },
  { slug: "bryuki", name_ru: "Брюки и джинсы", name_uz: "Shim va jinsilar", sort: 5 },
  { slug: "verhnyaya-odezhda", name_ru: "Верхняя одежда", name_uz: "Ustki kiyim", sort: 6 },
  { slug: "drugoe", name_ru: "Другое", name_uz: "Boshqa", sort: 7 },
] as const;

const MAX_IMAGES = 8;
const PICTO = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Remove emoji and decoration around a phrase: "✨ Элегантный жакет 🖤" → "Элегантный жакет". */
function clean(s: string): string {
  return s
    .replace(PICTO, "")
    .replace(/^[^\p{L}\p{N}«"(]+/u, "")
    .replace(/[^\p{L}\p{N}).!?»"]+$/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parsePrice(s: string): number | null {
  const digits = s.replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL"];

export function parseSizes(raw: string): string[] {
  if (/стандарт|standard|one\s*size|единый/i.test(raw)) return []; // one size → no size picker
  const head = raw.split(/\s[—–-]\s|\(/)[0];
  const tokens = head.split(/[\s,/;]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  return [...new Set(tokens.filter((t) => /^(XXS|XS|S|M|L|XL|XXL|[2-4]XL|\d{2})$/.test(t)))];
}

function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => (/^\d+$/.test(s) ? 100 + Number(s) : SIZE_ORDER.indexOf(s) === -1 ? 999 : SIZE_ORDER.indexOf(s));
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b));
}

const PALETTE: [string[], PaletteColor][] = [
  [["черный", "black"], { name_ru: "Чёрный", name_uz: "Qora", hex: "#1d1d1d" }],
  [["белый", "white"], { name_ru: "Белый", name_uz: "Oq", hex: "#f7f7f5" }],
  [["айвори", "ivory"], { name_ru: "Айвори", name_uz: "Ayvori", hex: "#f2ece0" }],
  [["молочный", "milky"], { name_ru: "Молочный", name_uz: "Sutrang", hex: "#efe6d6" }],
  [["бежевый", "beige"], { name_ru: "Бежевый", name_uz: "Bej", hex: "#d8c3a5" }],
  [["серый", "grey", "gray"], { name_ru: "Серый", name_uz: "Kulrang", hex: "#8e8d8a" }],
  [["графитовый", "графит", "graphite"], { name_ru: "Графит", name_uz: "Grafit", hex: "#3b3b3d" }],
  [["черно-серый"], { name_ru: "Чёрно-серый", name_uz: "Qora-kulrang", hex: "#4a4a4a" }],
  [["коричневый", "brown"], { name_ru: "Коричневый", name_uz: "Jigarrang", hex: "#6b4a36" }],
  [["оливковый", "olive", "хаки", "khaki"], { name_ru: "Оливковый", name_uz: "Zaytunrang", hex: "#5b5f3a" }],
  [["нежно-розовый", "розовый", "pink"], { name_ru: "Нежно-розовый", name_uz: "Och pushti", hex: "#efc7cf" }],
  [["сливочное масло", "сливочный", "cream"], { name_ru: "Сливочный", name_uz: "Qaymoqrang", hex: "#f3e6b8" }],
  [["бордовый", "burgundy", "винный"], { name_ru: "Бордовый", name_uz: "Toʻq qizil", hex: "#6d1f2f" }],
  [["красный", "red"], { name_ru: "Красный", name_uz: "Qizil", hex: "#b3261e" }],
];

export function colorFor(raw: string): PaletteColor | null {
  const key = clean(raw).toLowerCase().replace(/ё/g, "е").replace(/\s*-\s*/g, "-");
  return PALETTE.find(([names]) => names.includes(key))?.[1] ?? null;
}

function splitColors(line: string): string[] {
  return line
    .split(/[/,;]|\s+и\s+/)
    .map((s) => clean(s))
    .filter(Boolean);
}

/** Lines that are order/delivery boilerplate or structured fields shown elsewhere on the product page. */
const DROP_LINE = /(цена|размер|цвет|direct|директ|доставк|для заказа|@tsv|new collection|stay tuned|coming soon)/i;

export function parseCaption(caption: string): ParsedCaption | null {
  const prices = [...caption.matchAll(/Цена[^\d\n]{0,15}(\d[\d\s.,]*\d)/gi)];
  if (prices.length === 0) return null;
  const price = parsePrice(prices[0][1]);
  if (!price) return null;

  const lines = caption.replace(/\r/g, "").split("\n");
  const firstIdx = lines.findIndex((l) => clean(l) !== "");
  const [titleRaw, ...subtitle] = lines[firstIdx].split(/\s+[—–]\s+/);
  const title = clean(titleRaw).slice(0, 200);

  const sizesLine = /Размер[^:\n]*:\s*([^\n]*)/i.exec(caption)?.[1] ?? "";
  const colorLine = /Цвет[^:\n]*:\s*([^\n]*)/i.exec(caption)?.[1] ?? "";

  const body = lines
    .slice(firstIdx + 1)
    .filter((l) => !DROP_LINE.test(l))
    .map((l) => clean(l))
    .filter((l) => !/^(tashkent|ташкент)$/i.test(l));
  const sub = clean(subtitle.join(" — "));
  if (sub) body.unshift(`${sub.charAt(0).toUpperCase()}${sub.slice(1)}${/[.!?]$/.test(sub) ? "" : "."}`, "");
  const description = body.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);

  return {
    title,
    description,
    price,
    sizes: parseSizes(sizesLine),
    colors: colorLine ? splitColors(colorLine) : [],
    priceCount: prices.length,
  };
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(text: string): string {
  const latin = [...text.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+[^-]*$/, (m) => (latin.length > 60 ? "" : m)) // don't end on a cut word
    .replace(/-+$/, "");
}

const W = "(?:^|[^\\p{L}])"; // word start that works for Cyrillic too
const CATEGORY_RULES: [RegExp, string][] = [
  [new RegExp(`куртк|кожанк|leather jacket|${W}coat|пальто|тренч|пуховик|шуба`, "iu"), "verhnyaya-odezhda"],
  [new RegExp(`${W}set(?:$|[^\\p{L}])|костюм|комплект`, "iu"), "kostyumy"],
  [new RegExp(`корсет|corset|${W}топ|${W}top(?:$|[^\\p{L}])|бюстье`, "iu"), "korsety-topy"],
  [new RegExp(`плать|${W}dress`, "iu"), "platya"],
  [new RegExp(`жакет|пиджак|blazer`, "iu"), "zhakety"],
  [new RegExp(`брюк|джинс|denim|legging|легинс|юбк|шорт`, "iu"), "bryuki"],
];

/** Category from the title (rule order), else the product noun mentioned first in the caption. */
export function guessCategory(title: string, caption: string): string {
  for (const [re, slug] of CATEGORY_RULES) if (re.test(title)) return slug;
  let best: { at: number; slug: string } | null = null;
  for (const [re, slug] of CATEGORY_RULES) {
    const m = re.exec(caption);
    if (m && (!best || m.index < best.at)) best = { at: m.index, slug };
  }
  return best?.slug ?? "drugoe";
}

const keyOf = (title: string, price: number) =>
  `${title.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, "")}|${price}`;

/**
 * One draft per product: posts with the same title and price are the same item (photo post + reel,
 * or the same model in another colour). Photo posts come first, reels' cover frames after.
 */
export function groupPosts(posts: IgPost[]): { products: ProductDraft[]; skipped: Skipped[] } {
  const skipped: Skipped[] = [];
  const groups = new Map<string, { post: IgPost; parsed: ParsedCaption }[]>();

  for (const post of posts) {
    const parsed = parseCaption(post.caption);
    if (!parsed) skipped.push({ code: post.code, reason: "no price in the caption" });
    else if (parsed.priceCount > 1) skipped.push({ code: post.code, reason: "several products in one post" });
    else if (post.images.length === 0) skipped.push({ code: post.code, reason: "no images" });
    else {
      const key = keyOf(parsed.title, parsed.price);
      groups.set(key, [...(groups.get(key) ?? []), { post, parsed }]);
    }
  }

  const drafts = [...groups.values()].map((entries) => {
    const byNewest = [...entries].sort((a, b) => b.post.taken_at - a.post.taken_at);
    const ordered = [...byNewest.filter((e) => e.post.type !== "video"), ...byNewest.filter((e) => e.post.type === "video")];
    const primary = ordered[0];
    const colors: PaletteColor[] = [];
    const unknownColors: string[] = [];
    for (const name of ordered.flatMap((e) => e.parsed.colors)) {
      const c = colorFor(name);
      if (!c) unknownColors.push(name);
      else if (!colors.some((x) => x.name_ru === c.name_ru)) colors.push(c);
    }
    return {
      slug: "",
      title: primary.parsed.title,
      description: primary.parsed.description || (ordered.find((e) => e.parsed.description)?.parsed.description ?? ""),
      price: primary.parsed.price,
      sizes: sortSizes(ordered.flatMap((e) => e.parsed.sizes)),
      colors,
      unknownColors: [...new Set(unknownColors)],
      category: guessCategory(primary.parsed.title, primary.post.caption),
      created_at: new Date(Math.max(...entries.map((e) => e.post.taken_at)) * 1000).toISOString(),
      codes: ordered.map((e) => e.post.code),
      images: ordered
        .flatMap((e) => e.post.images.map((img, i) => ({ file: `${e.post.code}-${i + 1}.jpg`, w: img.w, h: img.h, video: img.video })))
        .slice(0, MAX_IMAGES),
    } satisfies ProductDraft;
  });

  drafts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const used = new Map<string, number>();
  for (const d of drafts) {
    const base = slugify(d.title) || "tovar";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    d.slug = n === 1 ? base : `${base}-${n}`;
  }
  return { products: drafts, skipped };
}
