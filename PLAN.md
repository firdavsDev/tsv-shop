# TSV Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task. (The user's global rules forbid subagents, so subagent-driven development is not an option.)
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (RU/UZ) storefront for @tsv.womenstore. Customers add clothes to a cart and leave a phone
number; the order is saved in Supabase and posted to the admins' Telegram group with claim/status buttons. The same
site doubles as a Telegram Mini App.

**Architecture:**
- **Pages and API:** a Next.js 16 App Router app on Netlify Free. Catalog pages are statically generated and
  revalidated by the cache tag `catalog`. API routes handle orders, the Telegram webhook, revalidation and a cron resend.
- **Data:** Supabase Postgres holds the catalog and the orders, with RLS on every table. Pre-resized WebP photos live
  in a public Supabase Storage bucket.
- **Content:** the developer manages products in the Supabase dashboard and uploads photos with a local `sharp` script.

**Tech Stack:**

| Area | Choices |
|---|---|
| App | Next.js 16.3.8, React 19.3, TypeScript 5.9.3, Tailwind CSS 4.3 |
| Fonts | `@fontsource-variable/jost`, `@fontsource-variable/playfair-display` |
| Data | `@supabase/supabase-js` 2.117 |
| Scripts | `sharp` 0.35, `tsx` 4.23 |
| Tests | Vitest 5 |
| Local database | Supabase CLI 2.120 (Docker) |
| Hosting | Netlify (OpenNext adapter, Scheduled Functions) |
| Messaging | Telegram Bot API |

**Spec:** `docs/superpowers/specs/2026-10-08-tsv-shop-design.md`. Read it before starting; this plan argues from it.

## Global Constraints

**Project and process:**
- Project root: `/Users/davronbekdev/Desktop/Programming/women-store/tsv-shop`. Do not touch
  `/Users/davronbekdev/Desktop/Programming/women-store/tsv-store` (the old site).
- **Never run `git commit` or `git push`** (user rule). There is no git repo; scaffold with `--disable-git`. Every
  "Checkpoint" step means: run the listed checks, then continue.
- No subagents, no `Agent`/`Workflow` tools (user rule).

**Language and copy:**
- Locales: `ru` (default) and `uz` (Uzbek Latin; use `ʻ` U+02BB in `oʻ`/`gʻ`). URLs `/ru/...` and `/uz/...`;
  `/` redirects to `/ru` (temporary redirect).
- Admin Telegram messages are always Russian.

**Business rules:**
- Prices are integers in so'm, formatted `489 000 сум` / `489 000 soʻm` with U+00A0 as the separator.
- Phone is stored as `+998XXXXXXXXX`. The input shows a fixed `+998` and accepts 9 local digits.
- Order ids: 6 chars from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`.
- Order statuses: `new` → `calling` → `confirmed` | `cancelled`; `reset` takes `calling` back to `new`.

**Photos:**
- Keys are `<slug>/<version>-<n>`. Variants are `<key>-480.webp` (480×640) and `<key>-1200.webp` (1200×1600).
- Bucket: `products` (public read, writes with the service key only).
- Never use `next/image` optimisation (`images.unoptimized: true`): images are pre-sized, and the optimiser would
  spend Netlify credits.

**Look:**
- Noir chrome `#121110`, gold `#D9BF95`, cream `#EFE8DD`.
- Light content `#FFFFFF`, text `#111111`, image well `#F1F1F0`.
- Dark content `#121110`, text `#EFE8DD`, gold prices.
- Display font Playfair Display (Bodoni Moda has no Cyrillic); UI font Jost.

**Accessibility:**
- Functional text ≥ 12px, tap targets ≥ 44px.
- WCAG AA contrast in both themes; visible focus.

**Security:**
- Secrets only in server env: `SUPABASE_SERVICE_ROLE_KEY`, `TG_BOT_TOKEN`, `TG_WEBHOOK_SECRET`, `REVALIDATE_SECRET`,
  `CRON_SECRET`, `IP_HASH_SALT`. `TG_ADMIN_CHAT_ID` is server-only too.
- All customer text in Telegram HTML is escaped with `escapeHtml`.
- Prices are recomputed on the server from the DB.

**Netlify budget:**
- `revalidateTag(tag, { expire: 0 })` from webhooks (the single-argument form is deprecated in Next 16).
- Catalog reads are tagged via a custom `fetch` passed to supabase-js (`next: { tags: ['catalog'], revalidate: 3600 }`).
  No `cacheComponents`.

## Review Focus

The five failure modes most likely to bite a real customer or admin, which the spec implies but doesn't spell out.
Each one is pinned by a test in the owning task.

1. **Double-tapping "Оформить заказ"** (or a retry after a flaky network) must not create two orders or two Telegram
   messages. The server dedupes identical orders from the same phone within 2 minutes. Pinned in Task 9 (dedupe test),
   with the button disabled while sending in Task 10.
2. **A 30-line order with long titles and a 500-char comment** must still reach Telegram, which rejects texts over
   4096 chars. The message is truncated with a "… и ещё N поз." line. Pinned in Task 8 (`message.test.ts`).
3. **Phone autofill/paste formats** (`+998 (90) 123-45-67`, `998901234567`, `8 90 123 45 67`, the Beeline `99 …` prefix)
   must end up as the right 9 local digits. Pinned in Task 1 (`phone.test.ts`).
4. **Blocked storage** (Safari private mode, storage disabled) must not crash the cart; it keeps working in memory for
   the visit. Pinned in Task 4 (`cart.test.ts`, throwing `localStorage`).
5. **A published product with no photos yet** must render (empty image well, no broken `<img>`, metadata without an
   OG image). Pinned in Task 3 (the catalog test returns it) and checked in Task 7's browser walkthrough with
   `kostyum-trojka-bez-foto`.

## File Map

```
tsv-shop/
  package.json, tsconfig.json, next.config.ts, netlify.toml, postcss.config.mjs, eslint.config.mjs
  vitest.config.ts, vitest.integration.config.ts, .env.example, .gitignore, README.md, PLAN.md
  public/hero.webp                          generated by demo-photos, replaced by the developer
  netlify/functions/resend-orders.mts       scheduled every 15 min → POST /api/cron/resend
  supabase/config.toml                      supabase init
  supabase/migrations/20261008000000_schema.sql
  supabase/seed.sql
  scripts/lib/photos.ts                     sharp variants + upload + revalidate (shared by CLIs)
  scripts/photos.ts                         npm run photos -- <slug> <files...> [--append]
  scripts/demo-photos.ts                    placeholder photos for seed products + public/hero.webp
  scripts/setup-telegram.ts                 webhook, menu button, commands
  src/i18n/{index.ts, ru.ts, uz.ts, plural.ts}
  src/lib/
    site.ts          public config (site url, instagram, bot, phone) + absoluteUrl/telegramBotUrl
    env.ts           server-only env getters
    format.ts        formatNumber/formatPrice/formatPhone
    phone.ts         normalizeUzPhone/maskLocalPhone
    localize.ts      pick/pickOptional
    images.ts        IMAGE_SIZES/objectPath/imageUrl
    types.ts         Category/Color/Product/OrderItem/OrderRow/TgUser
    cache-tags.ts    CATALOG_TAG
    supabase.ts      server-only catalogClient (tagged cache) / serviceClient (no-store)
    catalog.ts       server-only getCategories/getProducts/getProduct/getProductsForOrder
    cart.ts          pure cart ops + localStorage store + useCart
    security.ts      safeEqual/hashIp
    tg-client.ts     browser helpers for Telegram.WebApp
    telegram/{types.ts, escape.ts, init-data.ts, api.ts, webhook.ts}
    order/{id.ts, validate.ts, message.ts, status.ts, service.ts}
  src/components/
    icons.tsx, Wordmark.tsx, Header.tsx, Menu.tsx, LangSwitch.tsx, ThemeToggle.tsx, CartBadge.tsx, CartBar.tsx,
    Footer.tsx, Hero.tsx, CategoryTabs.tsx, ProductGrid.tsx, ProductCard.tsx, Gallery.tsx, ProductBuy.tsx,
    CartView.tsx, PhoneInput.tsx, OrderSuccess.tsx, JsonLd.tsx, TelegramBoot.tsx
  src/app/
    globals.css, icon.svg, sitemap.ts, robots.ts
    [locale]/{layout.tsx, page.tsx, not-found.tsx, c/[slug]/page.tsx, p/[slug]/page.tsx, cart/page.tsx}
    api/order/route.ts, api/telegram/webhook/route.ts, api/revalidate/route.ts, api/cron/resend/route.ts
  test/
    empty.ts                    alias target for 'server-only' in Vitest
    helpers/init-data.ts        signs Telegram initData for tests
    unit/*.test.ts
    integration/{setup.ts, db.ts, tg-stub.ts, *.test.ts}
```

---

### Task 1: Scaffold + shared pure helpers (phone, format, i18n, localize, images, site)

**Files:**
- Create: the project via create-next-app, then `vitest.config.ts`, `vitest.integration.config.ts`, `.env.example`,
  `test/empty.ts`, `src/lib/{phone,format,localize,images,site}.ts`, `src/i18n/{index,ru,uz,plural}.ts`
- Modify: `package.json` (scripts, deps), `.gitignore`, `eslint.config.mjs`, `tsconfig.json` (only if needed)
- Test: `test/unit/phone.test.ts`, `test/unit/format.test.ts`, `test/unit/i18n.test.ts`

**Interfaces:**
- Produces:
  - `normalizeUzPhone(input: string): string | null`
  - `maskLocalPhone(raw: string): string`
  - `formatNumber(n: number): string`
  - `formatPrice(n: number, locale: Locale): string`
  - `formatPhone(e164: string): string`
  - `pick(locale, ru: string, uz?: string | null): string`
  - `pickOptional(locale, ru: string | null, uz: string | null): string | null`
  - `IMAGE_SIZES`, `type ImageSize`, `PHOTO_BUCKET`, `objectPath(key, size)`, `imageUrl(key, size)`
  - `site`, `absoluteUrl(path)`, `telegramBotUrl(start?)`
  - `locales`, `type Locale`, `isLocale(v)`, `getDict(locale)`, `type Dict`, `pluralRu(n, forms)`

- [ ] **Step 1: Scaffold the app** (the folder already holds `docs/`, which create-next-app allows)

```bash
cd /Users/davronbekdev/Desktop/Programming/women-store
npx --yes create-next-app@16.3.8 tsv-shop --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
cd tsv-shop
npm i @supabase/supabase-js@2.117.3 @fontsource-variable/jost@5.3.0 @fontsource-variable/playfair-display@5.3.0 server-only@0.0.1
npm i -D vitest@5.0.3 tsx@4.23.15 sharp@0.35.5 supabase@2.120.0 @netlify/functions@6.0.2 typescript@5.9.3
```

Expected: `tsv-shop/src/app/page.tsx` exists and `npm ls next` shows `16.3.8`. If create-next-app asks any extra
question (React Compiler, AGENTS.md), accept the default.

- [ ] **Step 2: Remove the starter files** that the plan replaces

```bash
rm -f src/app/page.tsx src/app/layout.tsx src/app/favicon.ico public/*.svg
```

- [ ] **Step 3: Set package.json scripts.** Replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:int": "vitest run --config vitest.integration.config.ts",
  "db:start": "supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime",
  "db:reset": "supabase db reset",
  "demo:photos": "node --env-file=.env.local --import tsx scripts/demo-photos.ts",
  "photos": "node --env-file=.env.local --import tsx scripts/photos.ts",
  "setup:telegram": "node --env-file=.env.local --import tsx scripts/setup-telegram.ts"
}
```

- [ ] **Step 4: Test config files**

`vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      // 'server-only' throws outside the React server build; tests run server code directly.
      "server-only": r("./test/empty.ts"),
    },
  },
  test: { include: ["test/unit/**/*.test.ts"], environment: "node" },
});
```

`vitest.integration.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Needs the local Supabase stack: `npm run db:start` (Docker). */
export default defineConfig({
  resolve: { alias: { "@": r("./src"), "server-only": r("./test/empty.ts") } },
  test: {
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["test/integration/setup.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
```

`test/empty.ts`:

```ts
export {};
```

- [ ] **Step 5: `.env.example`, `.gitignore`, ESLint**

`.env.example`:

```bash
# ---- Public (safe in the browser) ----
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Bot username without "@". Empty = no Telegram links on the site.
NEXT_PUBLIC_TG_BOT_USERNAME=
NEXT_PUBLIC_INSTAGRAM_URL=https://www.instagram.com/tsv.womenstore/
# Optional store phone shown in the menu/footer: +998XXXXXXXXX
NEXT_PUBLIC_STORE_PHONE=

# ---- Server-only secrets (never prefix with NEXT_PUBLIC_) ----
SUPABASE_SERVICE_ROLE_KEY=
TG_BOT_TOKEN=
# Admin group id (negative number). Send /chatid in the group after adding the bot.
TG_ADMIN_CHAT_ID=
# openssl rand -hex 32  (each of the four below)
TG_WEBHOOK_SECRET=
REVALIDATE_SECRET=
CRON_SECRET=
IP_HASH_SALT=
```

Append to `.gitignore`:

```
# local tooling
.superpowers/
supabase/.temp/
.env*.local
```

In `eslint.config.mjs`, add a rules entry after the Next presets (keep the generated presets as they are):

```js
  {
    rules: {
      // Photos are pre-resized WebP served from Supabase; next/image optimisation would cost Netlify credits.
      "@next/next/no-img-element": "off",
    },
  },
```

- [ ] **Step 6: Write the failing tests**

`test/unit/phone.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { maskLocalPhone, normalizeUzPhone } from "@/lib/phone";

describe("normalizeUzPhone", () => {
  it.each([
    ["90 123 45 67", "+998901234567"],
    ["901234567", "+998901234567"],
    ["+998 (90) 123-45-67", "+998901234567"],
    ["998901234567", "+998901234567"],
    ["8 90 123 45 67", "+998901234567"],
    ["99 812 34 56", "+998998123456"],
    ["33 555 00 11", "+998335550011"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeUzPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+7 900 123 45 67", "01 234 56 78", "90 123 45 6", "90 123 45 678 9"])("rejects %s", (input) => {
    expect(normalizeUzPhone(input)).toBeNull();
  });
});

describe("maskLocalPhone (Review Focus #3: autofill/paste formats)", () => {
  it.each([
    ["901234567", "90 123 45 67"],
    ["90 123", "90 123"],
    ["+998 (90) 123-45-67", "90 123 45 67"],
    ["998901234567", "90 123 45 67"],
    ["8 90 123 45 67", "90 123 45 67"],
    ["99 812 34 56", "99 812 34 56"],
    ["9012345678999", "90 123 45 67"],
  ])("%s → %s", (raw, expected) => {
    expect(maskLocalPhone(raw)).toBe(expected);
  });

  it("masked value always normalizes", () => {
    expect(normalizeUzPhone(maskLocalPhone("+998 (90) 123-45-67"))).toBe("+998901234567");
  });
});
```

`test/unit/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatNumber, formatPhone, formatPrice } from "@/lib/format";
import { pick, pickOptional } from "@/lib/localize";
import { imageUrl, objectPath } from "@/lib/images";

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
});
```

`test/unit/i18n.test.ts`:

```ts
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
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. The imports can't be resolved yet: `@/lib/phone`, `@/lib/format`, `@/i18n`, and so on.

- [ ] **Step 8: Implement the helpers**

`src/lib/phone.ts`:

```ts
/**
 * Normalize an Uzbek mobile number to E.164 (+998XXXXXXXXX).
 * Accepts what people type or autofill: "90 123 45 67", "+998 (90) 123-45-67", "998901234567", "8 90 123 45 67".
 */
export function normalizeUzPhone(input: string): string | null {
  let digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("8")) digits = digits.slice(1); // old "8 90 …" habit
  if (digits.length === 9) digits = `998${digits}`;
  if (digits.length !== 12 || !digits.startsWith("998")) return null;
  // Operator/area codes start with 2–9 (no 0x/1x codes exist).
  if (!/^[2-9]\d$/.test(digits.slice(3, 5))) return null;
  return `+${digits}`;
}

/**
 * Input mask for the local part (the field shows a fixed "+998"). Renders "90 123 45 67".
 * Only strips a leading 998 when there are more than 9 digits, so Beeline "99 8…" numbers survive.
 */
export function maskLocalPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("998")) d = d.slice(3);
  else if (d.length === 10 && d.startsWith("8")) d = d.slice(1);
  d = d.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}
```

`src/lib/format.ts`:

```ts
import type { Locale } from "@/i18n";

const NBSP = " ";

/** 489000 → "489 000" with no-break spaces, so prices never wrap. */
export function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

export function formatPrice(n: number, locale: Locale): string {
  return `${formatNumber(n)}${NBSP}${locale === "uz" ? "soʻm" : "сум"}`;
}

/** +998901234567 → "+998 90 123 45 67" */
export function formatPhone(e164: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
```

`src/lib/localize.ts`:

```ts
import type { Locale } from "@/i18n";

/** Uzbek text when present, otherwise Russian (Russian is always filled in). */
export function pick(locale: Locale, ru: string, uz?: string | null): string {
  return locale === "uz" && uz?.trim() ? uz : ru;
}

export function pickOptional(locale: Locale, ru: string | null, uz: string | null): string | null {
  return locale === "uz" && uz?.trim() ? uz : ru;
}
```

`src/lib/images.ts`:

```ts
/** Every photo exists in these widths (3:4). 480 → grids and thumbs, 1200 → product page and OG. */
export const IMAGE_SIZES = [480, 1200] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
export const PHOTO_BUCKET = "products";

export function objectPath(key: string, size: ImageSize): string {
  return `${key}-${size}.webp`;
}

/** Public Supabase Storage URL. Photos never go through Netlify, so they cost no Netlify credits. */
export function imageUrl(key: string, size: ImageSize): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${objectPath(key, size)}`;
}
```

`src/lib/site.ts`:

```ts
/** Public site config. Everything here is safe in the browser. */
export const site = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  instagramUrl: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/tsv.womenstore/",
  botUsername: process.env.NEXT_PUBLIC_TG_BOT_USERNAME ?? "",
  phone: process.env.NEXT_PUBLIC_STORE_PHONE ?? "",
};

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** t.me link to the bot, optionally with a /start payload (e.g. "p_<slug>"). Null when no bot is configured. */
export function telegramBotUrl(start?: string): string | null {
  if (!site.botUsername) return null;
  return `https://t.me/${site.botUsername}${start ? `?start=${encodeURIComponent(start)}` : ""}`;
}
```

`src/i18n/plural.ts`:

```ts
/** Russian plural forms: [1 товар, 2 товара, 5 товаров]. */
export function pluralRu(n: number, forms: [one: string, few: string, many: string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}
```

`src/i18n/ru.ts`:

```ts
import { pluralRu } from "./plural";

export const ru = {
  meta: {
    title: "TSV — женская одежда, Ташкент",
    description:
      "Женская одежда TSV в Ташкенте. Выберите вещи, оставьте номер — мы перезвоним и всё подтвердим. Оплата при получении.",
  },
  nav: {
    home: "TSV — на главную",
    menu: "Меню",
    close: "Закрыть",
    cart: "Корзина",
    all: "Все",
    categories: "Категории",
    theme: "Тема",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    toUz: "Oʻzbekcha",
    toRu: "Русский",
    skip: "Перейти к содержимому",
  },
  hero: { kicker: "LIMITED PIECES", title: "Новая коллекция", cta: "Смотреть" },
  catalog: {
    newArrivals: "Новые поступления",
    count: (n: number) => `${n} ${pluralRu(n, ["товар", "товара", "товаров"])}`,
    empty: "Здесь пока пусто. Загляните в наш Instagram.",
    newBadge: "NEW",
    soldOut: "Нет в наличии",
  },
  product: {
    size: "Размер",
    color: "Цвет",
    add: "Добавить в корзину",
    added: "Добавлено ✓",
    chooseSize: "Выберите размер",
    chooseColor: "Выберите цвет",
    soldOut: "Нет в наличии",
    description: "Описание",
    ask: "Есть вопрос? Напишите нам",
    openInTelegram: "Открыть в Telegram",
    photoOf: (i: number, n: number) => `${i} / ${n}`,
    prev: "Предыдущее фото",
    next: "Следующее фото",
  },
  cart: {
    title: "Корзина",
    empty: "Корзина пуста",
    continue: "Продолжить покупки",
    total: "Итого",
    remove: "Удалить",
    qtyDec: "Уменьшить количество",
    qtyInc: "Увеличить количество",
    phone: "Телефон",
    name: "Имя",
    namePlaceholder: "Как к вам обращаться",
    comment: "Комментарий",
    commentPlaceholder: "Удобное время для звонка…",
    note: "Мы позвоним, чтобы подтвердить заказ, размер и доставку. Оплата при получении.",
    submit: "Оформить заказ",
    sending: "Отправляем…",
    bar: "Корзина",
  },
  success: {
    title: "Спасибо!",
    order: "Заказ №",
    callYou: "Мы скоро позвоним на",
    toConfirm: "чтобы подтвердить заказ и доставку.",
    continue: "Продолжить покупки",
    instagram: "Наш Instagram",
  },
  errors: {
    phone: "Введите номер полностью, например: 90 123 45 67",
    empty_cart: "Корзина пуста",
    too_many_items: "Слишком много позиций в корзине",
    unavailable_item: "Этого товара больше нет в наличии — удалите его из корзины",
    size_required: "Выберите размер для этого товара",
    size_sold_out: "Этот размер закончился — удалите товар или выберите другой размер",
    color_required: "Выберите цвет для этого товара",
    bad_qty: "Неверное количество",
    rate_limited: "Слишком много попыток. Попробуйте через 10 минут.",
    unavailable: "Сервис временно недоступен.",
    network: "Не удалось отправить. Проверьте интернет и попробуйте ещё раз.",
    generic: "Что-то пошло не так. Попробуйте ещё раз.",
    fallback: "Или напишите нам:",
  },
  footer: {
    howTitle: "Как заказать",
    how: ["Добавьте вещи в корзину", "Оставьте номер телефона", "Мы перезвоним и подтвердим заказ"],
    rights: "Женская одежда",
    city: "Ташкент",
  },
};

export type Dict = typeof ru;
```

`src/i18n/uz.ts`:

```ts
import type { Dict } from "./ru";

export const uz: Dict = {
  meta: {
    title: "TSV — ayollar kiyimlari, Toshkent",
    description:
      "TSV ayollar kiyimlari, Toshkent. Kiyimlarni tanlang, raqamingizni qoldiring — qoʻngʻiroq qilib, hammasini tasdiqlaymiz. Toʻlov yetkazib berilganda.",
  },
  nav: {
    home: "TSV — bosh sahifa",
    menu: "Menyu",
    close: "Yopish",
    cart: "Savat",
    all: "Hammasi",
    categories: "Toifalar",
    theme: "Mavzu",
    themeLight: "Yorugʻ",
    themeDark: "Qorongʻi",
    toUz: "Oʻzbekcha",
    toRu: "Русский",
    skip: "Asosiy qismga oʻtish",
  },
  hero: { kicker: "LIMITED PIECES", title: "Yangi kolleksiya", cta: "Koʻrish" },
  catalog: {
    newArrivals: "Yangi kelganlar",
    count: (n: number) => `${n} ta mahsulot`,
    empty: "Hozircha boʻsh. Instagram sahifamizga koʻz tashlang.",
    newBadge: "NEW",
    soldOut: "Sotuvda yoʻq",
  },
  product: {
    size: "Oʻlcham",
    color: "Rang",
    add: "Savatga qoʻshish",
    added: "Qoʻshildi ✓",
    chooseSize: "Oʻlchamni tanlang",
    chooseColor: "Rangni tanlang",
    soldOut: "Sotuvda yoʻq",
    description: "Tavsif",
    ask: "Savolingiz bormi? Bizga yozing",
    openInTelegram: "Telegramda ochish",
    photoOf: (i: number, n: number) => `${i} / ${n}`,
    prev: "Oldingi rasm",
    next: "Keyingi rasm",
  },
  cart: {
    title: "Savat",
    empty: "Savat boʻsh",
    continue: "Xaridni davom ettirish",
    total: "Jami",
    remove: "Oʻchirish",
    qtyDec: "Kamaytirish",
    qtyInc: "Koʻpaytirish",
    phone: "Telefon",
    name: "Ism",
    namePlaceholder: "Sizga qanday murojaat qilaylik",
    comment: "Izoh",
    commentPlaceholder: "Qoʻngʻiroq uchun qulay vaqt…",
    note: "Buyurtma, oʻlcham va yetkazib berishni tasdiqlash uchun qoʻngʻiroq qilamiz. Toʻlov yetkazib berilganda.",
    submit: "Buyurtma berish",
    sending: "Yuborilmoqda…",
    bar: "Savat",
  },
  success: {
    title: "Rahmat!",
    order: "Buyurtma №",
    callYou: "Tez orada qoʻngʻiroq qilamiz:",
    toConfirm: "buyurtma va yetkazib berishni tasdiqlash uchun.",
    continue: "Xaridni davom ettirish",
    instagram: "Instagramimiz",
  },
  errors: {
    phone: "Raqamni toʻliq kiriting, masalan: 90 123 45 67",
    empty_cart: "Savat boʻsh",
    too_many_items: "Savatda juda koʻp mahsulot",
    unavailable_item: "Bu mahsulot endi sotuvda yoʻq — uni savatdan oʻchiring",
    size_required: "Bu mahsulot uchun oʻlchamni tanlang",
    size_sold_out: "Bu oʻlcham tugadi — mahsulotni oʻchiring yoki boshqa oʻlcham tanlang",
    color_required: "Bu mahsulot uchun rangni tanlang",
    bad_qty: "Notoʻgʻri miqdor",
    rate_limited: "Juda koʻp urinish. 10 daqiqadan soʻng qayta urinib koʻring.",
    unavailable: "Xizmat vaqtincha ishlamayapti.",
    network: "Yuborib boʻlmadi. Internetni tekshirib, qayta urinib koʻring.",
    generic: "Nimadir xato ketdi. Qayta urinib koʻring.",
    fallback: "Yoki bizga yozing:",
  },
  footer: {
    howTitle: "Qanday buyurtma beriladi",
    how: ["Kiyimlarni savatga qoʻshing", "Telefon raqamingizni qoldiring", "Qoʻngʻiroq qilib, buyurtmani tasdiqlaymiz"],
    rights: "Ayollar kiyimlari",
    city: "Toshkent",
  },
};
```

`src/i18n/index.ts`:

```ts
import { ru, type Dict } from "./ru";
import { uz } from "./uz";

export const locales = ["ru", "uz"] as const;
export type Locale = (typeof locales)[number];
export type { Dict };

export function isLocale(v: string): v is Locale {
  return v === "ru" || v === "uz";
}

const dicts: Record<Locale, Dict> = { ru, uz };

export function getDict(locale: Locale): Dict {
  return dicts[locale];
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (3 files). If the U+02BB test fails, fix the offending string in `uz.ts` (`'` → `ʻ`).

- [ ] **Step 10: Checkpoint**

Run: `npm run typecheck`
Expected: no errors. (`npm run lint` runs in later tasks, once there are app files.) Do not commit.

---

### Task 2: Supabase schema, RLS, seed, local stack

**Files:**
- Create: `supabase/config.toml` (supabase init), `supabase/migrations/20261008000000_schema.sql`, `supabase/seed.sql`,
  `.env.local`, `test/integration/setup.ts`, `test/integration/db.ts`
- Test: `test/integration/rls.test.ts`

**Interfaces:**
- Produces:
  - Tables `categories`, `colors`, `products`, `product_colors`, `orders`, and the public bucket `products`.
  - Seed slugs used by later tests:
    - Products: `shelkovoe-plate-midi` (sizes S–XL, XL sold out, colours Чёрный + Шампань, old price),
      `plate-s-printom`, `bryuki-so-strelkami` (sizes 42–48), `bryuki-palazzo`, `bluza-iz-shelka`,
      `rubashka-oversize` (no sizes, one colour), `trench-klassicheskiy`, `kostyum-trojka` (`in_stock = false`),
      `kostyum-trojka-bez-foto` (published, no photos ever), `chernovik-plate` (unpublished draft).
    - Categories: `platya`, `kostyumy`, `bluzy`, `bryuki`, `verhnyaya-odezhda`.
  - Test helpers `admin()`, `anon()`, `resetOrders()`, `productBySlug(slug)`.

- [ ] **Step 1: Start Docker and initialise Supabase**

```bash
open -a Docker
until docker info >/dev/null 2>&1; do sleep 2; done   # wait for the daemon
cd /Users/davronbekdev/Desktop/Programming/women-store/tsv-shop
npx supabase init   # answer "N" to the VS Code / Deno questions
```

Expected: `supabase/config.toml` exists. Set `project_id = "tsv-shop"` in it.

- [ ] **Step 2: Write the migration** `supabase/migrations/20261008000000_schema.sql`

```sql
-- TSV shop schema. Catalog is public-read (published rows only); orders are server-only.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ru text not null check (length(trim(name_ru)) between 1 and 80),
  name_uz text check (name_uz is null or length(name_uz) <= 80),
  sort int not null default 0
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name_ru text not null check (length(trim(name_ru)) between 1 and 40),
  name_uz text check (name_uz is null or length(name_uz) <= 40),
  hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$')
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  created_at timestamptz not null default now(),
  title_ru text not null check (length(trim(title_ru)) between 1 and 200),
  title_uz text check (title_uz is null or length(title_uz) <= 200),
  description_ru text check (description_ru is null or length(description_ru) <= 4000),
  description_uz text check (description_uz is null or length(description_uz) <= 4000),
  price int not null check (price > 0),
  old_price int check (old_price is null or old_price > price),
  category_id uuid not null references public.categories(id) on delete restrict,
  sizes text[] not null default '{}',
  sold_out_sizes text[] not null default '{}' check (sold_out_sizes <@ sizes),
  in_stock boolean not null default true,
  is_published boolean not null default false,
  images text[] not null default '{}'
);
create index products_listing_idx on public.products (is_published, created_at desc);
create index products_category_idx on public.products (category_id);

create table public.product_colors (
  product_id uuid not null references public.products(id) on delete cascade,
  color_id uuid not null references public.colors(id) on delete restrict,
  sort int not null default 0,
  primary key (product_id, color_id)
);

create table public.orders (
  id text primary key check (id ~ '^[2-9A-HJ-NP-Z]{6}$'),
  created_at timestamptz not null default now(),
  phone text not null check (phone ~ '^\+998[0-9]{9}$'),
  name text check (name is null or length(name) <= 60),
  comment text check (comment is null or length(comment) <= 500),
  locale text not null check (locale in ('ru', 'uz')),
  source text not null check (source in ('web', 'telegram')),
  tg_user jsonb,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total int not null check (total >= 0),
  status text not null default 'new' check (status in ('new', 'calling', 'confirmed', 'cancelled')),
  claimed_by text,
  claimed_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  tg_chat_id bigint,
  tg_message_id bigint,
  notify_attempts int not null default 0,
  notify_error text,
  ip_hash text
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (phone, created_at);
create index orders_ip_idx on public.orders (ip_hash, created_at);
create index orders_unsent_idx on public.orders (created_at) where tg_message_id is null;

-- Row Level Security on every table.
alter table public.categories enable row level security;
alter table public.colors enable row level security;
alter table public.products enable row level security;
alter table public.product_colors enable row level security;
alter table public.orders enable row level security;

create policy "public read categories" on public.categories
  for select to anon, authenticated using (true);
create policy "public read colors" on public.colors
  for select to anon, authenticated using (true);
create policy "public read published products" on public.products
  for select to anon, authenticated using (is_published);
create policy "public read colors of published products" on public.product_colors
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_published));
-- orders: no policies at all → only the service role (which bypasses RLS) can touch it.

-- Explicit grants (don't rely on platform defaults).
revoke all on public.categories, public.colors, public.products, public.product_colors, public.orders
  from anon, authenticated;
grant select on public.categories, public.colors, public.products, public.product_colors to anon, authenticated;
grant all on public.categories, public.colors, public.products, public.product_colors, public.orders to service_role;

-- Product photos: public read, uploads only with the service key. WebP only, ≤ 2 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
```

- [ ] **Step 3: Write the seed** `supabase/seed.sql`

```sql
-- Demo catalog for local development. Photos come from `npm run demo:photos`.
insert into public.categories (slug, name_ru, name_uz, sort) values
  ('platya', 'Платья', 'Koʻylaklar', 1),
  ('kostyumy', 'Костюмы', 'Kostyumlar', 2),
  ('bluzy', 'Блузы и рубашки', 'Bluzka va koʻylakchalar', 3),
  ('bryuki', 'Брюки и юбки', 'Shim va yubkalar', 4),
  ('verhnyaya-odezhda', 'Верхняя одежда', 'Ustki kiyim', 5);

insert into public.colors (name_ru, name_uz, hex) values
  ('Чёрный', 'Qora', '#1d1d1d'),
  ('Белый', 'Oq', '#f7f7f5'),
  ('Молочный', 'Sutrang', '#efe6d6'),
  ('Бежевый', 'Bej', '#d8c3a5'),
  ('Шампань', 'Shampan', '#e7d3b0'),
  ('Графит', 'Grafit', '#3b3b3d');

insert into public.products
  (slug, title_ru, title_uz, description_ru, description_uz, price, old_price, category_id, sizes, sold_out_sizes, in_stock, is_published, created_at)
select v.slug, v.title_ru, v.title_uz, v.description_ru, v.description_uz, v.price, v.old_price,
       (select id from public.categories c where c.slug = v.category),
       v.sizes, v.sold_out, v.in_stock, v.published, now() - (v.age_days || ' days')::interval
from (values
  ('shelkovoe-plate-midi', 'Шёлковое платье миди', 'Ipak midi koʻylak',
   'Струящийся шёлк, длина миди, потайная молния.' || chr(10) || 'Состав: 100% шёлк.', null,
   489000, 590000, 'platya', array['S','M','L','XL'], array['XL'], true, true, 1),
  ('plate-s-printom', 'Платье миди с принтом', 'Naqshli midi koʻylak',
   'Лёгкое платье с цветочным принтом.', 'Gulli naqshli yengil koʻylak.',
   420000, null, 'platya', array['S','M','L'], array[]::text[], true, true, 3),
  ('bryuki-so-strelkami', 'Брюки со стрелками', 'Strelkali shim',
   'Классические брюки, идеальная посадка.', null,
   320000, null, 'bryuki', array['42','44','46','48'], array[]::text[], true, true, 5),
  ('bryuki-palazzo', 'Брюки палаццо', 'Palazzo shim', null, null,
   350000, null, 'bryuki', array['S','M','L'], array[]::text[], true, true, 9),
  ('bluza-iz-shelka', 'Блуза из шёлка', 'Ipak bluzka', 'Мягкий шёлк, свободный крой.', null,
   275000, null, 'bluzy', array['S','M','L'], array[]::text[], true, true, 12),
  ('rubashka-oversize', 'Рубашка оверсайз', 'Oversayz koʻylakcha', 'Один размер, свободная посадка.', null,
   260000, null, 'bluzy', array[]::text[], array[]::text[], true, true, 20),
  ('trench-klassicheskiy', 'Тренч классический', 'Klassik trench', null, null,
   790000, 890000, 'verhnyaya-odezhda', array['S','M','L'], array[]::text[], true, true, 25),
  ('kostyum-trojka', 'Костюм-тройка', 'Uch qismli kostyum', null, null,
   980000, null, 'kostyumy', array['42','44','46'], array[]::text[], false, true, 30),
  ('kostyum-trojka-bez-foto', 'Костюм двойка (фото скоро)', null, null, null,
   720000, null, 'kostyumy', array['42','44'], array[]::text[], true, true, 31),
  ('chernovik-plate', 'Черновик: платье', null, null, null,
   100000, null, 'platya', array['M'], array[]::text[], true, false, 0)
) as v(slug, title_ru, title_uz, description_ru, description_uz, price, old_price, category, sizes, sold_out, in_stock, published, age_days);

insert into public.product_colors (product_id, color_id, sort)
select p.id, c.id, x.sort
from (values
  ('shelkovoe-plate-midi', 'Чёрный', 0), ('shelkovoe-plate-midi', 'Шампань', 1),
  ('plate-s-printom', 'Чёрный', 0),
  ('bryuki-so-strelkami', 'Чёрный', 0), ('bryuki-so-strelkami', 'Бежевый', 1),
  ('bryuki-palazzo', 'Молочный', 0),
  ('bluza-iz-shelka', 'Молочный', 0), ('bluza-iz-shelka', 'Шампань', 1),
  ('rubashka-oversize', 'Белый', 0),
  ('trench-klassicheskiy', 'Бежевый', 0),
  ('kostyum-trojka', 'Чёрный', 0), ('kostyum-trojka', 'Графит', 1)
) as x(slug, color, sort)
join public.products p on p.slug = x.slug
join public.colors c on c.name_ru = x.color;
```

- [ ] **Step 4: Start the stack and write `.env.local`**

```bash
npm run db:start      # if the CLI rejects a service name in -x, drop that name and retry
npx supabase status -o env
```

Expected: a list including `API_URL`, `ANON_KEY` (or `PUBLISHABLE_KEY`) and `SERVICE_ROLE_KEY` (or `SECRET_KEY`).
Create `.env.local` from `.env.example`:
- Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from that output.
- Set `REVALIDATE_SECRET`, `CRON_SECRET` and `IP_HASH_SALT` to `openssl rand -hex 32` values.
- Leave the Telegram values empty for now.

- [ ] **Step 5: Integration test helpers**

`test/integration/setup.ts`:

```ts
import { execSync } from "node:child_process";

/** Read the local Supabase keys so the tests never depend on .env.local. */
function supabaseStatus(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const env: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const s = supabaseStatus();
process.env.NEXT_PUBLIC_SUPABASE_URL = s.API_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = s.ANON_KEY ?? s.PUBLISHABLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = s.SERVICE_ROLE_KEY ?? s.SECRET_KEY;
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
process.env.TG_BOT_TOKEN = "123456:TEST-TOKEN";
process.env.TG_ADMIN_CHAT_ID = "-1001";
process.env.TG_WEBHOOK_SECRET = "webhook-secret";
process.env.REVALIDATE_SECRET = "revalidate-secret";
process.env.CRON_SECRET = "cron-secret";
process.env.IP_HASH_SALT = "test-salt";
```

`test/integration/db.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
export const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);

export async function resetOrders(): Promise<void> {
  const { error } = await admin().from("orders").delete().neq("id", "");
  if (error) throw error;
}

export type SeedProduct = {
  id: string;
  price: number;
  sizes: string[];
  sold_out_sizes: string[];
  product_colors: { color_id: string; sort: number }[];
};

export async function productBySlug(slug: string): Promise<SeedProduct> {
  const { data, error } = await admin()
    .from("products")
    .select("id, price, sizes, sold_out_sizes, product_colors(color_id, sort)")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  const p = data as SeedProduct;
  p.product_colors.sort((a, b) => a.sort - b.sort);
  return p;
}
```

- [ ] **Step 6: Write the RLS test** `test/integration/rls.test.ts`

```ts
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
```

- [ ] **Step 7: Run it**

Run: `npx supabase db reset && npm run test:int -- rls`
Expected: PASS (4 tests). If `anon cannot read orders` fails because data came back, the grants or RLS are wrong.
Fix the migration and rerun `db reset`.

- [ ] **Step 8: Checkpoint.** Run `npm test` (unit tests still green). Do not commit.

---

### Task 3: Catalog data layer

**Files:**
- Create: `src/lib/env.ts`, `src/lib/types.ts`, `src/lib/cache-tags.ts`, `src/lib/supabase.ts`, `src/lib/catalog.ts`
- Test: `test/integration/catalog.test.ts`

**Interfaces:**
- Consumes: the seeded tables from Task 2.
- Produces:
  - `serverEnv` (getters: `supabaseUrl`, `supabaseAnonKey`, `serviceRoleKey`, `tgToken`, `tgAdminChatId`,
    `tgWebhookSecret`, `tgApiBase`, `revalidateSecret`, `cronSecret`, `ipHashSalt`)
  - `CATALOG_TAG = "catalog"`; `catalogClient()`, `serviceClient()`
  - Types: `Category`, `Color`, `Product`, `OrderItem`, `OrderRow`, `OrderStatus`, `TgUser`
  - `getCategories(): Promise<Category[]>`
  - `getCategory(slug): Promise<Category | null>`
  - `getProducts(opts?: { categoryId?: string }): Promise<Product[]>`
  - `getProduct(slug): Promise<Product | null>`
  - `getProductsForOrder(ids: string[]): Promise<Product[]>` (fresh, uncached)

- [ ] **Step 1: Write the failing test** `test/integration/catalog.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { getCategories, getCategory, getProduct, getProducts, getProductsForOrder } from "@/lib/catalog";

describe("catalog", () => {
  it("lists categories in sort order", async () => {
    const cats = await getCategories();
    expect(cats.map((c) => c.slug)).toEqual(["platya", "kostyumy", "bluzy", "bryuki", "verhnyaya-odezhda"]);
    expect(await getCategory("nope")).toBeNull();
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:int -- catalog`
Expected: FAIL, because `@/lib/catalog` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/env.ts`:

```ts
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** Server-side configuration. Getters read process.env on every call (tests change env between files). */
export const serverEnv = {
  get supabaseUrl() { return required("NEXT_PUBLIC_SUPABASE_URL"); },
  get supabaseAnonKey() { return required("NEXT_PUBLIC_SUPABASE_ANON_KEY"); },
  get serviceRoleKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get tgToken() { return process.env.TG_BOT_TOKEN ?? ""; },
  get tgAdminChatId() { return process.env.TG_ADMIN_CHAT_ID ?? ""; },
  get tgWebhookSecret() { return process.env.TG_WEBHOOK_SECRET ?? ""; },
  get tgApiBase() { return process.env.TG_API_BASE ?? "https://api.telegram.org"; },
  get revalidateSecret() { return process.env.REVALIDATE_SECRET ?? ""; },
  get cronSecret() { return process.env.CRON_SECRET ?? ""; },
  get ipHashSalt() { return process.env.IP_HASH_SALT ?? ""; },
};
```

`src/lib/types.ts`:

```ts
import type { Locale } from "@/i18n";

export type Category = { id: string; slug: string; name_ru: string; name_uz: string | null; sort: number };

export type Color = { id: string; name_ru: string; name_uz: string | null; hex: string };

export type Product = {
  id: string;
  slug: string;
  created_at: string;
  title_ru: string;
  title_uz: string | null;
  description_ru: string | null;
  description_uz: string | null;
  price: number;
  old_price: number | null;
  category: { slug: string; name_ru: string; name_uz: string | null };
  sizes: string[];
  sold_out_sizes: string[];
  in_stock: boolean;
  images: string[];
  colors: Color[];
  /** Created in the last 14 days ("NEW" badge). Computed when the catalog is read, not during render. */
  is_new: boolean;
};

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };

/** One ordered line, frozen at order time so later catalog edits don't change past orders. */
export type OrderItem = {
  product_id: string;
  slug: string;
  title_ru: string;
  title_uz: string | null;
  size: string | null;
  color_ru: string | null;
  color_uz: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type OrderStatus = "new" | "calling" | "confirmed" | "cancelled";

export type OrderRow = {
  id: string;
  created_at: string;
  phone: string;
  name: string | null;
  comment: string | null;
  locale: Locale;
  source: "web" | "telegram";
  tg_user: TgUser | null;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  closed_by: string | null;
  closed_at: string | null;
  tg_chat_id: number | null;
  tg_message_id: number | null;
  notify_attempts: number;
  notify_error: string | null;
  ip_hash: string | null;
};
```

`src/lib/cache-tags.ts`:

```ts
/** Every catalog read is cached under this tag; POST /api/revalidate expires it. */
export const CATALOG_TAG = "catalog";
```

`src/lib/supabase.ts`:

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CATALOG_TAG } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env";

const noSession = { persistSession: false, autoRefreshToken: false } as const;

/** Catalog reads go through Next's data cache, tagged so a database webhook can expire them. */
const taggedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, next: { tags: [CATALOG_TAG], revalidate: 3600 } });

const freshFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

let catalog: SupabaseClient | undefined;
let service: SupabaseClient | undefined;

/** Anon key + RLS: can only read published catalog rows. Cached. */
export function catalogClient(): SupabaseClient {
  catalog ??= createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: noSession,
    global: { fetch: taggedFetch },
  });
  return catalog;
}

/** Service role: bypasses RLS. Server only — orders, webhook, cron. Never cached. */
export function serviceClient(): SupabaseClient {
  service ??= createClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: noSession,
    global: { fetch: freshFetch },
  });
  return service;
}
```

`src/lib/catalog.ts`:

```ts
import "server-only";
import { catalogClient, serviceClient } from "@/lib/supabase";
import type { Category, Color, Product } from "@/lib/types";

const PRODUCT_SELECT = [
  "id, slug, created_at, title_ru, title_uz, description_ru, description_uz",
  "price, old_price, sizes, sold_out_sizes, in_stock, images",
  "category:categories!inner(slug, name_ru, name_uz)",
  "product_colors(sort, color:colors(id, name_ru, name_uz, hex))",
].join(", ");

type ProductRow = Omit<Product, "colors" | "is_new"> & { product_colors: { sort: number; color: Color | null }[] | null };

const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function toProduct(row: ProductRow): Product {
  const { product_colors, ...rest } = row;
  const colors = [...(product_colors ?? [])]
    .sort((a, b) => a.sort - b.sort)
    .map((pc) => pc.color)
    .filter((c): c is Color => c !== null);
  // Pages are cached for up to an hour, so "new" can lag by that much. Fine for a badge.
  return { ...rest, colors, is_new: Date.now() - Date.parse(row.created_at) < NEW_FOR_MS };
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await catalogClient()
    .from("categories")
    .select("id, slug, name_ru, name_uz, sort")
    .order("sort")
    .order("name_ru");
  if (error) throw error;
  return data;
}

export async function getCategory(slug: string): Promise<Category | null> {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function getProducts(opts: { categoryId?: string } = {}): Promise<Product[]> {
  let q = catalogClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const { data, error } = await catalogClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as unknown as ProductRow) : null;
}

/** Fresh read used to price an order. Never cached: prices and stock must be current. */
export async function getProductsForOrder(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data, error } = await serviceClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_published", true)
    .in("id", ids);
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(toProduct);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:int -- catalog`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint.** Run `npm run typecheck && npm test`. Do not commit.

---

### Task 4: Cart store

**Files:**
- Create: `src/lib/cart.ts`
- Test: `test/unit/cart.test.ts`

**Interfaces:**
- Produces:
  - Types: `CartSnapshot`, `CartLine`
  - Constants and helpers: `MAX_QTY = 10`, `CART_KEY = "tsv-cart-v1"`, `lineKey(line)`
  - Pure operations: `addLine(lines, line)`, `setLineQty(lines, key, qty)`, `removeLine(lines, key)`,
    `countItems(lines)`, `cartTotal(lines)`, `parseStored(raw)`
  - Store: `cart` = `{ get, add, setQty, remove, clear, subscribe }`, plus the hook `useCart(): CartLine[]`

- [ ] **Step 1: Write the failing test** `test/unit/cart.test.ts`

```ts
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
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
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
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    const { cart, CART_KEY } = await import("@/lib/cart");
    const cb = vi.fn();
    const off = cart.subscribe(cb);
    cart.add(line());
    expect(cb).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(CART_KEY)!)).toHaveLength(1);
    off();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- cart`
Expected: FAIL, because `@/lib/cart` can't be resolved.

- [ ] **Step 3: Implement** `src/lib/cart.ts`

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- cart`
Expected: PASS (6 tests).

- [ ] **Step 5: Checkpoint.** Run `npm test && npm run typecheck`. Do not commit.

---

### Task 5: Design tokens + layout shell (header, menu, language, theme, footer, cart badge/bar)

**Files:**
- Create: `src/app/globals.css`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx` (temporary),
  `src/app/[locale]/not-found.tsx`, `src/components/{icons,Wordmark,Header,Menu,LangSwitch,ThemeToggle,CartBadge,CartBar,Footer}.tsx`
- Modify: `next.config.ts`
- Test: browser walkthrough (UI only; the logic underneath is covered by Tasks 1, 3 and 4)

**Interfaces:**
- Consumes: `getDict`, `isLocale`, `locales`, `pick`, `getCategories`, `useCart`, `countItems`, `cartTotal`,
  `formatPrice`, `formatPhone`, `site`, `telegramBotUrl`.
- Produces:
  - `<Header locale categories>`, `<Footer locale>`, `<CartBar locale>`
  - `MenuIcon`, `CloseIcon`, `BagIcon`, `ChevronIcon`
  - Utility classes `label` and `snap-strip`
  - Tailwind colours `noir`, `noir-2`, `noir-3`, `gold`, `cream`, `bg`, `fg`, `muted`, `line`, `well`, `price`,
    `btn`, `btn-fg`, `bar`, `bar-fg`, `bar-accent`, `danger`
  - Fonts `font-display` and `font-sans`

- [ ] **Step 1: `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Photos are pre-resized WebP served by Supabase Storage; the optimiser would only spend Netlify credits.
  images: { unoptimized: true },
  async redirects() {
    return [{ source: "/", destination: "/ru", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No X-Frame-Options: Telegram Web/Desktop open the Mini App in an iframe.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: `src/app/globals.css`**

```css
@import "tailwindcss";
@import "@fontsource-variable/jost";
@import "@fontsource-variable/playfair-display";

/*
 * TSV tokens. Chrome (header, hero, footer) is always noir; the content area follows the theme.
 * Light = "noir entrance, white gallery". Dark = "noir gallery". See the design spec.
 */
:root {
  --noir: #121110;
  --noir-2: #1c1a17;
  --noir-3: #2a2621;
  --gold: #d9bf95;
  --cream: #efe8dd;

  --bg: #ffffff;
  --fg: #111111;
  --muted: #5f5f5f;
  --line: #e6e6e3;
  --well: #f1f1f0;
  --price: #111111;
  --btn: #111111;
  --btn-fg: #ffffff;
  --bar: #111111;
  --bar-fg: #ffffff;
  --bar-accent: #d9bf95;
  --danger: #b3261e;
  color-scheme: light;
}

:root[data-theme="dark"] {
  --bg: #121110;
  --fg: #efe8dd;
  --muted: #a39a8c;
  --line: #2a2621;
  --well: #1f1c19;
  --price: #d9bf95;
  --btn: #d9bf95;
  --btn-fg: #121110;
  --bar: #d9bf95;
  --bar-fg: #121110;
  --bar-accent: #121110;
  --danger: #ff8a80;
  color-scheme: dark;
}

@theme inline {
  --color-noir: var(--noir);
  --color-noir-2: var(--noir-2);
  --color-noir-3: var(--noir-3);
  --color-gold: var(--gold);
  --color-cream: var(--cream);
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-well: var(--well);
  --color-price: var(--price);
  --color-btn: var(--btn);
  --color-btn-fg: var(--btn-fg);
  --color-bar: var(--bar);
  --color-bar-fg: var(--bar-fg);
  --color-bar-accent: var(--bar-accent);
  --color-danger: var(--danger);
  --font-sans: "Jost Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Playfair Display Variable", "Didot", Georgia, serif;
}

/* Small uppercase letter-spaced UI label (12px floor). */
@utility label {
  font-size: 12px;
  line-height: 1.3;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

/* Horizontal photo/tab strip with native scroll-snap. */
@utility snap-strip {
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  &::-webkit-scrollbar {
    display: none;
  }
  & > * {
    scroll-snap-align: start;
  }
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}

:focus-visible {
  outline: 2px solid var(--fg);
  outline-offset: 2px;
}
.bg-noir :focus-visible {
  outline-color: var(--gold);
}

/* Slide-in menu built on <dialog> (focus trap + Esc for free). */
dialog.drawer {
  margin: 0;
  padding: 0;
  border: 0;
  width: min(86vw, 360px);
  max-width: none;
  height: 100dvh;
  max-height: none;
}
dialog.drawer::backdrop {
  background: rgb(0 0 0 / 0.55);
}
dialog.drawer[open] {
  animation: drawer-in 0.2s ease-out;
}
@keyframes drawer-in {
  from {
    transform: translateX(-100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Icons and wordmark**

`src/components/icons.tsx`:

```tsx
import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  "aria-hidden": true,
};

export const MenuIcon = () => (
  <svg {...base}>
    <path d="M4 8h16M4 16h16" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const BagIcon = () => (
  <svg {...base}>
    <path d="M6 8h12l-1 12H7z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
  </svg>
);

export const ChevronIcon = ({ dir }: { dir: "left" | "right" }) => (
  <svg {...base}>
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);
```

`src/components/Wordmark.tsx`:

```tsx
/** "TSV / WOMEN'S STORE" lockup. Decorative: the surrounding link carries the accessible name. */
export function Wordmark() {
  return (
    <span aria-hidden="true" className="flex flex-col items-center leading-none">
      <span className="font-display text-[28px] tracking-[0.14em] text-gold">TSV</span>
      <span className="mt-1 text-[9px] tracking-[0.42em] text-cream/80">WOMEN&apos;S STORE</span>
    </span>
  );
}
```

- [ ] **Step 4: Header pieces**

`src/components/LangSwitch.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/i18n";

/** RU · UZ toggle that keeps the current page. */
export function LangSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const other: Locale = locale === "ru" ? "uz" : "ru";
  const href = pathname.replace(/^\/(ru|uz)(?=\/|$)/, `/${other}`);
  const t = getDict(locale);
  return (
    <Link
      href={href}
      hrefLang={other}
      aria-label={other === "uz" ? t.nav.toUz : t.nav.toRu}
      className="flex h-11 items-center gap-1 px-2 text-[12px] tracking-[0.12em]"
    >
      <span className={locale === "ru" ? "text-cream" : "text-cream/60"}>RU</span>
      <span className="text-cream/60" aria-hidden>
        ·
      </span>
      <span className={locale === "uz" ? "text-cream" : "text-cream/60"}>UZ</span>
    </Link>
  );
}
```

`src/components/CartBadge.tsx`:

```tsx
"use client";

import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { countItems, useCart } from "@/lib/cart";
import { BagIcon } from "./icons";

export function CartBadge({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const n = countItems(useCart());
  return (
    <Link
      href={`/${locale}/cart`}
      aria-label={n ? `${t.nav.cart}: ${n}` : t.nav.cart}
      className="relative grid size-11 place-items-center"
    >
      <BagIcon />
      {n > 0 && (
        <span
          aria-hidden
          className="absolute right-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[11px] font-medium leading-none text-noir"
        >
          {n}
        </span>
      )}
    </Link>
  );
}
```

`src/components/ThemeToggle.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { getDict, type Locale } from "@/i18n";

type Theme = "light" | "dark";
export const THEME_KEY = "tsv-theme";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const set = (v: Theme) => {
    document.documentElement.dataset.theme = v;
    try {
      localStorage.setItem(THEME_KEY, v);
    } catch {
      // storage blocked: the choice lasts for this page view
    }
  };
  return (
    <div role="group" aria-label={t.nav.theme} className="grid grid-cols-2 gap-2">
      {(["light", "dark"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={theme === v}
          onClick={() => set(v)}
          className={`h-11 border text-[14px] ${theme === v ? "border-fg bg-fg text-bg" : "border-line"}`}
        >
          {v === "light" ? t.nav.themeLight : t.nav.themeDark}
        </button>
      ))}
    </div>
  );
}
```

`src/components/Menu.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getDict, type Locale } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { site, telegramBotUrl } from "@/lib/site";
import { CloseIcon, MenuIcon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";

type Item = { slug: string; name: string };

export function Menu({ locale, categories }: { locale: Locale; categories: Item[] }) {
  const t = getDict(locale);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const close = () => ref.current?.close();
  const bot = telegramBotUrl();

  useEffect(() => {
    ref.current?.close(); // navigation happened: close the drawer
  }, [pathname]);

  const link = "flex h-11 items-center label";
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label={t.nav.menu}
        aria-haspopup="dialog"
        className="grid size-11 place-items-center"
      >
        <MenuIcon />
      </button>
      <dialog
        ref={ref}
        aria-label={t.nav.menu}
        className="drawer bg-bg text-fg"
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // click on the backdrop
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between bg-noir px-2 text-cream">
            <button type="button" onClick={close} aria-label={t.nav.close} className="grid size-11 place-items-center">
              <CloseIcon />
            </button>
            <span className="pr-4 font-display text-xl tracking-[0.14em] text-gold">TSV</span>
          </div>
          <nav aria-label={t.nav.categories} className="flex-1 overflow-y-auto px-5 py-4">
            <ul>
              <li>
                <Link href={`/${locale}`} onClick={close} className={link}>
                  {t.nav.all}
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/${locale}/c/${c.slug}`} onClick={close} className={link}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-line pt-6">
              <p className="label mb-3 text-muted">{t.nav.theme}</p>
              <ThemeToggle locale={locale} />
            </div>
            <ul className="mt-8 border-t border-line pt-4 text-[15px]">
              <li>
                <a href={site.instagramUrl} target="_blank" rel="noopener" className="flex h-11 items-center">
                  Instagram
                </a>
              </li>
              {bot && (
                <li>
                  <a href={bot} target="_blank" rel="noopener" className="flex h-11 items-center">
                    Telegram
                  </a>
                </li>
              )}
              {site.phone && (
                <li>
                  <a href={`tel:${site.phone}`} className="flex h-11 items-center tabular-nums">
                    {formatPhone(site.phone)}
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
```

`src/components/Header.tsx`:

```tsx
import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { pick } from "@/lib/localize";
import type { Category } from "@/lib/types";
import { CartBadge } from "./CartBadge";
import { LangSwitch } from "./LangSwitch";
import { Menu } from "./Menu";
import { Wordmark } from "./Wordmark";

export function Header({ locale, categories }: { locale: Locale; categories: Category[] }) {
  const t = getDict(locale);
  const items = categories.map((c) => ({ slug: c.slug, name: pick(locale, c.name_ru, c.name_uz) }));
  return (
    <header className="sticky top-0 z-30 bg-noir text-cream">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-4">
        <div className="justify-self-start">
          <Menu locale={locale} categories={items} />
        </div>
        <Link href={`/${locale}`} aria-label={t.nav.home} className="justify-self-center px-2 py-1">
          <Wordmark />
        </Link>
        <div className="flex items-center justify-self-end">
          <LangSwitch locale={locale} />
          <CartBadge locale={locale} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Footer and cart bar**

`src/components/Footer.tsx`:

```tsx
import { getDict, type Locale } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { site, telegramBotUrl } from "@/lib/site";

// Module scope, not render: React Compiler lint rules forbid new Date() during render.
const YEAR = new Date().getFullYear();

export function Footer({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const bot = telegramBotUrl();
  const link = "inline-flex min-h-11 items-center underline-offset-4 hover:underline";
  return (
    <footer className="mt-20 bg-noir text-cream">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="label text-gold">{t.footer.howTitle}</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {t.footer.how.map((step, i) => (
            <li key={step} className="flex items-baseline gap-3 text-[15px]">
              <span className="font-display text-2xl leading-none text-gold">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 border-t border-noir-3 pt-4 text-[14px] text-cream/80">
          <a href={site.instagramUrl} target="_blank" rel="noopener" className={link}>
            Instagram
          </a>
          {bot && (
            <a href={bot} target="_blank" rel="noopener" className={link}>
              Telegram
            </a>
          )}
          {site.phone && (
            <a href={`tel:${site.phone}`} className={`${link} tabular-nums`}>
              {formatPhone(site.phone)}
            </a>
          )}
          <span className="py-3 sm:ml-auto">
            © {YEAR} TSV · {t.footer.rights}, {t.footer.city}
          </span>
        </div>
      </div>
    </footer>
  );
}
```

`src/components/CartBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, type Locale } from "@/i18n";
import { cartTotal, countItems, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";

/** Sticky bottom bar on phones once the cart has items. Hidden on the cart page itself. */
export function CartBar({ locale }: { locale: Locale }) {
  const lines = useCart();
  const pathname = usePathname() ?? "";
  const t = getDict(locale);
  const n = countItems(lines);
  if (n === 0 || pathname.endsWith("/cart")) return null;
  return (
    <>
      <div className="h-16 md:hidden" aria-hidden />
      <Link
        href={`/${locale}/cart`}
        className="label fixed inset-x-0 bottom-0 z-30 flex min-h-14 items-center justify-between bg-bar px-5 font-medium text-bar-fg md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span>
          {t.cart.bar} · {n}
        </span>
        <span className="tabular-nums text-bar-accent">{formatPrice(cartTotal(lines), locale)} →</span>
      </Link>
    </>
  );
}
```

- [ ] **Step 6: Locale layout, temporary home, 404**

`src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { CartBar } from "@/components/CartBar";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getDict, isLocale, locales } from "@/i18n";
import { getCategories } from "@/lib/catalog";
import { site } from "@/lib/site";

type LayoutParams = Promise<{ locale: string }>;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: LayoutParams }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDict(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: t.meta.title, template: "%s — TSV" },
    description: t.meta.description,
    openGraph: { siteName: "TSV", type: "website", locale: locale === "ru" ? "ru_RU" : "uz_UZ" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = { themeColor: "#121110" };

/** Runs before first paint: saved choice, else the system setting. No light flash for dark-mode users. */
const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem('tsv-theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t})()`;

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: LayoutParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const categories = await getCategories();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-bg focus:px-4 focus:py-3"
        >
          {t.nav.skip}
        </a>
        <Header locale={locale} categories={categories} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
        <CartBar locale={locale} />
      </body>
    </html>
  );
}
```

`src/app/[locale]/page.tsx` (temporary; replaced in Task 6):

```tsx
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <p className="px-4 py-24 text-center text-muted">{locale}</p>;
}
```

`src/app/[locale]/not-found.tsx`:

```tsx
import Link from "next/link";

/** Not-found boundaries get no params, so this page is bilingual. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-6xl">404</p>
      <h1 className="mt-4 text-lg">Страница не найдена · Sahifa topilmadi</h1>
      <Link href="/ru" className="label mt-8 inline-flex h-12 items-center bg-btn px-6 text-btn-fg">
        На главную · Bosh sahifa
      </Link>
    </div>
  );
}
```

- [ ] **Step 7: Static checks**

Run: `npm run lint && npm run typecheck`
Expected: no errors. If ESLint's React Compiler rules flag the `useEffect` in `Menu`, the effect only calls an
imperative DOM method (`dialog.close()`), which is allowed. Read the rule's message before changing any code.

- [ ] **Step 8: Browser walkthrough**

Start `npm run dev` in the background (Bash `run_in_background`), then open `http://localhost:3000` in the built-in
browser at the mobile preset (375×812). Check:
1. `/` redirects to `/ru` and shows the noir header: menu button, gold "TSV / WOMEN'S STORE", "RU · UZ", bag.
2. The menu opens as a left drawer with the categories from the DB. Esc and a backdrop click close it.
3. "Тёмная" switches the content area to `#121110`. A reload keeps the choice; "Светлая" switches back.
4. "RU · UZ" goes to `/uz` and the texts are Uzbek ("Menyu", "Hammasi").
5. `/ru/does-not-exist` shows the 404 inside the layout.

Fix what's broken, then reset the viewport to desktop.

- [ ] **Step 9: Checkpoint.** `npm test` is green. Do not commit.

---

### Task 6: Home and category pages, product cards, demo photos

**Files:**
- Create: `src/components/{Hero,CategoryTabs,ProductGrid,ProductCard}.tsx`, `src/app/[locale]/c/[slug]/page.tsx`,
  `scripts/lib/photos.ts`, `scripts/demo-photos.ts`, `public/hero.webp` (generated)
- Modify: `src/app/[locale]/page.tsx` (replace the temporary page)
- Test: run the photo pipeline against local Supabase + browser walkthrough

**Interfaces:**
- Consumes: `getCategories`, `getCategory`, `getProducts`, `imageUrl`, `objectPath`, `IMAGE_SIZES`, `PHOTO_BUCKET`, `formatPrice`,
  `formatNumber`, `pick`.
- Produces:
  - `<ProductGrid products locale>`, `<CategoryTabs locale categories active>`, `<Hero locale>`
  - From `scripts/lib/photos.ts`: `adminClientFromEnv()`, `renderVariants(input)`,
    `uploadProductPhotos(db, slug, inputs, { append })`, `triggerRevalidate()`

- [ ] **Step 1: Photo pipeline** `scripts/lib/photos.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { IMAGE_SIZES, PHOTO_BUCKET, objectPath, type ImageSize } from "../../src/lib/images";

export function adminClientFromEnv(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Center-crop to 3:4 (attention strategy keeps the subject) and encode WebP at each size. */
export async function renderVariants(input: Buffer | string): Promise<Record<ImageSize, Buffer>> {
  const out = {} as Record<ImageSize, Buffer>;
  for (const w of IMAGE_SIZES) {
    out[w] = await sharp(input)
      .rotate() // respect EXIF orientation from phones
      .resize(w, Math.round((w * 4) / 3), { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: w === 480 ? 72 : 78 })
      .toBuffer();
  }
  return out;
}

/**
 * Upload photos for one product and save their keys on the row.
 * New uploads get a fresh version prefix, so browsers and CDNs never show a stale photo.
 */
export async function uploadProductPhotos(
  db: SupabaseClient,
  slug: string,
  inputs: (Buffer | string)[],
  opts: { append?: boolean } = {},
): Promise<string[]> {
  const { data: product, error } = await db.from("products").select("id, images").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!product) throw new Error(`No product with slug "${slug}". Create the row in Supabase first.`);

  const version = Date.now().toString(36);
  const keys: string[] = [];
  for (const [n, input] of inputs.entries()) {
    const key = `${slug}/${version}-${n + 1}`;
    const variants = await renderVariants(input);
    for (const w of IMAGE_SIZES) {
      const { error: upErr } = await db.storage
        .from(PHOTO_BUCKET)
        .upload(objectPath(key, w), variants[w], { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (upErr) throw upErr;
    }
    keys.push(key);
  }

  const old: string[] = product.images ?? [];
  const images = opts.append ? [...old, ...keys] : keys;
  const { error: updErr } = await db.from("products").update({ images }).eq("id", product.id);
  if (updErr) throw updErr;

  if (!opts.append && old.length) {
    // Replaced photos: remove the old files so storage stays inside the free 1 GB.
    await db.storage.from(PHOTO_BUCKET).remove(old.flatMap((k) => IMAGE_SIZES.map((w) => objectPath(k, w))));
  }
  return images;
}

/** Ask the site to refresh its catalog cache. Returns false when not configured or unreachable. */
export async function triggerRevalidate(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return false;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Demo photos script** `scripts/demo-photos.ts`

```ts
/**
 * Placeholder photos for the seed products (local development only) + public/hero.webp.
 * Usage: npm run demo:photos
 */
import sharp from "sharp";
import { adminClientFromEnv, triggerRevalidate, uploadProductPhotos } from "./lib/photos";

const SHAPES = {
  dress: "M41 12h18l5 14-5 6 13 58H28l13-58-5-6z",
  pants: "M32 10h36l4 80H57l-7-56-7 56H28z",
  blouse: "M31 18l12-6h14l12 6 15 22-10 6-7-9v47H33V37l-7 9-10-6z",
  coat: "M34 10l9-2h14l9 2 12 24-8 4-4-8v60H34V30l-4 8-8-4z",
} as const;

// kostyum-trojka-bez-foto is left without photos on purpose (Review Focus #5).
const DEMO: Record<string, { shape: keyof typeof SHAPES; fills: string[] }> = {
  "shelkovoe-plate-midi": { shape: "dress", fills: ["#1d1d1d", "#e7d3b0"] },
  "plate-s-printom": { shape: "dress", fills: ["#2e2a33", "#45404d"] },
  "bryuki-so-strelkami": { shape: "pants", fills: ["#1d1d1d", "#d8c3a5"] },
  "bryuki-palazzo": { shape: "pants", fills: ["#efe6d6", "#e3d8c4"] },
  "bluza-iz-shelka": { shape: "blouse", fills: ["#efe6d6", "#e7d3b0"] },
  "rubashka-oversize": { shape: "blouse", fills: ["#fbfbf9"] },
  "trench-klassicheskiy": { shape: "coat", fills: ["#d8c3a5", "#c4ab86"] },
  "kostyum-trojka": { shape: "coat", fills: ["#1d1d1d", "#3b3b3d"] },
  "chernovik-plate": { shape: "dress", fills: ["#9a9a9a"] },
};

function productSvg(shape: string, fill: string, variant: number): Buffer {
  const scale = variant === 0 ? 1 : 1.18;
  const dx = variant === 0 ? 10 : 1;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 120 160">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#eeede9"/><stop offset="1" stop-color="#d9d6cf"/></linearGradient></defs>
      <rect width="120" height="160" fill="url(#g)"/>
      <g transform="translate(${dx} 32) scale(${scale})">
        <path d="${shape}" fill="${fill}" stroke="#00000026" stroke-width="0.6"/>
      </g>
    </svg>`,
  );
}

function heroSvg(): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 160 100">
      <defs><radialGradient id="r" cx="0.72" cy="0.3" r="0.9">
        <stop offset="0" stop-color="#4a4036"/><stop offset="1" stop-color="#121110"/></radialGradient></defs>
      <rect width="160" height="100" fill="url(#r)"/>
      <g transform="translate(92 4) scale(0.98)"><path d="${SHAPES.dress}" fill="#0b0a09"/></g>
    </svg>`,
  );
}

// Scripts are CommonJS .ts files (run by tsx), so no top-level await: wrap in main().
async function main() {
  const db = adminClientFromEnv();
  await sharp(heroSvg()).webp({ quality: 70 }).toFile("public/hero.webp");
  console.log("✓ public/hero.webp");

  for (const [slug, demo] of Object.entries(DEMO)) {
    const inputs = demo.fills.map((fill, i) => productSvg(SHAPES[demo.shape], fill, i));
    const images = await uploadProductPhotos(db, slug, inputs);
    console.log(`✓ ${slug}: ${images.length} photo(s)`);
  }
  console.log((await triggerRevalidate()) ? "✓ site refreshed" : "… site not refreshed (dev server not running?)");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the pipeline against local Supabase**

Run: `npm run demo:photos`
Expected: `✓ public/hero.webp` plus nine `✓ <slug>: N photo(s)` lines. Verify a file is public:

```bash
curl -sI "$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)/storage/v1/object/public/products/$(npx supabase db query --local "select images[1] from products where slug='bluza-iz-shelka'" 2>/dev/null | tail -1 | tr -d ' ')-480.webp" | head -1
```

Expected: `HTTP/1.1 200 OK`. If `supabase db query` isn't available in this CLI version, read `images` for
`bluza-iz-shelka` in the Supabase API instead: `curl` `/rest/v1/products?slug=eq.bluza-iz-shelka&select=images` with
the anon key headers.

- [ ] **Step 4: Catalog components**

`src/components/Hero.tsx`:

```tsx
import { getDict, type Locale } from "@/i18n";

/** Noir entrance banner. The photo is a static file the developer replaces (public/hero.webp). */
export function Hero({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  return (
    <section className="relative isolate overflow-hidden bg-noir text-cream">
      <img
        src="/hero.webp"
        alt=""
        width={1600}
        height={1000}
        fetchPriority="high"
        className="absolute inset-0 -z-10 size-full object-cover opacity-80"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-noir via-noir/40 to-transparent" />
      <div className="mx-auto flex min-h-[44svh] max-w-6xl flex-col justify-end px-4 pb-8 pt-20 sm:min-h-[420px]">
        <p className="label text-gold">{t.hero.kicker}</p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.05] sm:text-6xl">
          <span className="sr-only">TSV — </span>
          {t.hero.title}
        </h1>
        <a href="#catalog" className="label mt-6 inline-flex h-11 w-fit items-center border border-gold px-5 text-gold">
          {t.hero.cta}
        </a>
      </div>
    </section>
  );
}
```

`src/components/CategoryTabs.tsx`:

```tsx
import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { pick } from "@/lib/localize";
import type { Category } from "@/lib/types";

export function CategoryTabs({ locale, categories, active }: { locale: Locale; categories: Category[]; active: string | null }) {
  const t = getDict(locale);
  const tabs = [
    { slug: null, name: t.nav.all, href: `/${locale}` },
    ...categories.map((c) => ({ slug: c.slug, name: pick(locale, c.name_ru, c.name_uz), href: `/${locale}/c/${c.slug}` })),
  ];
  return (
    <nav aria-label={t.nav.categories} className="border-b border-line">
      <ul className="snap-strip mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4">
        {tabs.map((tab) => {
          const on = tab.slug === active;
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`label flex h-12 items-center whitespace-nowrap border-b-2 ${on ? "border-fg text-fg" : "border-transparent text-muted"}`}
              >
                {tab.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`src/components/ProductCard.tsx`:

```tsx
import Link from "next/link";
import { getDict, type Locale } from "@/i18n";
import { formatNumber, formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { pick } from "@/lib/localize";
import type { Product } from "@/lib/types";

export function ProductCard({ product: p, locale, priority }: { product: Product; locale: Locale; priority: boolean }) {
  const t = getDict(locale);
  const title = pick(locale, p.title_ru, p.title_uz);
  const img = p.images[0];
  return (
    <Link href={`/${locale}/p/${p.slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-well">
        {img ? (
          <img
            src={imageUrl(img, 480)}
            alt={title}
            width={480}
            height={640}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span aria-hidden className="grid size-full place-items-center font-display text-3xl tracking-[0.14em] text-muted/40">
            TSV
          </span>
        )}
        {p.is_new && (
          <span className="absolute left-2 top-2 bg-noir px-1.5 py-0.5 text-[11px] tracking-[0.12em] text-gold">
            {t.catalog.newBadge}
          </span>
        )}
        {!p.in_stock && (
          <span className="label absolute inset-x-0 bottom-0 bg-noir/85 py-2 text-center text-cream">{t.catalog.soldOut}</span>
        )}
      </div>
      <div className="px-2 pt-2 sm:px-0">
        <p className="line-clamp-2 text-[12px] uppercase leading-snug tracking-[0.06em]">{title}</p>
        <p className="mt-1 text-[14px] font-medium tabular-nums text-price">
          {formatPrice(p.price, locale)}
          {p.old_price && <s className="ml-2 text-[12px] font-normal text-muted">{formatNumber(p.old_price)}</s>}
        </p>
      </div>
    </Link>
  );
}
```

`src/components/ProductGrid.tsx`:

```tsx
import { getDict, type Locale } from "@/i18n";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, locale }: { products: Product[]; locale: Locale }) {
  const t = getDict(locale);
  if (products.length === 0) {
    return <p className="px-4 py-16 text-center text-muted">{t.catalog.empty}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-0.5 gap-y-7 sm:grid-cols-3 sm:gap-x-4 sm:px-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} locale={locale} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Pages**

`src/app/[locale]/page.tsx` (replace):

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryTabs } from "@/components/CategoryTabs";
import { Hero } from "@/components/Hero";
import { ProductGrid } from "@/components/ProductGrid";
import { getDict, isLocale } from "@/i18n";
import { getCategories, getProducts } from "@/lib/catalog";

type Params = Promise<{ locale: string }>;

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: { canonical: `/${locale}`, languages: { ru: "/ru", uz: "/uz" } } };
}

export default async function Home({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale);
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return (
    <>
      <Hero locale={locale} />
      <div id="catalog" className="scroll-mt-16">
        <CategoryTabs locale={locale} categories={categories} active={null} />
        <section aria-labelledby="new" className="mx-auto max-w-6xl pt-6">
          <div className="flex items-baseline justify-between px-4 pb-4">
            <h2 id="new" className="label font-medium">
              {t.catalog.newArrivals}
            </h2>
            <p className="text-[13px] text-muted">{t.catalog.count(products.length)}</p>
          </div>
          <ProductGrid products={products} locale={locale} />
        </section>
      </div>
    </>
  );
}
```

`src/app/[locale]/c/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ProductGrid } from "@/components/ProductGrid";
import { getDict, isLocale } from "@/i18n";
import { getCategories, getCategory, getProducts } from "@/lib/catalog";
import { pick } from "@/lib/localize";

type Params = Promise<{ locale: string; slug: string }>;

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const cat = await getCategory(slug);
  if (!cat) return {};
  return {
    title: pick(locale, cat.name_ru, cat.name_uz),
    alternates: { canonical: `/${locale}/c/${slug}`, languages: { ru: `/ru/c/${slug}`, uz: `/uz/c/${slug}` } },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [categories, cat] = await Promise.all([getCategories(), getCategory(slug)]);
  if (!cat) notFound();
  const products = await getProducts({ categoryId: cat.id });
  const t = getDict(locale);
  return (
    <>
      <CategoryTabs locale={locale} categories={categories} active={cat.slug} />
      <section className="mx-auto max-w-6xl pt-8">
        <div className="flex items-baseline justify-between px-4 pb-5">
          <h1 className="font-display text-3xl">{pick(locale, cat.name_ru, cat.name_uz)}</h1>
          <p className="text-[13px] text-muted">{t.catalog.count(products.length)}</p>
        </div>
        <ProductGrid products={products} locale={locale} />
      </section>
    </>
  );
}
```

- [ ] **Step 6: Static checks**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Browser walkthrough** (dev server running, mobile preset)

1. `/ru`: hero with gold "LIMITED PIECES", "Новая коллекция", "Смотреть" scrolls to the tabs. Tabs: Все, Платья…
   The 2-column grid shows demo photos. "NEW" appears on products less than 14 days old.
   `kostyum-trojka` shows "Нет в наличии". `kostyum-trojka-bez-foto` shows the TSV well with no broken image icon.
   The draft is absent.
2. A tab opens `/ru/c/bryuki` with 2 products, the active tab underlined, and the h1 "Брюки и юбки".
3. Dark theme: grid on noir, gold prices, readable text.
4. `/uz`: "Yangi kolleksiya", "Yangi kelganlar", "soʻm" prices, and Uzbek titles where set (Russian where not).
5. Desktop width: 4 columns, centred, header still balanced.

- [ ] **Step 8: Checkpoint.** Run `npm test`. Do not commit.

---

### Task 7: Product page (gallery, size/colour, add to cart, SEO data)

**Files:**
- Create: `src/components/{Gallery,ProductBuy,JsonLd}.tsx`, `src/app/[locale]/p/[slug]/page.tsx`
- Test: browser walkthrough (the cart logic was tested in Task 4)

**Interfaces:**
- Consumes: `getProduct`, `getProducts`, `cart.add`, `imageUrl`, `pick`, `pickOptional`, `formatPrice`, `formatNumber`,
  `absoluteUrl`, `telegramBotUrl`, `site`.
- Produces:
  - `type BuyProduct` with fields `id`, `slug`, `title_ru`, `title_uz`, `price`, `image`, `sizes`, `soldOutSizes`,
    `inStock`, `colors`
  - `<JsonLd data>`

- [ ] **Step 1: Components**

`src/components/JsonLd.tsx`:

```tsx
/** Structured data. "<" is escaped so catalog text can't close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
  );
}
```

`src/components/Gallery.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { getDict, type Locale } from "@/i18n";
import { imageUrl } from "@/lib/images";
import { ChevronIcon } from "./icons";

/** Swipeable photos (CSS scroll-snap). Counter + dots; arrow buttons on wider screens. */
export function Gallery({ images, alt, locale }: { images: string[]; alt: string; locale: Locale }) {
  const t = getDict(locale);
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div aria-hidden className="grid aspect-[3/4] place-items-center bg-well font-display text-4xl tracking-[0.14em] text-muted/40">
        TSV
      </div>
    );
  }

  const onScroll = () => {
    const el = ref.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (delta: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: (index + delta) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} onScroll={onScroll} className="snap-strip flex overflow-x-auto" aria-label={alt}>
        {images.map((key, n) => (
          <img
            key={key}
            src={imageUrl(key, 1200)}
            alt={`${alt} — ${n + 1}`}
            width={1200}
            height={1600}
            loading={n === 0 ? "eager" : "lazy"}
            fetchPriority={n === 0 ? "high" : undefined}
            decoding="async"
            className="aspect-[3/4] w-full shrink-0 bg-well object-cover"
          />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <span className="absolute right-3 top-3 bg-bg/85 px-2 py-0.5 text-[12px] tabular-nums text-fg">
            {t.product.photoOf(index + 1, images.length)}
          </span>
          <div aria-hidden className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((key, n) => (
              <span key={key} className={`size-1.5 rounded-full bg-fg ${n === index ? "" : "opacity-30"}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label={t.product.prev}
            className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center bg-bg/85 text-fg disabled:opacity-0 md:grid"
          >
            <ChevronIcon dir="left" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === images.length - 1}
            aria-label={t.product.next}
            className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center bg-bg/85 text-fg disabled:opacity-0 md:grid"
          >
            <ChevronIcon dir="right" />
          </button>
        </>
      )}
    </div>
  );
}
```

`src/components/ProductBuy.tsx`:

```tsx
"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/i18n";
import { cart } from "@/lib/cart";
import { pick } from "@/lib/localize";
import type { Color } from "@/lib/types";

export type BuyProduct = {
  id: string;
  slug: string;
  title_ru: string;
  title_uz: string | null;
  price: number;
  image: string | null;
  sizes: string[];
  soldOutSizes: string[];
  inStock: boolean;
  colors: Color[];
};

export function ProductBuy({ product: p, locale }: { product: BuyProduct; locale: Locale }) {
  const t = getDict(locale);
  const available = p.sizes.filter((s) => !p.soldOutSizes.includes(s));
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 && available.length === 1 ? available[0] : null);
  const [colorId, setColorId] = useState<string | null>(p.colors.length === 1 ? p.colors[0].id : null);
  const [hint, setHint] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const color = p.colors.find((c) => c.id === colorId) ?? null;
  const canBuy = p.inStock && (p.sizes.length === 0 || available.length > 0);

  function add() {
    if (p.sizes.length && !size) return setHint(t.product.chooseSize);
    if (p.colors.length && !color) return setHint(t.product.chooseColor);
    cart.add({
      productId: p.id,
      slug: p.slug,
      size,
      colorId: color?.id ?? null,
      qty: 1,
      snapshot: {
        title_ru: p.title_ru,
        title_uz: p.title_uz,
        price: p.price,
        image: p.image,
        color_ru: color?.name_ru ?? null,
        color_uz: color?.name_uz ?? null,
      },
    });
    setHint(null);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="mt-6 space-y-6">
      {p.sizes.length > 0 && (
        <fieldset>
          <legend className="label mb-2 text-muted">{t.product.size}</legend>
          <div className="flex flex-wrap gap-2">
            {p.sizes.map((s) => {
              const out = p.soldOutSizes.includes(s);
              const on = size === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={out}
                  aria-pressed={on}
                  onClick={() => {
                    setSize(s);
                    setHint(null);
                  }}
                  className={`h-11 min-w-11 border px-3 text-[14px] ${on ? "border-fg bg-fg text-bg" : "border-line"} disabled:text-muted disabled:line-through`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {p.colors.length > 0 && (
        <fieldset>
          <legend className="label mb-2 text-muted">
            {t.product.color}
            {color && <span className="ml-2 normal-case tracking-normal text-fg">{pick(locale, color.name_ru, color.name_uz)}</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {p.colors.map((c) => {
              const on = colorId === c.id;
              const name = pick(locale, c.name_ru, c.name_uz);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={name}
                  title={name}
                  onClick={() => {
                    setColorId(c.id);
                    setHint(null);
                  }}
                  className={`grid size-11 place-items-center rounded-full ${on ? "ring-1 ring-fg" : ""}`}
                >
                  <span className="size-7 rounded-full border border-line" style={{ background: c.hex }} />
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {hint && (
        <p role="alert" className="text-[14px] text-danger">
          {hint}
        </p>
      )}

      <button
        type="button"
        onClick={add}
        disabled={!canBuy}
        className="label h-12 w-full bg-btn font-medium text-btn-fg disabled:opacity-40"
      >
        {!canBuy ? t.product.soldOut : added ? t.product.added : t.product.add}
      </button>
      <p aria-live="polite" className="sr-only">
        {added ? t.product.added : ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Product page** `src/app/[locale]/p/[slug]/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/Gallery";
import { JsonLd } from "@/components/JsonLd";
import { ProductBuy } from "@/components/ProductBuy";
import { getDict, isLocale } from "@/i18n";
import { getProduct, getProducts } from "@/lib/catalog";
import { formatNumber, formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { pick, pickOptional } from "@/lib/localize";
import { absoluteUrl, site, telegramBotUrl } from "@/lib/site";

type Params = Promise<{ locale: string; slug: string }>;

export const revalidate = 3600;
export const dynamicParams = true; // products published after the build render on first visit

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const p = await getProduct(slug);
  if (!p) return {};
  const title = pick(locale, p.title_ru, p.title_uz);
  const description =
    pickOptional(locale, p.description_ru, p.description_uz)?.slice(0, 160) ?? `${title} — ${formatPrice(p.price, locale)}`;
  const image = p.images[0] ? imageUrl(p.images[0], 1200) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/p/${slug}`, languages: { ru: `/ru/p/${slug}`, uz: `/uz/p/${slug}` } },
    openGraph: {
      siteName: "TSV",
      type: "website",
      title,
      description,
      ...(image ? { images: [{ url: image, width: 1200, height: 1600 }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const p = await getProduct(slug);
  if (!p) notFound();

  const t = getDict(locale);
  const title = pick(locale, p.title_ru, p.title_uz);
  const description = pickOptional(locale, p.description_ru, p.description_uz);
  const categoryName = pick(locale, p.category.name_ru, p.category.name_uz);
  const url = absoluteUrl(`/${locale}/p/${p.slug}`);
  const tgLink = telegramBotUrl(`p_${p.slug}`);
  const linkCls = "inline-flex min-h-11 items-center underline underline-offset-4";

  return (
    <article className="mx-auto max-w-6xl md:grid md:grid-cols-2 md:gap-10 md:px-4 md:pt-8">
      <Gallery images={p.images} alt={title} locale={locale} />
      <div className="px-4 pt-5 md:px-0 md:pt-0">
        <nav aria-label="breadcrumb" className="text-[13px] text-muted">
          <Link href={`/${locale}/c/${p.category.slug}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {categoryName}
          </Link>
        </nav>
        <h1 className="text-[17px] uppercase leading-snug tracking-[0.08em]">{title}</h1>
        <p className="mt-2 flex items-baseline gap-3 text-xl font-medium tabular-nums text-price">
          {formatPrice(p.price, locale)}
          {p.old_price && <s className="text-[14px] font-normal text-muted">{formatNumber(p.old_price)}</s>}
        </p>

        <ProductBuy
          locale={locale}
          product={{
            id: p.id,
            slug: p.slug,
            title_ru: p.title_ru,
            title_uz: p.title_uz,
            price: p.price,
            image: p.images[0] ?? null,
            sizes: p.sizes,
            soldOutSizes: p.sold_out_sizes,
            inStock: p.in_stock,
            colors: p.colors,
          }}
        />

        {description && (
          <section className="mt-10">
            <h2 className="label text-muted">{t.product.description}</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{description}</p>
          </section>
        )}

        <section className="mt-10 border-t border-line pt-5 text-[14px]">
          <p className="text-muted">{t.product.ask}</p>
          <div className="mt-1 flex flex-wrap gap-x-6">
            {tgLink && (
              <a href={tgLink} target="_blank" rel="noopener" className={linkCls}>
                {t.product.openInTelegram}
              </a>
            )}
            <a href={site.instagramUrl} target="_blank" rel="noopener" className={linkCls}>
              Instagram
            </a>
          </div>
        </section>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: title,
          ...(description ? { description } : {}),
          image: p.images.map((k) => imageUrl(k, 1200)),
          sku: p.slug,
          brand: { "@type": "Brand", name: "TSV" },
          category: categoryName,
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: "UZS",
            price: p.price,
            availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "TSV", item: absoluteUrl(`/${locale}`) },
            { "@type": "ListItem", position: 2, name: categoryName, item: absoluteUrl(`/${locale}/c/${p.category.slug}`) },
            { "@type": "ListItem", position: 3, name: title, item: url },
          ],
        }}
      />
    </article>
  );
}
```

- [ ] **Step 3: Static checks.** Run `npm run lint && npm run typecheck`; expect no errors.

- [ ] **Step 4: Browser walkthrough** (mobile preset)

1. `/ru/p/shelkovoe-plate-midi`:
   - swipe between 2 photos, with the counter "1 / 2 → 2 / 2" and the dots
   - XL is struck through and disabled
   - "Добавить в корзину" with no size shows "Выберите размер"
   - pick M + Шампань → "Добавлено ✓"; the header badge shows 1 and the bottom bar shows "КОРЗИНА · 1 — 489 000 сум →"
   - add again → badge 2, still one line (check `localStorage['tsv-cart-v1']` with `javascript_tool`)
2. `/ru/p/rubashka-oversize`: no size picker; its only colour is preselected; it adds straight away.
3. `/ru/p/kostyum-trojka`: the button reads "Нет в наличии" and is disabled.
4. `/ru/p/kostyum-trojka-bez-foto`: TSV placeholder well, no broken image, no `og:image` in `<head>`
   (Review Focus #5).
5. `/uz/p/plate-s-printom`: Uzbek title and description.
6. Open a second tab and add an item there; the first tab's badge updates (the `storage` event).

- [ ] **Step 5: Checkpoint.** Run `npm test`. Do not commit.

---

### Task 8: Order core (pure): validation, ids, messages, status machine, Telegram signature, secrets

**Files:**
- Create: `src/lib/telegram/{types,escape,init-data}.ts`, `src/lib/security.ts`,
  `src/lib/order/{id,validate,message,status}.ts`, `test/helpers/init-data.ts`
- Test: `test/unit/{validate,message,status,init-data,security}.test.ts`

**Interfaces:**
- Consumes: `normalizeUzPhone`, `formatNumber`, `formatPrice`, `formatPhone`, `pick`, `absoluteUrl`, and the types from
  Task 3.
- Produces:
  - `escapeHtml(s)`
  - `type InlineButton`, `type InlineKeyboard`
  - `verifyInitData(initData, botToken, nowSec?, maxAgeSec?): TgUser | null`
  - `safeEqual(a, b)`, `hashIp(ip, salt)`
  - `newOrderId()`, `ORDER_ID_RE`
  - From `validate.ts`:
    - `type OrderErrorCode`, `type RawOrderInput`, `type PricedLine`, `type ValidOrder`, `type ValidationResult`
    - `isHoneypotFilled(input)`, `productIdsOf(items)`, `validateOrder(input, products)`, `toOrderItems(lines)`,
      `orderSignature(items)`
  - From `message.ts`: `tgDisplayName(u)`, `adminMessage(order)`, `customerMessage(order)`
  - From `status.ts`: `type OrderAction`, `TRANSITIONS`, `parseCallbackData(data)`, `orderKeyboard(order)`,
    `staleActionText(order)`, `ACTION_TOAST`
  - Test helper: `signInitData(fields, token)`

- [ ] **Step 1: Write the failing tests**

`test/helpers/init-data.ts`:

```ts
import { createHmac } from "node:crypto";

/** Build initData exactly like Telegram does, signed with a test bot token. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
```

`test/unit/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isHoneypotFilled, orderSignature, productIdsOf, toOrderItems, validateOrder } from "@/lib/order/validate";
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
```

`test/unit/message.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adminMessage, customerMessage, tgDisplayName } from "@/lib/order/message";
import type { OrderItem, OrderRow } from "@/lib/types";

const it1: OrderItem = {
  product_id: "p1", slug: "plate-s-printom", title_ru: "Платье миди с принтом", title_uz: "Naqshli koʻylak",
  size: "M", color_ru: "Чёрный", color_uz: "Qora", qty: 1, unit_price: 489000, line_total: 489000,
};
const order = (over: Partial<OrderRow> = {}): OrderRow => ({
  id: "K7Q2M9", created_at: "2026-10-08T10:00:00Z", phone: "+998901234567", name: "Дилноза", comment: "После 18:00",
  locale: "ru", source: "web", tg_user: null, items: [it1], total: 489000, status: "new", claimed_by: null,
  claimed_at: null, closed_by: null, closed_at: null, tg_chat_id: null, tg_message_id: null, notify_attempts: 0,
  notify_error: null, ip_hash: null, ...over,
});

describe("adminMessage", () => {
  it("contains the phone, items, source and total", () => {
    const m = adminMessage(order());
    expect(m).toContain("🛍 <b>Новый заказ #K7Q2M9</b>");
    expect(m).toContain("📞 <b>+998 90 123 45 67</b>");
    expect(m).toContain("👤 Дилноза");
    expect(m).toContain("🌐 Сайт · RU");
    expect(m).toContain('<a href="http://localhost:3000/ru/p/plate-s-printom">Платье миди с принтом</a> — M, Чёрный × 1 — 489');
    expect(m).toContain("💰 <b>Итого: 489 000 сум</b>");
  });

  it("escapes customer text", () => {
    const m = adminMessage(order({ name: "<b>x</b>", comment: 'a & "b" <script>' }));
    expect(m).toContain("👤 &lt;b&gt;x&lt;/b&gt;");
    expect(m).toContain("💬 a &amp; &quot;b&quot; &lt;script&gt;");
  });

  it("shows the Telegram user for Mini App orders", () => {
    const m = adminMessage(order({ source: "telegram", locale: "uz", tg_user: { id: 42, first_name: "Dilnoza", username: "dilnoza" } }));
    expect(m).toContain('✈️ Telegram · <a href="https://t.me/dilnoza">Dilnoza (@dilnoza)</a> · UZ');
  });

  it("stays under Telegram's 4096-char limit for huge orders (Review Focus #2)", () => {
    const long: OrderItem = { ...it1, title_ru: "Очень длинное название ".repeat(8).slice(0, 200) };
    const m = adminMessage(order({ comment: "к".repeat(500), items: Array.from({ length: 30 }, () => long) }));
    expect(m.length).toBeLessThanOrEqual(4096);
    expect(m).toMatch(/… и ещё \d+ поз\./);
    expect(m).toContain("💰 <b>Итого:");
  });
});

describe("customerMessage", () => {
  it("speaks the customer's language", () => {
    expect(customerMessage(order())).toContain("Заказ #K7Q2M9 принят");
    const uz = customerMessage(order({ locale: "uz" }));
    expect(uz).toContain("Buyurtmangiz qabul qilindi — #K7Q2M9");
    expect(uz).toContain("• Naqshli koʻylak (M, Qora) × 1");
  });
});

describe("tgDisplayName", () => {
  it("formats names", () => {
    expect(tgDisplayName({ id: 1, first_name: "Malika", last_name: "K", username: "malika" })).toBe("Malika K (@malika)");
    expect(tgDisplayName({ id: 7 })).toBe("id7");
  });
});
```

`test/unit/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { orderKeyboard, parseCallbackData, staleActionText, TRANSITIONS } from "@/lib/order/status";

describe("status machine", () => {
  it("defines the transitions", () => {
    expect(TRANSITIONS).toEqual({
      take: { from: "new", to: "calling" },
      done: { from: "calling", to: "confirmed" },
      cancel: { from: "calling", to: "cancelled" },
      reset: { from: "calling", to: "new" },
    });
  });

  it("parses callback data strictly", () => {
    expect(parseCallbackData("o:K7Q2M9:take")).toEqual({ orderId: "K7Q2M9", action: "take" });
    expect(parseCallbackData("o:K7Q2M9:drop")).toBeNull();
    expect(parseCallbackData("o:k7q2m9:take")).toBeNull();
    expect(parseCallbackData("o:K7Q2M0:take")).toBeNull();
    expect(parseCallbackData("noop")).toBeNull();
  });

  it("draws a keyboard per status", () => {
    const base = { id: "K7Q2M9", claimed_by: "Malika", closed_by: "Malika" };
    expect(orderKeyboard({ ...base, status: "new" }).inline_keyboard).toEqual([
      [{ text: "📞 Я позвоню", callback_data: "o:K7Q2M9:take" }],
    ]);
    const calling = orderKeyboard({ ...base, status: "calling" }).inline_keyboard;
    expect(calling[0][0].text).toBe("📞 Звонит: Malika");
    expect(calling.flat().map((b) => b.callback_data)).toEqual(["noop", "o:K7Q2M9:done", "o:K7Q2M9:cancel", "o:K7Q2M9:reset"]);
    expect(orderKeyboard({ ...base, status: "confirmed" }).inline_keyboard).toEqual([
      [{ text: "✅ Подтверждён — Malika", callback_data: "noop" }],
    ]);
    expect(orderKeyboard({ ...base, status: "cancelled" }).inline_keyboard[0][0].text).toBe("❌ Отменён — Malika");
  });

  it("explains why a tap did nothing", () => {
    expect(staleActionText({ status: "calling", claimed_by: "Malika" })).toBe("Уже звонит: Malika");
    expect(staleActionText({ status: "confirmed", claimed_by: null })).toBe("Заказ уже подтверждён");
    expect(staleActionText({ status: "cancelled", claimed_by: null })).toBe("Заказ уже отменён");
    expect(staleActionText({ status: "new", claimed_by: null })).toBe("Статус уже изменён");
  });
});
```

`test/unit/init-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { verifyInitData } from "@/lib/telegram/init-data";
import { signInitData } from "../helpers/init-data";

const TOKEN = "123456:TEST-TOKEN";
const NOW = 1_791_450_000;
const fields = {
  auth_date: String(NOW - 60),
  query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
  user: JSON.stringify({ id: 42, first_name: "Dilnoza", username: "dilnoza" }),
};

describe("verifyInitData", () => {
  it("accepts data signed with the bot token", () => {
    expect(verifyInitData(signInitData(fields, TOKEN), TOKEN, NOW)).toEqual({ id: 42, first_name: "Dilnoza", username: "dilnoza" });
  });
  it("rejects another token, tampering, staleness and junk", () => {
    const good = signInitData(fields, TOKEN);
    expect(verifyInitData(good, "999:OTHER", NOW)).toBeNull();
    expect(verifyInitData(good.replace("Dilnoza", "Mallory"), TOKEN, NOW)).toBeNull();
    expect(verifyInitData(good, TOKEN, NOW + 2 * 86_400)).toBeNull();
    expect(verifyInitData("hash=zz", TOKEN, NOW)).toBeNull();
    expect(verifyInitData("", TOKEN, NOW)).toBeNull();
    expect(verifyInitData(good, "", NOW)).toBeNull();
  });
});
```

`test/unit/security.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newOrderId, ORDER_ID_RE } from "@/lib/order/id";
import { hashIp, safeEqual } from "@/lib/security";
import { escapeHtml } from "@/lib/telegram/escape";

describe("security helpers", () => {
  it("compares secrets safely; empty never matches", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });
  it("hashes IPs with a salt", () => {
    expect(hashIp("1.2.3.4", "s")).toHaveLength(32);
    expect(hashIp("1.2.3.4", "s")).not.toBe(hashIp("1.2.3.4", "t"));
  });
  it("escapes Telegram HTML", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
  it("makes speakable order ids", () => {
    for (let i = 0; i < 200; i++) expect(newOrderId()).toMatch(ORDER_ID_RE);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL in the 5 new files (modules not found). Tasks 1 and 4 still pass.

- [ ] **Step 3: Implement**

`src/lib/telegram/types.ts`:

```ts
export type InlineButton = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };
```

`src/lib/telegram/escape.ts`:

```ts
/** Escape text for Telegram parse_mode=HTML (text and attribute values). All customer input goes through this. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
```

`src/lib/telegram/init-data.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import type { TgUser } from "@/lib/types";

/**
 * Verify Telegram Mini App initData (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Returns the user when the HMAC is valid and auth_date is fresh, otherwise null.
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  maxAgeSec = 86_400,
): TgUser | null {
  if (!botToken || !initData || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || authDate <= 0 || nowSec - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TgUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}
```

`src/lib/security.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time compare for shared secrets. An empty secret never matches (unset env ≠ open door). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length > 0 && ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** We never store raw IPs: a salted hash is enough to rate-limit. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
```

`src/lib/order/id.ts`:

```ts
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars: no 0/O/1/I, so it's easy to say on the phone
export const ORDER_ID_RE = /^[2-9A-HJ-NP-Z]{6}$/;

/** "K7Q2M9". 32^6 ≈ 1e9 ids; collisions are retried on insert. 256 % 32 === 0, so no modulo bias. */
export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
}
```

`src/lib/order/validate.ts`:

```ts
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
```

`src/lib/order/message.ts`:

```ts
import { formatNumber, formatPhone, formatPrice } from "@/lib/format";
import { pick } from "@/lib/localize";
import { absoluteUrl } from "@/lib/site";
import { escapeHtml } from "@/lib/telegram/escape";
import type { OrderItem, OrderRow, TgUser } from "@/lib/types";

/** Telegram rejects texts over 4096 characters; stay well below (tags count against us here, not there). */
const SAFE_LENGTH = 3900;

export function tgDisplayName(u: Pick<TgUser, "id" | "first_name" | "last_name" | "username">): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || `id${u.id}`;
  return u.username ? `${name} (@${u.username})` : name;
}

/** Join head + lines + tail, dropping lines from the end (with a "… and N more" line) until it fits. */
function fit(head: string[], lines: string[], tail: string[], more: (n: number) => string): string {
  let kept = lines.length;
  let text = [...head, ...lines, ...tail].join("\n");
  while (text.length > SAFE_LENGTH && kept > 1) {
    kept--;
    text = [...head, ...lines.slice(0, kept), more(lines.length - kept), ...tail].join("\n");
  }
  return text;
}

function adminItemLine(it: OrderItem, i: number): string {
  const title = `<a href="${escapeHtml(absoluteUrl(`/ru/p/${it.slug}`))}">${escapeHtml(it.title_ru)}</a>`;
  const opts = [it.size, it.color_ru].filter((s): s is string => !!s).map(escapeHtml).join(", ");
  return `${i + 1}. ${title}${opts ? ` — ${opts}` : ""} × ${it.qty} — ${formatNumber(it.line_total)}`;
}

/** Message for the admin group (Russian, parse_mode=HTML). */
export function adminMessage(o: OrderRow): string {
  const head = [`🛍 <b>Новый заказ #${o.id}</b>`, "", `📞 <b>${formatPhone(o.phone)}</b>`];
  if (o.name) head.push(`👤 ${escapeHtml(o.name)}`);
  if (o.comment) head.push(`💬 ${escapeHtml(o.comment)}`);
  const lang = o.locale.toUpperCase();
  if (o.tg_user) {
    const u = o.tg_user;
    const link = u.username ? `https://t.me/${u.username}` : `tg://user?id=${u.id}`;
    head.push(`✈️ Telegram · <a href="${escapeHtml(link)}">${escapeHtml(tgDisplayName(u))}</a> · ${lang}`);
  } else {
    head.push(`🌐 Сайт · ${lang}`);
  }
  head.push("");
  const tail = ["", `💰 <b>Итого: ${formatPrice(o.total, "ru")}</b>`];
  return fit(head, o.items.map(adminItemLine), tail, (n) => `… и ещё ${n} поз. (полный список — в базе)`);
}

/** Confirmation the bot sends to a Mini App customer, in their language. */
export function customerMessage(o: OrderRow): string {
  const uz = o.locale === "uz";
  const lines = o.items.map((it) => {
    const colorName = uz ? it.color_uz || it.color_ru : it.color_ru;
    const opts = [it.size, colorName].filter((s): s is string => !!s).map(escapeHtml).join(", ");
    return `• ${escapeHtml(pick(o.locale, it.title_ru, it.title_uz))}${opts ? ` (${opts})` : ""} × ${it.qty}`;
  });
  const phone = `<b>${formatPhone(o.phone)}</b>`;
  return uz
    ? fit(
        [`✅ <b>Buyurtmangiz qabul qilindi — #${o.id}</b>`, ""],
        lines,
        ["", `Jami: ${formatPrice(o.total, "uz")}`, `Tez orada ${phone} raqamiga qoʻngʻiroq qilamiz.`],
        (n) => `… yana ${n} ta`,
      )
    : fit(
        [`✅ <b>Заказ #${o.id} принят</b>`, ""],
        lines,
        ["", `Итого: ${formatPrice(o.total, "ru")}`, `Мы скоро позвоним на ${phone}.`],
        (n) => `… и ещё ${n} поз.`,
      );
}
```

`src/lib/order/status.ts`:

```ts
import type { InlineKeyboard } from "@/lib/telegram/types";
import type { OrderRow, OrderStatus } from "@/lib/types";

export type OrderAction = "take" | "done" | "cancel" | "reset";

export const TRANSITIONS: Record<OrderAction, { from: OrderStatus; to: OrderStatus }> = {
  take: { from: "new", to: "calling" },
  done: { from: "calling", to: "confirmed" },
  cancel: { from: "calling", to: "cancelled" },
  reset: { from: "calling", to: "new" },
};

export const ACTION_TOAST: Record<OrderAction, string> = {
  take: "Вы звоните клиенту",
  done: "Заказ подтверждён",
  cancel: "Заказ отменён",
  reset: "Заказ снова свободен",
};

export function parseCallbackData(data: string): { orderId: string; action: OrderAction } | null {
  const m = /^o:([2-9A-HJ-NP-Z]{6}):(take|done|cancel|reset)$/.exec(data);
  return m ? { orderId: m[1], action: m[2] as OrderAction } : null;
}

const short = (s: string | null) => (s ?? "админ").slice(0, 40);

/** Buttons under an order message. Each status has its own keyboard. */
export function orderKeyboard(o: Pick<OrderRow, "id" | "status" | "claimed_by" | "closed_by">): InlineKeyboard {
  const cb = (a: OrderAction) => `o:${o.id}:${a}`;
  switch (o.status) {
    case "new":
      return { inline_keyboard: [[{ text: "📞 Я позвоню", callback_data: cb("take") }]] };
    case "calling":
      return {
        inline_keyboard: [
          [{ text: `📞 Звонит: ${short(o.claimed_by)}`, callback_data: "noop" }],
          [
            { text: "✅ Подтверждён", callback_data: cb("done") },
            { text: "❌ Отменён", callback_data: cb("cancel") },
          ],
          [{ text: "↩️ Сбросить", callback_data: cb("reset") }],
        ],
      };
    case "confirmed":
      return { inline_keyboard: [[{ text: `✅ Подтверждён — ${short(o.closed_by)}`, callback_data: "noop" }]] };
    case "cancelled":
      return { inline_keyboard: [[{ text: `❌ Отменён — ${short(o.closed_by)}`, callback_data: "noop" }]] };
  }
}

/** Toast for a tap that lost a race or came too late. */
export function staleActionText(o: Pick<OrderRow, "status" | "claimed_by">): string {
  if (o.status === "calling") return `Уже звонит: ${short(o.claimed_by)}`;
  if (o.status === "confirmed") return "Заказ уже подтверждён";
  if (o.status === "cancelled") return "Заказ уже отменён";
  return "Статус уже изменён";
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npm test`
Expected: PASS (all unit files). The message test relies on `NEXT_PUBLIC_SITE_URL` being unset, so it gets
`http://localhost:3000`. If a shell export makes it fail, run with `NEXT_PUBLIC_SITE_URL= npm test`.

- [ ] **Step 5: Checkpoint.** Run `npm run typecheck`. Do not commit.

---

### Task 9: Order service, Telegram client, POST /api/order

**Files:**
- Create: `src/lib/telegram/api.ts`, `src/lib/order/service.ts`, `src/app/api/order/route.ts`, `test/integration/tg-stub.ts`
- Test: `test/integration/order.test.ts`

**Interfaces:**
- Consumes:
  - from Task 8: `validateOrder`, `productIdsOf`, `isHoneypotFilled`, `toOrderItems`, `orderSignature`,
    `adminMessage`, `customerMessage`, `orderKeyboard`, `verifyInitData`, `hashIp`, `newOrderId`
  - from Task 3: `getProductsForOrder`, `serviceClient`, `serverEnv`
- Produces:
  - `tg<T>(method, body): Promise<T>`, `class TelegramError { method; description; status }`
  - `createOrder(input, { ip }): Promise<CreateOrderResult>`
  - `notifyAdmins(row): Promise<boolean>`
  - `resendPending(): Promise<{ tried: number; sent: number }>`
  - `type CreateOrderResult`
  - `POST /api/order` → `200 {ok:true,id,total}`, `400 {ok:false,code,lineIndex?}`, `403`, `413`, `429`, `503`
  - Test helper `startTgStub()` → `{ calls, failNext(n?), reset(), close() }`

- [ ] **Step 1: Telegram stub for tests** `test/integration/tg-stub.ts`

```ts
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type TgCall = { method: string; body: Record<string, unknown> };

/** Fake Bot API on localhost. Points TG_API_BASE at itself. */
export async function startTgStub() {
  const calls: TgCall[] = [];
  let failures = 0;
  let messageId = 100;

  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const method = (req.url ?? "").split("/").pop() ?? "";
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    calls.push({ method, body });
    res.setHeader("content-type", "application/json");
    if (failures > 0) {
      failures--;
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, description: "Bad Gateway (stub)" }));
      return;
    }
    const result = method === "sendMessage" ? { message_id: ++messageId, chat: { id: Number(body.chat_id) } } : true;
    res.end(JSON.stringify({ ok: true, result }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.TG_API_BASE = `http://127.0.0.1:${port}`;

  return {
    calls,
    failNext(n = 1) {
      failures = n;
    },
    reset() {
      calls.length = 0;
      failures = 0;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
```

- [ ] **Step 2: Write the failing test** `test/integration/order.test.ts`

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/order/route";
import { resendPending } from "@/lib/order/service";
import { signInitData } from "../helpers/init-data";
import { admin, productBySlug, resetOrders, type SeedProduct } from "./db";
import { startTgStub } from "./tg-stub";

let stub: Awaited<ReturnType<typeof startTgStub>>;
let dress: SeedProduct;
let shirt: SeedProduct;
let ipCounter = 0;

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/order", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ipCounter}`, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

const dressItem = (over: Record<string, unknown> = {}) => ({
  productId: dress.id, size: "M", colorId: dress.product_colors[1].color_id, qty: 1, ...over,
});

beforeAll(async () => {
  stub = await startTgStub();
  dress = await productBySlug("shelkovoe-plate-midi");
  shirt = await productBySlug("rubashka-oversize");
});
afterAll(() => stub.close());
beforeEach(async () => {
  await resetOrders();
  stub.reset();
});

describe("POST /api/order", () => {
  it("saves the order with DB prices and notifies the admin group", async () => {
    const res = await post({
      phone: "90 123 45 67",
      name: "Дилноза",
      comment: "после 18:00",
      locale: "uz",
      items: [dressItem({ qty: 2 }), { productId: shirt.id, colorId: shirt.product_colors[0].color_id, qty: 1, size: null }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, total: 489000 * 2 + 260000 });
    expect(body.id).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);

    const { data: row } = await admin().from("orders").select("*").eq("id", body.id).single();
    expect(row).toMatchObject({ phone: "+998901234567", name: "Дилноза", locale: "uz", source: "web", status: "new", total: 1238000 });
    expect(row.items[0]).toMatchObject({ slug: "shelkovoe-plate-midi", size: "M", color_ru: "Шампань", qty: 2, unit_price: 489000 });
    expect(row.ip_hash).toHaveLength(32);
    expect(row.tg_message_id).toBe(101);
    expect(row.tg_chat_id).toBe(-1001);

    const send = stub.calls.find((c) => c.method === "sendMessage")!;
    expect(send.body.chat_id).toBe("-1001");
    expect(send.body.text).toContain(`Новый заказ #${body.id}`);
    expect(send.body.reply_markup).toEqual({ inline_keyboard: [[{ text: "📞 Я позвоню", callback_data: `o:${body.id}:take` }]] });
  });

  it("returns line errors with the line index", async () => {
    const res = await post({ phone: "901234567", items: [dressItem(), dressItem({ size: "XL" })] });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, code: "size_sold_out", lineIndex: 1 });
    const missing = await post({ phone: "901234567", items: [dressItem({ productId: "00000000-0000-4000-8000-000000000000" })] });
    expect(await missing.json()).toEqual({ ok: false, code: "unavailable_item", lineIndex: 0 });
    const sold = await productBySlug("kostyum-trojka");
    const soldRes = await post({ phone: "901234567", items: [{ productId: sold.id, size: "42", colorId: sold.product_colors[0].color_id, qty: 1 }] });
    expect(await soldRes.json()).toEqual({ ok: false, code: "unavailable_item", lineIndex: 0 });
  });

  it("rejects bad requests", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ phone: "901234567", items: [dressItem()] }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ phone: "1", items: [], pad: "x".repeat(25_000) })).status).toBe(413);
  });

  it("pretends success for the honeypot and stores nothing", async () => {
    const res = await post({ phone: "901234567", items: [dressItem()], website: "http://spam.example" });
    expect(res.status).toBe(200);
    const { count } = await admin().from("orders").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
    expect(stub.calls).toHaveLength(0);
  });

  it("dedupes a double-submitted order (Review Focus #1)", async () => {
    const order = { phone: "901234567", items: [dressItem()] };
    const a = await (await post(order)).json();
    const b = await (await post(order)).json();
    expect(b.id).toBe(a.id);
    expect(stub.calls.filter((c) => c.method === "sendMessage")).toHaveLength(1);
  });

  it("rate-limits by phone (3 per 10 min)", async () => {
    for (const qty of [1, 2, 3]) expect((await post({ phone: "935550011", items: [dressItem({ qty })] })).status).toBe(200);
    const res = await post({ phone: "935550011", items: [dressItem({ qty: 4 })] });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, code: "rate_limited" });
  });

  it("rate-limits by IP (5 per 10 min)", async () => {
    const ip = { "x-forwarded-for": "10.9.9.9" };
    for (const n of [1, 2, 3, 4, 5]) expect((await post({ phone: `9055500${10 + n}`, items: [dressItem()] }, ip)).status).toBe(200);
    expect((await post({ phone: "905550099", items: [dressItem()] }, ip)).status).toBe(429);
  });

  it("keeps the order when Telegram is down, and the resend job delivers it", async () => {
    stub.failNext(1);
    const res = await post({ phone: "901112233", items: [dressItem()] });
    expect(res.status).toBe(200);
    const { id } = await res.json();
    let { data: row } = await admin().from("orders").select("*").eq("id", id).single();
    expect(row.tg_message_id).toBeNull();
    expect(row.notify_error).toContain("Bad Gateway");
    expect(row.notify_attempts).toBe(1);

    // The job skips orders younger than 2 minutes (the request may still be sending). Age this one.
    await admin().from("orders").update({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq("id", id);
    expect(await resendPending()).toEqual({ tried: 1, sent: 1 });
    ({ data: row } = await admin().from("orders").select("*").eq("id", id).single());
    expect(row.tg_message_id).not.toBeNull();
    expect(row.notify_error).toBeNull();
    expect(await resendPending()).toEqual({ tried: 0, sent: 0 });
  });

  it("marks Mini App orders and confirms to the customer", async () => {
    const initData = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), query_id: "AA", user: JSON.stringify({ id: 42, first_name: "Dilnoza", username: "dilnoza" }) },
      process.env.TG_BOT_TOKEN!,
    );
    const res = await post({ phone: "901234567", items: [dressItem()], initData });
    const { id } = await res.json();
    const { data: row } = await admin().from("orders").select("source, tg_user").eq("id", id).single();
    expect(row).toMatchObject({ source: "telegram", tg_user: { id: 42, username: "dilnoza" } });
    const toCustomer = stub.calls.find((c) => c.method === "sendMessage" && c.body.chat_id === 42);
    expect(toCustomer?.body.text).toContain(`Заказ #${id} принят`);
  });

  it("treats forged initData as a plain web order", async () => {
    const res = await post({ phone: "901234567", items: [dressItem()], initData: "user=%7B%22id%22%3A1%7D&hash=" + "a".repeat(64) });
    const { id } = await res.json();
    const { data: row } = await admin().from("orders").select("source, tg_user").eq("id", id).single();
    expect(row).toEqual({ source: "web", tg_user: null });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:int -- order`
Expected: FAIL, because `@/app/api/order/route` can't be resolved.

- [ ] **Step 4: Implement**

`src/lib/telegram/api.ts`:

```ts
import "server-only";
import { serverEnv } from "@/lib/env";

export class TelegramError extends Error {
  constructor(
    public method: string,
    public description: string,
    public status: number,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
  }
}

/** Call a Bot API method. Throws TelegramError on failure. 8 s timeout so a slow API can't hang a request. */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = serverEnv.tgToken;
  if (!token) throw new TelegramError(method, "TG_BOT_TOKEN is not set", 0);
  const res = await fetch(`${serverEnv.tgApiBase}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!res.ok || !data.ok) throw new TelegramError(method, data.description ?? res.statusText, res.status);
  return data.result as T;
}
```

`src/lib/order/service.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProductsForOrder } from "@/lib/catalog";
import { serverEnv } from "@/lib/env";
import { newOrderId } from "@/lib/order/id";
import { adminMessage, customerMessage } from "@/lib/order/message";
import { orderKeyboard } from "@/lib/order/status";
import {
  orderSignature, productIdsOf, toOrderItems, validateOrder, type OrderErrorCode, type RawOrderInput,
} from "@/lib/order/validate";
import { hashIp } from "@/lib/security";
import { serviceClient } from "@/lib/supabase";
import { tg } from "@/lib/telegram/api";
import { verifyInitData } from "@/lib/telegram/init-data";
import type { OrderRow } from "@/lib/types";

export type CreateOrderResult =
  | { ok: true; id: string; total: number }
  | { ok: false; status: 400 | 429; code: OrderErrorCode | "rate_limited"; lineIndex?: number };

const WINDOW_MS = 10 * 60_000;
const DEDUPE_MS = 2 * 60_000;
const LIMIT_PER_IP = 5;
const LIMIT_PER_PHONE = 3;

export async function createOrder(input: RawOrderInput, ctx: { ip: string | null }): Promise<CreateOrderResult> {
  const db = serviceClient();
  const products = await getProductsForOrder(productIdsOf(input.items));
  const result = validateOrder(input, new Map(products.map((p) => [p.id, p])));
  if (!result.ok) return { ok: false, status: 400, code: result.code, lineIndex: result.lineIndex };
  const o = result.order;
  const items = toOrderItems(o.lines);

  // A double tap or a retry after a flaky network: hand back the order we already have.
  const dup = await findRecentDuplicate(db, o.phone, orderSignature(items));
  if (dup) return { ok: true, id: dup.id, total: dup.total };

  const ipHash = ctx.ip ? hashIp(ctx.ip, serverEnv.ipHashSalt) : null;
  if (await isRateLimited(db, o.phone, ipHash)) return { ok: false, status: 429, code: "rate_limited" };

  const tgUser =
    typeof input.initData === "string" && input.initData ? verifyInitData(input.initData, serverEnv.tgToken) : null;

  const base = {
    phone: o.phone,
    name: o.name,
    comment: o.comment,
    locale: o.locale,
    source: tgUser ? "telegram" : "web",
    tg_user: tgUser,
    items,
    total: o.total,
    ip_hash: ipHash,
  };

  let row: OrderRow | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const { data, error } = await db.from("orders").insert({ ...base, id: newOrderId() }).select("*").single();
    if (!error) row = data as OrderRow;
    else if (error.code !== "23505") throw error; // 23505 = id collision → try another id
  }
  if (!row) throw new Error("Could not allocate an order id");

  await notifyAdmins(row);
  if (tgUser) {
    await tg("sendMessage", { chat_id: tgUser.id, text: customerMessage(row), parse_mode: "HTML" }).catch((err) =>
      console.warn("[order] customer confirmation failed", err),
    );
  }
  return { ok: true, id: row.id, total: row.total };
}

async function findRecentDuplicate(db: SupabaseClient, phone: string, signature: string) {
  const since = new Date(Date.now() - DEDUPE_MS).toISOString();
  const { data, error } = await db
    .from("orders")
    .select("id, total, items")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data as Pick<OrderRow, "id" | "total" | "items">[]).find((r) => orderSignature(r.items) === signature) ?? null;
}

/** Counted in Postgres so the limit holds across serverless instances. */
async function isRateLimited(db: SupabaseClient, phone: string, ipHash: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const count = async (column: "ip_hash" | "phone", value: string) => {
    const { count, error } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq(column, value)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  };
  if (ipHash && (await count("ip_hash", ipHash)) >= LIMIT_PER_IP) return true;
  return (await count("phone", phone)) >= LIMIT_PER_PHONE;
}

/** Post (or re-post) the order to the admin group. Never throws: failures are recorded on the row. */
export async function notifyAdmins(row: OrderRow): Promise<boolean> {
  const db = serviceClient();
  try {
    if (!serverEnv.tgToken || !serverEnv.tgAdminChatId) throw new Error("Telegram is not configured");
    const msg = await tg<{ message_id: number; chat: { id: number } }>("sendMessage", {
      chat_id: serverEnv.tgAdminChatId,
      text: adminMessage(row),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: orderKeyboard(row),
    });
    await db.from("orders").update({ tg_chat_id: msg.chat.id, tg_message_id: msg.message_id, notify_error: null }).eq("id", row.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[order] admin notify failed for ${row.id}: ${message}`);
    if (process.env.NODE_ENV !== "production") console.info(`[order] message that would be sent:\n${adminMessage(row)}`);
    await db
      .from("orders")
      .update({ notify_attempts: row.notify_attempts + 1, notify_error: message.slice(0, 500) })
      .eq("id", row.id);
    return false;
  }
}

/** Scheduled job: retry orders that never reached Telegram. Also keeps the free Supabase project awake. */
export async function resendPending(): Promise<{ tried: number; sent: number }> {
  const db = serviceClient();
  const now = Date.now();
  const { data, error } = await db
    .from("orders")
    .select("*")
    .is("tg_message_id", null)
    .lt("notify_attempts", 10)
    .gte("created_at", new Date(now - 2 * 86_400_000).toISOString())
    .lt("created_at", new Date(now - 2 * 60_000).toISOString()) // younger ones may still be mid-request
    .order("created_at")
    .limit(20);
  if (error) throw error;
  let sent = 0;
  for (const row of data as OrderRow[]) if (await notifyAdmins(row)) sent++;
  return { tried: data.length, sent };
}
```

`src/app/api/order/route.ts`:

```ts
import { newOrderId } from "@/lib/order/id";
import { createOrder } from "@/lib/order/service";
import { isHoneypotFilled, type RawOrderInput } from "@/lib/order/validate";
import { site } from "@/lib/site";

export const runtime = "nodejs"; // node:crypto (initData HMAC, IP hash)

const MAX_BODY_BYTES = 20_000;

const json = (status: number, body: unknown) => Response.json(body, { status });

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-nf-client-connection-ip") ?? // Netlify
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/** Browsers always send Origin on a cross-site POST; reject other sites' forms. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === new URL(req.url).host || host === new URL(site.url).host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json(403, { ok: false, code: "forbidden" });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, code: "too_large" });

  let input: RawOrderInput;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    input = parsed as RawOrderInput;
  } catch {
    return json(400, { ok: false, code: "bad_request" });
  }

  // Bots fill the hidden field. Pretend success so they learn nothing.
  if (isHoneypotFilled(input)) return json(200, { ok: true, id: newOrderId(), total: 0 });

  try {
    const r = await createOrder(input, { ip: clientIp(req) });
    if (r.ok) return json(200, r);
    return json(r.status, { ok: false, code: r.code, ...(r.lineIndex === undefined ? {} : { lineIndex: r.lineIndex }) });
  } catch (err) {
    console.error("[order] failed", err);
    return json(503, { ok: false, code: "unavailable" });
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm run test:int -- order`
Expected: PASS (9 tests). In the first test, `tg_message_id` is 101 because the stub numbers messages from 100 and
`reset()` keeps counting. If it's off by one, assert `> 100` instead. Don't change the stub.

- [ ] **Step 6: Checkpoint.** Run `npm test && npm run test:int && npm run typecheck && npm run lint`. Do not commit.

---

### Task 10: Cart page (lines, phone form, errors, success)

**Files:**
- Create: `src/lib/tg-client.ts`, `src/components/{PhoneInput,OrderSuccess,CartView}.tsx`, `src/app/[locale]/cart/page.tsx`
- Test: browser end-to-end against the dev server + local Supabase (the API is covered by Task 9)

**Interfaces:**
- Consumes:
  - `useCart`, `cart`, `lineKey`, `cartTotal`, `countItems`, `MAX_QTY`
  - `maskLocalPhone`, `normalizeUzPhone`, `formatPrice`, `formatPhone`, `imageUrl`, `pick`
  - `site`, `telegramBotUrl`
  - `POST /api/order`
- Produces:
  - `type WebApp`, `getWebApp()`, `getInitData()`, `haptic(type)` (Task 13 uses `getWebApp` and `WebApp`)
  - `<CartView locale>`

- [ ] **Step 1: Telegram browser helpers** `src/lib/tg-client.ts`

```ts
/** The parts of window.Telegram.WebApp we use. */
export type WebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: "themeChanged", cb: () => void): void;
  HapticFeedback?: { notificationOccurred(type: "success" | "error" | "warning"): void };
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

/** Telegram.WebApp only when really running inside Telegram (outside it, initData is empty). */
export function getWebApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  const wa = window.Telegram?.WebApp;
  return wa && wa.initData ? wa : null;
}

export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

export function haptic(type: "success" | "error"): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type);
}
```

- [ ] **Step 2: Components**

`src/components/PhoneInput.tsx`:

```tsx
"use client";

import type { Ref } from "react";
import { maskLocalPhone } from "@/lib/phone";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
  ref?: Ref<HTMLInputElement>;
};

/** Fixed "+998" prefix + 9 local digits, auto-formatted "90 123 45 67". 16px text so iOS doesn't zoom. */
export function PhoneInput({ id, value, onChange, invalid, describedBy, ref }: Props) {
  return (
    <div
      className={`flex h-12 items-center border focus-within:ring-2 focus-within:ring-fg/25 ${invalid ? "border-danger" : "border-fg/40 focus-within:border-fg"}`}
    >
      <span aria-hidden className="pl-3 pr-2 text-[16px] tabular-nums text-muted">
        +998
      </span>
      <input
        ref={ref}
        id={id}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="90 123 45 67"
        value={value}
        onChange={(e) => onChange(maskLocalPhone(e.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required
        className="h-full min-w-0 flex-1 bg-transparent pr-3 text-[16px] tabular-nums outline-none"
      />
    </div>
  );
}
```

`src/components/OrderSuccess.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { getDict, type Locale } from "@/i18n";
import { formatPhone } from "@/lib/format";
import { site } from "@/lib/site";

export function OrderSuccess({ locale, id, phone }: { locale: Locale; id: string; phone: string }) {
  const t = getDict(locale);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus(); // announce the result to screen readers
  }, []);
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <div aria-hidden className="mx-auto grid size-14 place-items-center rounded-full border border-fg/30 text-2xl">
        ✓
      </div>
      <h1 ref={heading} tabIndex={-1} className="mt-6 font-display text-4xl outline-none">
        {t.success.title}
      </h1>
      <p className="label mt-3 text-muted">
        {t.success.order} <span className="tabular-nums text-fg">{id}</span>
      </p>
      <p className="mt-6 text-[16px] leading-relaxed">
        {t.success.callYou}
        <br />
        <b className="tabular-nums">{formatPhone(phone)}</b>
      </p>
      <p className="mt-1 text-muted">{t.success.toConfirm}</p>
      <div className="mt-10 grid gap-3">
        <Link href={`/${locale}`} className="label flex h-12 items-center justify-center bg-btn text-btn-fg">
          {t.success.continue}
        </Link>
        <a href={site.instagramUrl} target="_blank" rel="noopener" className="label flex h-12 items-center justify-center border border-fg">
          {t.success.instagram}
        </a>
      </div>
    </div>
  );
}
```

`src/components/CartView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { getDict, type Locale } from "@/i18n";
import { cart, cartTotal, countItems, lineKey, MAX_QTY, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { pick } from "@/lib/localize";
import { normalizeUzPhone } from "@/lib/phone";
import { site, telegramBotUrl } from "@/lib/site";
import { getInitData, haptic } from "@/lib/tg-client";
import { OrderSuccess } from "./OrderSuccess";
import { PhoneInput } from "./PhoneInput";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "error"; code: string; lineIndex?: number }
  | { kind: "done"; id: string; phone: string };

type OrderResponse = { ok?: boolean; id?: string; code?: string; lineIndex?: number };

const field = "mt-1.5 w-full border border-fg/40 bg-transparent px-3 text-[16px] outline-none focus:border-fg focus:ring-2 focus:ring-fg/25";

export function CartView({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const lines = useCart();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [phoneInvalid, setPhoneInvalid] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const phoneRef = useRef<HTMLInputElement>(null);

  if (status.kind === "done") return <OrderSuccess locale={locale} id={status.id} phone={status.phone} />;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl">{t.cart.empty}</h1>
        <Link href={`/${locale}`} className="label mt-8 inline-flex h-12 items-center bg-btn px-6 text-btn-fg">
          {t.cart.continue}
        </Link>
      </div>
    );
  }

  const sending = status.kind === "sending";
  const errorText = (code: string) => (t.errors as Record<string, string>)[code] ?? t.errors.generic;
  const lineError = status.kind === "error" && status.lineIndex !== undefined ? status : null;
  const formError = status.kind === "error" && status.lineIndex === undefined && status.code !== "phone" ? status.code : null;
  const bot = telegramBotUrl();
  const total = cartTotal(lines);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return; // Review Focus #1: no double submit from the UI (the server dedupes too)
    const normalized = normalizeUzPhone(phone);
    if (!normalized) {
      setPhoneInvalid(true);
      setStatus({ kind: "error", code: "phone" });
      phoneRef.current?.focus();
      return;
    }
    setPhoneInvalid(false);
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ productId: l.productId, size: l.size, colorId: l.colorId, qty: l.qty })),
          phone,
          name,
          comment,
          locale,
          website,
          initData: getInitData(),
        }),
      });
      const data = (await res.json().catch(() => null)) as OrderResponse | null;
      if (res.ok && data?.ok && data.id) {
        cart.clear();
        haptic("success");
        setStatus({ kind: "done", id: data.id, phone: normalized });
        window.scrollTo({ top: 0 });
        return;
      }
      haptic("error");
      const code = data?.code ?? (res.status >= 500 ? "unavailable" : "generic");
      if (code === "phone") setPhoneInvalid(true);
      setStatus({ kind: "error", code, lineIndex: data?.lineIndex });
    } catch {
      haptic("error");
      setStatus({ kind: "error", code: "network" });
    }
  }

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <h1 className="label px-4 pb-2 pt-6 font-medium">
        {t.cart.title} · {countItems(lines)}
      </h1>

      <ul>
        {lines.map((l, i) => {
          const key = lineKey(l);
          const title = pick(locale, l.snapshot.title_ru, l.snapshot.title_uz);
          const colorName = l.snapshot.color_ru ? pick(locale, l.snapshot.color_ru, l.snapshot.color_uz) : null;
          const err = lineError?.lineIndex === i ? errorText(lineError.code) : null;
          return (
            <li key={key} className="flex gap-3 border-b border-line px-4 py-4">
              <Link href={`/${locale}/p/${l.slug}`} className="block w-16 shrink-0" tabIndex={-1} aria-hidden>
                <div className="aspect-[3/4] bg-well">
                  {l.snapshot.image && (
                    <img src={imageUrl(l.snapshot.image, 480)} alt="" width={64} height={85} className="size-full object-cover" />
                  )}
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/${locale}/p/${l.slug}`} className="line-clamp-2 text-[13px] uppercase tracking-[0.05em]">
                  {title}
                </Link>
                {(l.size || colorName) && (
                  <p className="mt-0.5 text-[13px] text-muted">{[l.size, colorName].filter(Boolean).join(" · ")}</p>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center border border-line">
                    <button
                      type="button"
                      aria-label={t.cart.qtyDec}
                      onClick={() => cart.setQty(key, l.qty - 1)}
                      className="grid size-11 place-items-center text-lg"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={t.cart.qtyInc}
                      disabled={l.qty >= MAX_QTY}
                      onClick={() => cart.setQty(key, l.qty + 1)}
                      className="grid size-11 place-items-center text-lg disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(key)}
                    className="min-h-11 text-[13px] text-muted underline underline-offset-4"
                  >
                    {t.cart.remove}
                  </button>
                </div>
                {err && (
                  <p role="alert" className="mt-2 text-[13px] text-danger">
                    {err}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-[14px] font-medium tabular-nums">{formatPrice(l.snapshot.price * l.qty, locale)}</p>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between px-4 py-4">
        <span className="label font-medium">{t.cart.total}</span>
        <span className="text-lg font-medium tabular-nums text-price">{formatPrice(total, locale)}</span>
      </div>

      <form onSubmit={submit} noValidate className="space-y-4 px-4">
        <div>
          <label htmlFor="phone" className="label text-muted">
            {t.cart.phone} *
          </label>
          <div className="mt-1.5">
            <PhoneInput
              ref={phoneRef}
              id="phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                if (phoneInvalid) setPhoneInvalid(false);
              }}
              invalid={phoneInvalid}
              describedBy={phoneInvalid ? "phone-error" : undefined}
            />
          </div>
          {phoneInvalid && (
            <p id="phone-error" role="alert" className="mt-1.5 text-[13px] text-danger">
              {t.errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="label text-muted">
            {t.cart.name}
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            maxLength={60}
            placeholder={t.cart.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${field} h-12`}
          />
        </div>

        <div>
          <label htmlFor="comment" className="label text-muted">
            {t.cart.comment}
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={2}
            maxLength={500}
            placeholder={t.cart.commentPlaceholder}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={`${field} py-3`}
          />
        </div>

        {/* Honeypot: invisible to people, irresistible to bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <p className="text-[13px] leading-relaxed text-muted">{t.cart.note}</p>

        {formError && (
          <div role="alert" className="border border-danger/40 p-3 text-[14px]">
            <p className="text-danger">{errorText(formError)}</p>
            {(formError === "network" || formError === "unavailable") && (
              <p className="mt-2 text-muted">
                {t.errors.fallback}{" "}
                <a href={site.instagramUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                  Instagram
                </a>
                {bot && (
                  <>
                    {" · "}
                    <a href={bot} target="_blank" rel="noopener" className="underline underline-offset-4">
                      Telegram
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="label flex h-13 w-full items-center justify-center gap-2 bg-btn font-medium text-btn-fg disabled:opacity-60"
        >
          {sending ? (
            t.cart.sending
          ) : (
            <>
              {t.cart.submit} · <span className="tabular-nums text-bar-accent">{formatPrice(total, locale)}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
```

`src/app/[locale]/cart/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartView } from "@/components/CartView";
import { getDict, isLocale } from "@/i18n";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDict(locale).cart.title, robots: { index: false, follow: true } };
}

export default async function CartPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CartView locale={locale} />;
}
```

- [ ] **Step 3: Static checks.** Run `npm run lint && npm run typecheck`; expect no errors.

- [ ] **Step 4: End-to-end in the browser** (dev server + local Supabase; Telegram not configured, so the dev
  console prints the admin message)

1. Add the silk dress (M, Шампань) and the trousers (44, Бежевый), then open `/ru/cart`: 2 lines, sizes and colours,
   qty steppers, total 809 000 сум.
2. Submit with phone `12 3` → "Введите номер полностью…" under the field, with focus on the phone input.
3. Paste `+998 (90) 123-45-67` → the field shows `90 123 45 67`. Submit → "Спасибо!", order № XXXXXX, phone echoed.
   The cart is empty and the header badge is cleared.
4. Check the order row:
   `curl -s "$URL/rest/v1/orders?select=id,total,status,notify_error" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE"`
   (values from `.env.local`). One row, `total` 809000, `notify_error` "Telegram is not configured". The `npm run dev`
   output shows the Russian admin message.
5. Double-click "Оформить заказ" quickly on a new cart → exactly one new row (Review Focus #1).
6. Line error: add `bluza-iz-shelka` size L. Then set that product's `sold_out_sizes` to `{L}` by PATCHing it with
   the service key. Submit → the line shows "Этот размер закончился…".
7. Stop Supabase's REST container to simulate an outage, or point the fetch at an offline network with DevTools
   throttling "Offline". Submit → the network error box offers Instagram/Telegram links; cart and form are kept.
8. Repeat step 3 in `/uz/cart` with the dark theme → Uzbek texts, gold submit button with noir text.

- [ ] **Step 5: Checkpoint.** Run `npm test && npm run test:int`. Do not commit.

---

### Task 11: Telegram webhook (claim buttons, /start, /chatid)

**Files:**
- Create: `src/lib/telegram/webhook.ts`, `src/app/api/telegram/webhook/route.ts`
- Test: `test/integration/webhook.test.ts`

**Interfaces:**
- Consumes: `tg`, `TelegramError`, `parseCallbackData`, `TRANSITIONS`, `orderKeyboard`, `staleActionText`,
  `ACTION_TOAST`, `tgDisplayName`, `serviceClient`, `serverEnv`, `safeEqual`, `absoluteUrl`.
- Produces: `type Update`, `handleUpdate(update)`, and `POST /api/telegram/webhook` (403 on a bad secret, otherwise
  always 200).

- [ ] **Step 1: Write the failing test** `test/integration/webhook.test.ts`

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/telegram/webhook/route";
import { admin, resetOrders } from "./db";
import { startTgStub } from "./tg-stub";

let stub: Awaited<ReturnType<typeof startTgStub>>;

const MALIKA = { id: 7, first_name: "Malika", username: "malika" };
const AZIZA = { id: 8, first_name: "Aziza" };

function hook(update: unknown, secret = "webhook-secret") {
  return POST(
    new Request("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(update),
    }),
  );
}

let n = 0;
const tap = (data: string, from: object = MALIKA, chatId = -1001) => ({
  update_id: ++n,
  callback_query: { id: `cb${n}`, from, data, message: { message_id: 555, chat: { id: chatId, type: "supergroup" } } },
});
const say = (text: string, chat: { id: number; type: string }) => ({
  update_id: ++n,
  message: { message_id: n, chat, from: MALIKA, text },
});

async function order(id = "K7Q2M9") {
  const { error } = await admin().from("orders").insert({
    id, phone: "+998901234567", locale: "ru", source: "web", items: [], total: 0, tg_chat_id: -1001, tg_message_id: 555,
  });
  if (error) throw error;
}
const row = async (id = "K7Q2M9") => (await admin().from("orders").select("*").eq("id", id).single()).data;
const answers = () => stub.calls.filter((c) => c.method === "answerCallbackQuery").map((c) => c.body.text ?? null);

beforeAll(async () => {
  stub = await startTgStub();
});
afterAll(() => stub.close());
beforeEach(async () => {
  await resetOrders();
  stub.reset();
});

describe("telegram webhook", () => {
  it("rejects a wrong secret", async () => {
    expect((await hook(tap("o:K7Q2M9:take"), "nope")).status).toBe(403);
  });

  it("take → calling, shows who is calling", async () => {
    await order();
    expect((await hook(tap("o:K7Q2M9:take"))).status).toBe(200);
    expect(await row()).toMatchObject({ status: "calling", claimed_by: "Malika (@malika)" });
    expect(answers()).toEqual(["Вы звоните клиенту"]);
    const edit = stub.calls.find((c) => c.method === "editMessageReplyMarkup")!;
    expect(edit.body).toMatchObject({ chat_id: -1001, message_id: 555 });
    expect(JSON.stringify(edit.body.reply_markup)).toContain("Звонит: Malika (@malika)");
  });

  it("two admins tap at once: exactly one wins", async () => {
    await order();
    await Promise.all([hook(tap("o:K7Q2M9:take", MALIKA)), hook(tap("o:K7Q2M9:take", AZIZA))]);
    const r = await row();
    expect(r.status).toBe("calling");
    const texts = answers();
    expect(texts).toContain("Вы звоните клиенту");
    expect(texts).toContain(`Уже звонит: ${r.claimed_by}`);
  });

  it("done / cancel close the order; reset frees it", async () => {
    await order("AAAAAA");
    await hook(tap("o:AAAAAA:take"));
    await hook(tap("o:AAAAAA:done", AZIZA));
    expect(await row("AAAAAA")).toMatchObject({ status: "confirmed", closed_by: "Aziza" });

    await order("BBBBBB");
    await hook(tap("o:BBBBBB:take"));
    await hook(tap("o:BBBBBB:reset"));
    expect(await row("BBBBBB")).toMatchObject({ status: "new", claimed_by: null });
    await hook(tap("o:BBBBBB:cancel"));
    expect((await row("BBBBBB")).status).toBe("new"); // cancel needs "calling" first
    expect(answers().at(-1)).toBe("Статус уже изменён");
  });

  it("ignores taps from other chats and no-op buttons", async () => {
    await order();
    await hook(tap("o:K7Q2M9:take", MALIKA, -999));
    await hook(tap("noop"));
    expect((await row()).status).toBe("new");
    expect(answers()).toEqual([null, null]);
  });

  it("/chatid answers in groups only", async () => {
    await hook(say("/chatid@tsv_bot", { id: -1001, type: "supergroup" }));
    await hook(say("/chatid", { id: 42, type: "private" }));
    const sends = stub.calls.filter((c) => c.method === "sendMessage");
    expect(sends).toHaveLength(1);
    expect(sends[0].body).toMatchObject({ chat_id: -1001, text: "chat_id: <code>-1001</code>" });
  });

  it("/start opens the shop, /start p_<slug> opens the product", async () => {
    await hook(say("/start", { id: 42, type: "private" }));
    await hook(say("/start p_bluza-iz-shelka", { id: 42, type: "private" }));
    await hook(say("/start", { id: -1001, type: "supergroup" }));
    const urls = stub.calls
      .filter((c) => c.method === "sendMessage")
      .map((c) => (c.body.reply_markup as { inline_keyboard: { web_app: { url: string } }[][] }).inline_keyboard[0][0].web_app.url);
    expect(urls).toEqual(["http://localhost:3000/ru?tg=1", "http://localhost:3000/ru/p/bluza-iz-shelka?tg=1"]);
  });

  it("survives junk", async () => {
    expect((await hook({ update_id: 1 })).status).toBe(200);
    expect((await hook(tap("o:ZZZZZZ:take"))).status).toBe(200);
    expect(answers()).toEqual(["Заказ не найден"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:int -- webhook`
Expected: FAIL, because `@/app/api/telegram/webhook/route` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/telegram/webhook.ts`:

```ts
import "server-only";
import { serverEnv } from "@/lib/env";
import { tgDisplayName } from "@/lib/order/message";
import { ACTION_TOAST, orderKeyboard, parseCallbackData, staleActionText, TRANSITIONS } from "@/lib/order/status";
import { absoluteUrl } from "@/lib/site";
import { serviceClient } from "@/lib/supabase";
import { tg, TelegramError } from "@/lib/telegram/api";
import type { OrderRow, TgUser } from "@/lib/types";

type Chat = { id: number; type: "private" | "group" | "supergroup" | "channel" };
type Message = { message_id: number; chat: Chat; from?: TgUser; text?: string };
type CallbackQuery = { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: Chat } };
export type Update = { update_id: number; message?: Message; callback_query?: CallbackQuery };

const START_RE = /^\/start(?:@\w+)?(?:\s+(\S+))?$/;
const CHATID_RE = /^\/chatid(?:@\w+)?$/;
const PRODUCT_PAYLOAD_RE = /^p_([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export async function handleUpdate(update: Update): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message?.text) return handleMessage(update.message);
}

async function handleCallback(q: CallbackQuery): Promise<void> {
  const answer = (text?: string) =>
    tg("answerCallbackQuery", { callback_query_id: q.id, ...(text ? { text } : {}) }).catch(() => undefined);

  const parsed = q.data ? parseCallbackData(q.data) : null;
  // Only buttons in the admin group may change orders.
  if (!parsed || !q.message || String(q.message.chat.id) !== serverEnv.tgAdminChatId) {
    await answer();
    return;
  }

  const who = tgDisplayName(q.from);
  const now = new Date().toISOString();
  const step = TRANSITIONS[parsed.action];
  const patch: Partial<OrderRow> = { status: step.to };
  if (parsed.action === "take") Object.assign(patch, { claimed_by: who, claimed_at: now });
  if (parsed.action === "reset") Object.assign(patch, { claimed_by: null, claimed_at: null });
  if (parsed.action === "done" || parsed.action === "cancel") Object.assign(patch, { closed_by: who, closed_at: now });

  const db = serviceClient();
  // Conditional update: of two simultaneous taps only one still matches `status = from`.
  const { data: updated, error } = await db
    .from("orders")
    .update(patch)
    .eq("id", parsed.orderId)
    .eq("status", step.from)
    .select("*")
    .maybeSingle();
  if (error) throw error;

  let row = updated as OrderRow | null;
  if (row) {
    await answer(ACTION_TOAST[parsed.action]);
  } else {
    const { data } = await db.from("orders").select("*").eq("id", parsed.orderId).maybeSingle();
    row = data as OrderRow | null;
    await answer(row ? staleActionText(row) : "Заказ не найден");
  }
  if (!row) return;

  await tg("editMessageReplyMarkup", {
    chat_id: q.message.chat.id,
    message_id: q.message.message_id,
    reply_markup: orderKeyboard(row),
  }).catch((err) => {
    if (!(err instanceof TelegramError && err.description.includes("not modified"))) console.warn("[webhook] edit failed", err);
  });
}

async function handleMessage(m: Message): Promise<void> {
  const text = (m.text ?? "").trim();

  if (CHATID_RE.test(text)) {
    // Setup helper: tells the developer the admin group's id.
    if (m.chat.type !== "private") {
      await tg("sendMessage", { chat_id: m.chat.id, text: `chat_id: <code>${m.chat.id}</code>`, parse_mode: "HTML" });
    }
    return;
  }

  const start = START_RE.exec(text);
  if (!start || m.chat.type !== "private") return;
  const slug = PRODUCT_PAYLOAD_RE.exec(start[1] ?? "")?.[1];
  const url = absoluteUrl(`${slug ? `/ru/p/${slug}` : "/ru"}?tg=1`);
  await tg("sendMessage", {
    chat_id: m.chat.id,
    text: [
      "Добро пожаловать в TSV 🤍",
      "TSV doʻkoniga xush kelibsiz!",
      "",
      "Нажмите кнопку, чтобы открыть магазин.",
      "Doʻkonni ochish uchun tugmani bosing.",
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: slug ? "🛍 Открыть товар · Mahsulotni ochish" : "🛍 Открыть магазин · Doʻkonni ochish", web_app: { url } }],
      ],
    },
  });
}
```

`src/app/api/telegram/webhook/route.ts`:

```ts
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security";
import { handleUpdate, type Update } from "@/lib/telegram/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(secret, serverEnv.tgWebhookSecret)) return new Response("forbidden", { status: 403 });

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("ok");
  }
  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("[webhook]", err);
  }
  // Always 200 once authenticated: a non-200 makes Telegram redeliver the same update over and over.
  return new Response("ok");
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:int -- webhook`
Expected: PASS (8 tests).

- [ ] **Step 5: Checkpoint.** Run `npm test && npm run test:int && npm run lint && npm run typecheck`. Do not commit.

---

### Task 12: Operations: revalidate route, cron resend, Netlify scheduled function, photos CLI

**Files:**
- Create: `src/app/api/revalidate/route.ts`, `src/app/api/cron/resend/route.ts`,
  `netlify/functions/resend-orders.mts`, `scripts/photos.ts`
- Test: `test/unit/revalidate.test.ts`, `test/integration/cron.test.ts`, plus a manual photos CLI run

**Interfaces:**
- Consumes: `CATALOG_TAG`, `serverEnv`, `safeEqual`, `resendPending`, `adminClientFromEnv`, `uploadProductPhotos`,
  `triggerRevalidate`.
- Produces:
  - `POST /api/revalidate` (header `x-revalidate-secret`)
  - `POST /api/cron/resend` (header `authorization: Bearer <CRON_SECRET>`)
  - The Netlify schedule `*/15 * * * *`
  - The `npm run photos` CLI

- [ ] **Step 1: Write the failing tests**

`test/unit/revalidate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const { revalidateTag } = await import("next/cache");
const { POST } = await import("@/app/api/revalidate/route");

const call = (secret?: string) =>
  POST(new Request("http://localhost/api/revalidate", { method: "POST", headers: secret ? { "x-revalidate-secret": secret } : {} }));

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.mocked(revalidateTag).mockClear();
    process.env.REVALIDATE_SECRET = "s3cret";
  });

  it("expires the catalog tag immediately with the right secret", async () => {
    const res = await call("s3cret");
    expect(res.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("catalog", { expire: 0 });
  });

  it("refuses a wrong or missing secret, and an unset secret never matches", async () => {
    expect((await call("nope")).status).toBe(403);
    expect((await call()).status).toBe(403);
    process.env.REVALIDATE_SECRET = "";
    expect((await call("")).status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
```

`test/integration/cron.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/cron/resend/route";
import { admin, resetOrders } from "./db";
import { startTgStub } from "./tg-stub";

let stub: Awaited<ReturnType<typeof startTgStub>>;
const call = (auth?: string) =>
  POST(new Request("http://localhost/api/cron/resend", { method: "POST", headers: auth ? { authorization: auth } : {} }));

beforeAll(async () => {
  stub = await startTgStub();
});
afterAll(() => stub.close());
beforeEach(async () => {
  await resetOrders();
  stub.reset();
});

describe("POST /api/cron/resend", () => {
  it("needs the cron secret", async () => {
    expect((await call()).status).toBe(403);
    expect((await call("Bearer wrong")).status).toBe(403);
  });

  it("re-sends unsent orders older than 2 minutes", async () => {
    await admin().from("orders").insert({
      id: "CCCCCC", phone: "+998901234567", locale: "ru", source: "web", items: [], total: 0,
      created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    });
    const res = await call("Bearer cron-secret");
    expect(await res.json()).toEqual({ ok: true, tried: 1, sent: 1 });
    expect(stub.calls.some((c) => c.method === "sendMessage" && String(c.body.text).includes("CCCCCC"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- revalidate && npm run test:int -- cron`
Expected: FAIL (route modules missing).

- [ ] **Step 3: Implement**

`src/app/api/revalidate/route.ts`:

```ts
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security";

/** Called by the Supabase database webhook (and the photos script) after catalog edits. */
export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-revalidate-secret") ?? "", serverEnv.revalidateSecret)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  // Outside a Server Action: expire now so the next visit renders fresh data (Next 16 two-argument form).
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
```

`src/app/api/cron/resend/route.ts`:

```ts
import { serverEnv } from "@/lib/env";
import { resendPending } from "@/lib/order/service";
import { safeEqual } from "@/lib/security";

export const runtime = "nodejs";

/** Hit every 15 min by netlify/functions/resend-orders.mts. */
export async function POST(req: Request) {
  const secret = serverEnv.cronSecret;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  try {
    return Response.json({ ok: true, ...(await resendPending()) });
  } catch (err) {
    console.error("[cron] resend failed", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
```

`netlify/functions/resend-orders.mts`:

```ts
import type { Config } from "@netlify/functions";

/**
 * Every 15 minutes: re-send orders that never reached Telegram. Each run also queries Supabase,
 * so the free project never pauses for inactivity. The logic lives in the Next app (/api/cron/resend).
 */
export default async () => {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.URL ?? "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/cron/resend`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  console.log(`[resend-orders] ${res.status} ${await res.text()}`);
};

export const config: Config = { schedule: "*/15 * * * *" };
```

`scripts/photos.ts`:

```ts
/**
 * Upload product photos: crop 3:4, WebP 480 + 1200, upload to Supabase Storage, save on the product row.
 *   npm run photos -- <product-slug> photo1.jpg photo2.jpg          (replaces the photos)
 *   npm run photos -- <product-slug> photo3.jpg --append            (adds to the end)
 */
import { parseArgs } from "node:util";
import { adminClientFromEnv, triggerRevalidate, uploadProductPhotos } from "./lib/photos";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { append: { type: "boolean", default: false } },
  });
  const [slug, ...files] = positionals;
  if (!slug || files.length === 0) {
    console.error("Usage: npm run photos -- <product-slug> <photo.jpg> [more.jpg …] [--append]");
    process.exit(1);
  }
  const images = await uploadProductPhotos(adminClientFromEnv(), slug, files, { append: values.append });
  console.log(`✓ ${slug}: now ${images.length} photo(s) (${values.append ? "appended" : "replaced"})`);
  console.log(
    (await triggerRevalidate())
      ? "✓ site refreshed"
      : "… site not refreshed: set NEXT_PUBLIC_SITE_URL + REVALIDATE_SECRET, or rely on the database webhook",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- revalidate && npm run test:int -- cron`
Expected: PASS. If top-level `await` in the unit test is rejected, move the two `await import(...)` lines into a
`beforeAll` and keep the mocked module.

- [ ] **Step 5: Manual check of the photos CLI** (dev server running)

```bash
SCR=/private/tmp/claude-501/-Users-davronbekdev-Desktop-Programming-women-store/98ae960c-498b-4556-8e7a-310dc6b0ddad/scratchpad
node -e "require('sharp')({create:{width:3024,height:4032,channels:3,background:'#b08d6a'}}).jpeg().toFile('$SCR/phone-photo.jpg')"
npm run photos -- bluza-iz-shelka "$SCR/phone-photo.jpg" --append
```

Expected: `✓ bluza-iz-shelka: now 3 photo(s) (appended)` and `✓ site refreshed`. In the browser, `/ru/p/bluza-iz-shelka`
shows 3 photos after a reload, with the third a brown 3:4 block. Then run `npm run demo:photos` to restore the demo set.

- [ ] **Step 6: Checkpoint.** Run `npm test && npm run test:int && npm run typecheck && npm run lint`. Do not commit.

---

### Task 13: Telegram Mini App + bot setup script

**Files:**
- Create: `src/components/TelegramBoot.tsx`, `scripts/setup-telegram.ts`
- Modify: `src/app/[locale]/layout.tsx` (render `<TelegramBoot />`)
- Test: browser check (the script only loads with `?tg=1`); real Telegram check once the user provides a bot token

**Interfaces:**
- Consumes: `getWebApp`, `type WebApp` (Task 10); `getInitData` is already sent by `CartView`.
- Produces: `<TelegramBoot />` and `npm run setup:telegram`.

- [ ] **Step 1: Component** `src/components/TelegramBoot.tsx`

```tsx
"use client";

import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getWebApp, type WebApp } from "@/lib/tg-client";

const FLAG = "tsv-tg";

/** Opened from the bot? (?tg=1 on the first page, then remembered for the session.) */
function detect(): boolean {
  try {
    return (
      new URLSearchParams(window.location.search).has("tg") ||
      window.location.hash.includes("tgWebAppData") ||
      sessionStorage.getItem(FLAG) === "1"
    );
  } catch {
    return false;
  }
}
const noSubscribe = () => () => {};

function applyTheme(wa: WebApp) {
  const theme = wa.colorScheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  wa.setHeaderColor?.("#121110");
  wa.setBackgroundColor?.(theme === "dark" ? "#121110" : "#ffffff");
}

/** Turns the site into a Telegram Mini App when opened from the bot. Normal visitors never load the SDK. */
export function TelegramBoot() {
  const wanted = useSyncExternalStore(noSubscribe, detect, () => false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Telegram has no browser back button: show its native one everywhere except the home page.
  useEffect(() => {
    const wa = getWebApp();
    if (!ready || !wa?.BackButton) return;
    const back = () => router.back();
    if (/^\/(ru|uz)\/?$/.test(pathname)) wa.BackButton.hide();
    else wa.BackButton.show();
    wa.BackButton.onClick(back);
    return () => wa.BackButton?.offClick(back);
  }, [ready, pathname, router]);

  if (!wanted) return null;
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onLoad={() => {
        const wa = getWebApp();
        if (!wa) return; // ?tg=1 opened in a normal browser
        try {
          sessionStorage.setItem(FLAG, "1");
        } catch {
          // ignore
        }
        wa.ready();
        wa.expand();
        applyTheme(wa);
        wa.onEvent?.("themeChanged", () => applyTheme(wa));
        setReady(true);
      }}
    />
  );
}
```

In `src/app/[locale]/layout.tsx`, import it and render `<TelegramBoot />` right after `<CartBar locale={locale} />`.

- [ ] **Step 2: Setup script** `scripts/setup-telegram.ts`

```ts
/**
 * One-time bot setup after deploying: webhook (with secret), menu button → Mini App, /start command.
 *   npm run setup:telegram
 */
async function call<T>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

async function main() {
  const token = process.env.TG_BOT_TOKEN;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const secret = process.env.TG_WEBHOOK_SECRET;
  if (!token || !site || !secret) throw new Error("Set TG_BOT_TOKEN, NEXT_PUBLIC_SITE_URL and TG_WEBHOOK_SECRET in .env.local");
  if (!site.startsWith("https://")) throw new Error("NEXT_PUBLIC_SITE_URL must be the public https:// URL — Telegram requires https");

  const me = await call<{ username: string }>(token, "getMe");
  await call(token, "setWebhook", {
    url: `${site}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await call(token, "setChatMenuButton", {
    menu_button: { type: "web_app", text: "Магазин", web_app: { url: `${site}/ru?tg=1` } },
  });
  await call(token, "setMyCommands", { commands: [{ command: "start", description: "Открыть магазин / Doʻkonni ochish" }] });

  console.log(`✓ @${me.username}: webhook → ${site}/api/telegram/webhook`);
  console.log(`  Set NEXT_PUBLIC_TG_BOT_USERNAME=${me.username}`);
  console.log("  Next: add the bot to the admin group, send /chatid there, put the number in TG_ADMIN_CHAT_ID, redeploy.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Static checks.** Run `npm run lint && npm run typecheck`; expect no errors.

- [ ] **Step 4: Browser check**

1. `/ru` (no `tg`): Network shows no request to telegram.org.
2. `/ru?tg=1`: telegram-web-app.js loads, the console shows no errors, and the page works normally (outside Telegram
   `initData` is empty, so the order stays a web order). The `sessionStorage['tsv-tg']` flag is not set, because
   `getWebApp()` returned null.
3. A simulated Mini App, run with `javascript_tool` before clicking around:
   `window.Telegram = { WebApp: { initData: 'x', colorScheme: 'dark', ready(){}, expand(){}, BackButton: { show(){ window.__bb='show' }, hide(){ window.__bb='hide' }, onClick(){}, offClick(){} } } }`.
   This only exercises `getWebApp`; the real check is step 4.
4. Real Telegram: needs the user's bot token and a public https URL (the Netlify deploy), so it happens in the
   README's launch checklist (Task 14). It covers the menu button opening the shop, the dark theme following
   Telegram, and an order showing "✈️ Telegram · …" in the group plus the customer confirmation.

- [ ] **Step 5: Checkpoint.** Run `npm test`. Do not commit.

---

### Task 14: SEO files, Netlify config, README, final verification

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/icon.svg`, `netlify.toml`, `README.md` (replace the
  generated one), `PLAN.md` (a copy of this plan)
- Test: full suite + production build + production-mode browser walkthrough

**Interfaces:**
- Consumes: everything above.
- Produces: `/sitemap.xml`, `/robots.txt`, `/icon.svg`, a deployable Netlify config, and the docs.

- [ ] **Step 1: SEO files**

`src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { locales } from "@/i18n";
import { getCategories, getProducts } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const paths: { path: string; lastModified?: string }[] = [
    { path: "" },
    ...categories.map((c) => ({ path: `/c/${c.slug}` })),
    ...products.map((p) => ({ path: `/p/${p.slug}`, lastModified: p.created_at })),
  ];
  return paths.flatMap(({ path, lastModified }) =>
    locales.map((locale) => ({
      url: absoluteUrl(`/${locale}${path}`),
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(`/${l}${path}`)])) },
    })),
  );
}
```

`src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ru/cart", "/uz/cart"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
```

`src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#121110"/>
  <text x="32" y="41" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="21" letter-spacing="1.5" fill="#D9BF95">TSV</text>
</svg>
```

If `/icon.svg` doesn't show up as `<link rel="icon">` on `/ru` (the root layout lives under `[locale]`), move the
file to `src/app/[locale]/icon.svg` and check again.

- [ ] **Step 2: `netlify.toml`**

```toml
# Netlify detects Next.js and uses its OpenNext adapter automatically.
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "22"

[functions]
  directory = "netlify/functions"
```

- [ ] **Step 3: README.md** (replace the create-next-app one). Use exactly these sections, in this order, and keep
  each one short and concrete:
  1. **What this is.** Two sentences and the order flow diagram from spec §2.
  2. **Run it locally.** Docker, `npm i`, `npm run db:start`, `.env.local` from `npx supabase status -o env`,
     `npm run demo:photos`, `npm run dev`.
  3. **Tests.** `npm test`, and `npm run test:int` (needs the local stack).
  4. **Add or edit a product.** The 4-step workflow from spec §4, with an example
     `npm run photos -- my-dress ~/Downloads/dress/*.jpg`. Also: how to mark a size sold out (`sold_out_sizes`), hide
     a product (`is_published`), and add a colour (`colors` + `product_colors`).
  5. **Launch checklist.**
     1. Create the Supabase project. Run `npx supabase link` then `npx supabase db push`. Do not run the seed in
        production.
     2. Create a Database Webhook on `products`, `categories`, `colors` and `product_colors`
        (insert/update/delete) → `POST https://<site>/api/revalidate` with header `x-revalidate-secret`.
     3. Create the Netlify site from the folder (`npx netlify-cli deploy --build`, or connect a git repo) and set
        every variable from `.env.example`.
     4. Create the bot in @BotFather, then run `npm run setup:telegram`.
     5. Make the admin group, add the bot, send `/chatid`, set `TG_ADMIN_CHAT_ID`, redeploy.
     6. Place a test order on the phone, and also from the Mini App.
     7. Replace `public/hero.webp` with a real brand photo (1600×1000, WebP ≤ 150 KB).
  6. **Free-tier budget.** The table from spec §2 and what to do when you outgrow it.
  7. **Project map.** The File Map from this plan.

- [ ] **Step 4: Copy the plan into the project root.** User rule: plans also live in `PLAN.md`.

```bash
cp docs/superpowers/plans/2026-10-08-tsv-shop.md PLAN.md
```

- [ ] **Step 5: Full verification**

```bash
npm run lint && npm run typecheck && npm test && npm run test:int && npm run build
```

Expected: everything green. The build output lists `/[locale]` and `/[locale]/p/[slug]` as SSG with ISR (revalidate
1h). If the Turbopack production build fails on something adapter-related, try `next build --webpack` and note it
in the README.

- [ ] **Step 6: Production-mode walkthrough.** Run `npm run start` and use the browser at mobile 375×812, then desktop:
  1. `/` → `/ru`; hero; grid; tabs; product; add 2 items; cart; order; success.
  2. The same in `/uz` with the dark theme.
  3. `/sitemap.xml` lists both locales with alternates; `/robots.txt` disallows `/api/`.
  4. Product page source contains `application/ld+json` with `"priceCurrency":"UZS"`.
  5. Edit a product price in the DB with the service key, then
     `curl -X POST localhost:3000/api/revalidate -H "x-revalidate-secret: $REVALIDATE_SECRET"`. A reload shows the new
     price, which proves on-demand revalidation in a production build.
  6. Keyboard only: Tab through header → menu → product → add → cart → form. Focus is always visible, Esc closes
     the menu.

- [ ] **Step 7: Final checkpoint.** Report to the user what was built, what was verified, and what only they can do
  (accounts, tokens, hero photo, real products). Offer a commit in one line; do not run it.

---

## Self-Review Notes

- **Spec coverage:**

  | Spec section | Task(s) |
  |---|---|
  | §2 architecture, budget | 1, 12, 14 |
  | §3 data model, RLS | 2, 3 |
  | §4 content workflow | 6, 12 |
  | §5 storefront, look, cart, i18n | 1, 4, 5, 6, 7, 10 |
  | §6 orders, admin message, buttons, resend | 8, 9, 11, 12 |
  | §7 bot and Mini App | 11, 13 |
  | §8 security | 2, 8, 9, 11, 12 |
  | §9 errors | 9, 10 |
  | §10 testing | every task |
  | §11 phases | task order |
  | §13 user actions | the README launch checklist |

- **Deviations from the spec (deliberate):**
  - Display font is Playfair Display, because Bodoni Moda has no Cyrillic.
  - The grid uses only the 480px variant (no 1200 `srcset`) to save Supabase egress.
  - Dedupe of identical orders within 2 minutes was added (Review Focus #1).
- **Type consistency:** `CartLine.snapshot` fields match `ProductBuy` and `CartView`. `OrderItem` (Task 3) matches
  `toOrderItems` (Task 8), `adminMessage`/`customerMessage` (Task 8), and the DB `items` jsonb. `orderKeyboard` takes
  `Pick<OrderRow, "id" | "status" | "claimed_by" | "closed_by">`. `tg()` and `TelegramError` (Task 9) are used by
  the webhook (Task 11).

