# TSV Shop — design spec

Date: 2026-10-08
Status: design approved in conversation; written spec pending review

## 1. Goal

A web storefront for the Instagram store [@tsv.womenstore](https://www.instagram.com/tsv.womenstore/)
(women's clothing, Tashkent, 869 followers). A customer browses, adds items to a cart and leaves a phone
number. The order lands in the admins' Telegram group; an admin calls the customer to confirm size,
delivery and payment (cash on delivery). There is no online payment and no customer account.

Success means:

- A visitor from the Instagram bio link can go from the home page to a sent order in under a minute on a phone.
- Every order reaches the Telegram group with the phone number, items, sizes, colours and total. An order is
  never lost, even when Telegram is down.
- Two admins never call the same customer by accident (claim buttons).
- The developer adds a product (row + photos) without a redeploy, and it is live within seconds.
- Runs on free tiers: Netlify Free (300 credits/month) + Supabase Free.

### What the user said vs. what is assumed

Said by the user:
- Start from scratch: the old `tsv-store/` worked, but its look was wrong. Keep the old folder untouched.
- Russian + Uzbek with a switch; Russian is the default.
- Look: light theme = "noir entrance, white gallery"; dark theme = "noir gallery" (mockups in
  `.superpowers/brainstorm/`, files `visual-style-v2.html` and `order-flow.html`).
- Order flow as in the `order-flow.html` mockup: phone required, name and comment optional, no address, cash on delivery,
  products have sizes and colours, Telegram group messages in Russian.
- Telegram: claim/status buttons and a Mini App (shop inside Telegram).
- Hosting: Netlify Free + Supabase Free. (Vercel Hobby forbids commercial use; Vercel Pro was declined.)
- Admin: the Supabase dashboard; the developer manages products for now. A custom `/admin` may come later on the
  same schema.

Assumed (veto any of these):
- Product prices are always set (no "price on request").
- Availability is per size (`sold_out_sizes`) plus a whole-product `in_stock` switch. No size×colour stock matrix.
- "NEW" badge = created in the last 14 days. Products are ordered newest first.
- The hero banner uses a static image file in the repo (`public/hero.webp`), replaced by the developer.
- Both locales are URL-prefixed (`/ru/...`, `/uz/...`); `/` redirects to `/ru`.

## 2. Architecture

New project folder: `women-store/tsv-shop/`. The old `women-store/tsv-store/` stays untouched.

| Part | Choice | Job |
|---|---|---|
| Site | Next.js (App Router), TypeScript, Tailwind CSS v4 | Storefront pages, cart, API routes |
| Hosting | Netlify Free (OpenNext adapter) | Pages and functions. Development uses deploy previews (0 credits) |
| Database | Supabase Postgres (Free) | Catalog and orders |
| Photos | Supabase Storage, public bucket `products` | Served directly to browsers, so they cost no Netlify credits |
| Telegram | Bot API through a webhook route | Order messages, claim buttons, Mini App entry |
| Scheduled job | Netlify Scheduled Function, every 15 min | Re-send unsent orders; keeps the Supabase project awake |

```
Customer (browser / Telegram Mini App)
   │  pages: static HTML, revalidated by tag when the catalog changes
   ▼
Netlify (Next.js) ──read (anon key, RLS)──► Supabase: categories, colors, products
   │ POST /api/order ──insert (service key)──► Supabase: orders
   │                 ──sendMessage──────────► Telegram admin group
   │ POST /api/telegram/webhook ◄── button taps / bot commands → update orders
   │ POST /api/revalidate ◄── Supabase database webhook on catalog tables
   │ scheduled function (15 min) → resend unsent orders (also keeps Supabase awake)
   ▼
<img> → Supabase Storage public URLs (pre-resized WebP)
```

### Netlify credit budget (300/month, hard limit; the site pauses when it runs out)

| Item | Cost | Estimate |
|---|---|---|
| Production deploys | 15 each | ≤ 5/month after launch → 75 |
| Scheduled function | 10/GB-h | 2,880 runs × ~0.3 s × 1 GB ≈ 3 |
| Pages, JS, API | 20/GB + 2/10k requests | cached pages, small JS → ~5–10k visitors/month fits |
| Photos | 0 | served by Supabase, not Netlify |

Supabase Free limits that matter: 500 MB DB, 1 GB storage, 5 GB egress. Photos are pre-resized (≈40 KB grid,
≈150 KB full), so that's roughly 2–4k visitors/month of photo traffic. The upgrade path, with no rewrite: move the
bucket to Cloudflare R2 (free egress) by changing one URL builder (`lib/images.ts`), or go to Netlify Personal/Pro.

## 3. Data model (Supabase Postgres)

All tables have RLS enabled.

**categories**: `id uuid pk`, `slug text unique` (`^[a-z0-9-]+$`), `name_ru text not null`, `name_uz text`,
`sort int default 0`.

**colors**: `id uuid pk`, `name_ru text not null`, `name_uz text`, `hex text not null` (`^#[0-9a-fA-F]{6}$`).

**products**:
- `id uuid pk`, `slug text unique` (same pattern), `created_at timestamptz default now()`
- `title_ru text not null`, `title_uz text`, `description_ru text`, `description_uz text`
- `price int not null check (price > 0)` (so'm)
- `old_price int null check (old_price is null or old_price > price)`
- `category_id uuid not null references categories`
- `sizes text[] not null default '{}'`, `sold_out_sizes text[] not null default '{}' check (sold_out_sizes <@ sizes)`
- `in_stock bool not null default true`, `is_published bool not null default false`
- `images text[] not null default '{}'`: ordered image keys, e.g. `atlas-midi/1`

**product_colors**: `product_id uuid references products on delete cascade`, `color_id uuid references colors`,
`sort int default 0`, `primary key (product_id, color_id)`.

**orders**:
- `id text pk`: 6 chars from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`; regenerated on collision
- `created_at timestamptz default now()`
- `phone text not null` (`+998XXXXXXXXX`), `name text`, `comment text`
- `locale text check (locale in ('ru','uz'))`, `source text check (source in ('web','telegram'))`
- `tg_user jsonb`: verified Mini App user, or null
- `items jsonb not null`: a snapshot `[{product_id, slug, title_ru, size, color_ru, qty, unit_price, line_total}]`
- `total int not null`
- `status text not null default 'new' check (status in ('new','calling','confirmed','cancelled'))`
- `claimed_by text`, `claimed_at timestamptz`, `closed_by text`, `closed_at timestamptz`
- `tg_chat_id bigint`, `tg_message_id bigint`, `notify_attempts int default 0`, `notify_error text`
- `ip_hash text`: salted SHA-256 of the client IP, used for rate limiting only

**RLS policies:**
- `anon` may `select` from `categories` and `colors`, from `products where is_published`, and from `product_colors`
  joined to published products.
- `orders`: no policies for `anon` or `authenticated`. Only the server's service-role key touches it.
- No `anon` writes anywhere.

**Keys:**
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and never exposed to the browser.
- The browser never talks to Supabase except to load public images.

**Locale fallback:** `name_uz` / `title_uz` / `description_uz` null → use the `_ru` value.

## 4. Developer workflow for content

1. Insert or edit rows in the Supabase dashboard (Table Editor). New products start with `is_published = false`.
2. Photos: `npm run photos -- <slug> <files...>`. A local Node script with `sharp`:
   - center-crops to 3:4
   - writes WebP files at 1200×1600 (`<slug>/<n>-1200.webp`) and 480×640 (`<slug>/<n>-480.webp`)
   - uploads them to the `products` bucket with the service-role key from `.env.local`
   - sets `products.images` for that slug; `--append` adds photos instead of replacing them
3. Set `is_published = true`.
4. A Supabase Database Webhook on `products`, `categories`, `colors` and `product_colors` (insert/update/delete)
   posts to `/api/revalidate` with header `x-revalidate-secret`, and the route calls `revalidateTag('catalog')`.
   The photos script also calls this route when it finishes. Fallback: pages also revalidate hourly.

## 5. Storefront

### Routes

| Path | Page |
|---|---|
| `/` | 308 → `/ru` |
| `/{ru,uz}` | Home: noir header + hero banner ("LIMITED PIECES / Новая коллекция"), category tabs, grid of all published products |
| `/{ru,uz}/c/[slug]` | Category: same tabs, filtered grid |
| `/{ru,uz}/p/[slug]` | Product: swipeable gallery (CSS scroll-snap, counter "1 / 4"), title, price + struck old price, size chips (sold-out crossed out and disabled), colour swatches with name, "Добавить в корзину"; link to ask a question on Telegram/Instagram |
| `/{ru,uz}/cart` | Cart lines (thumb, title, size · colour, qty stepper, remove), total, form (phone*, name, comment), note "Мы позвоним… Оплата при получении", submit button with total. On success: "Спасибо! Заказ № K7Q2M9", phone echo, "Продолжить покупки" + Instagram |
| `sitemap.xml`, `robots.txt` | All published products and categories in both locales, with hreflang alternates |

Product pages: `generateStaticParams` for published products; `dynamicParams = true` for new ones; catalog reads
are cached under the tag `catalog` (whichever tagged-cache API the installed Next.js version recommends);
`revalidate = 3600` fallback. JSON-LD `Product` + `Offer`
(`priceCurrency: UZS`, availability) and `BreadcrumbList`. OG image = first product photo.

### Look (from the approved mockups)

- **Shared noir chrome:** header `#121110`, gold Bodoni Moda wordmark "TSV" + "WOMEN'S STORE" (`#D9BF95`),
  RU/UZ switch, bag icon with a count badge, hero on the home page.
- **Light theme:** content area white (`#FFFFFF`), images on `#F1F1F0`, text `#111`, edge-to-edge 2-column
  grid on phones (3–4 columns on desktop), uppercase letter-spaced Jost labels, black buttons; the cart bar is black
  with a gold total.
- **Dark theme:** content area `#121110`, image wells `#2A2621→#1C1A17`, text `#EFE8DD`, gold prices, gold cart bar.
- **Theme choice:**
  - `data-theme` on `<html>` is set before paint by a tiny inline script: saved choice
    (`localStorage`, wrapped in try/catch) → `prefers-color-scheme`.
  - The manual toggle sits in the menu.
  - Inside Telegram, the theme follows `Telegram.WebApp.colorScheme`.
- **Fonts:** Bodoni Moda (display) + Jost (UI), self-hosted via `@fontsource`. Cyrillic and Latin subsets only.
- **Accessibility floors:**
  - functional text ≥ 12px; tap targets ≥ 44px
  - WCAG AA contrast in both themes
  - visible focus rings; `prefers-reduced-motion` respected
- **Phone layout:** a sticky bottom cart bar ("КОРЗИНА · 2 — 809 000 сум →") appears when the cart isn't empty
  (not on the cart page).

### Cart

- The cart lives in `localStorage` key `tsv-cart-v1`, with try/catch. It still works for the rest of the visit
  when storage is unavailable.
- Each line is `{productId, slug, size, colorId, qty, snapshot: {title_ru, title_uz, price, image, color_ru, color_uz}}`.
  The snapshot is only for display; the server always re-prices.
- Same product + size + colour merges into one line (qty ≤ 10). Header badge and cart bar stay in sync across tabs
  through the `storage` event.
- The phone input shows a fixed `+998` prefix, accepts 9 digits (spaces and dashes allowed), and auto-formats
  `90 123 45 67`. Pasted `+998…`, `998…` and `8…` forms are normalised.

### i18n

- Typed dictionaries `ru.ts` / `uz.ts` with identical keys; a unit test enforces key parity.
- Locale is the first path segment; the switch keeps the current path.
- Prices format as `489 000 сум` (RU) / `489 000 so'm` (UZ).
- Server error codes map to localised messages on the client.

## 6. Orders

### POST /api/order

Input: `{items:[{productId,size,colorId,qty}], phone, name?, comment?, locale, website (honeypot), initData?}`.

Steps, in order:
1. **Same-origin check:** if `Origin` is present, it must match the site host. Body ≤ 20 KB, valid JSON.
2. **Honeypot:** if `website` is filled, return a fake success and store nothing.
3. **Validate:**
   - phone normalises to `+998` + 9 digits; operator codes are not enforced
   - 1–30 lines; each product exists, is published and `in_stock`
   - `size ∈ sizes` and `size ∉ sold_out_sizes`; a size is required if the product has sizes
   - `colorId` is linked to the product; a colour is required if the product has colours
   - `qty` is an integer 1–10
   - `name` ≤ 60 chars, `comment` ≤ 500 chars

   Errors return `400 {ok:false, code, lineIndex?}`.
4. **Rate limit (in Postgres, so it works across serverless instances):**
   - ≤ 5 orders per `ip_hash` per 10 min
   - ≤ 3 per phone per 10 min

   Otherwise `429 {code:'rate_limited'}`.
5. **Price from the database;** build the `items` snapshot and `total`.
6. **Mini App user:** if `initData` is present, verify it: HMAC with key `WebAppData`, `auth_date` ≤ 24 h old.
   Valid → `tg_user`, `source='telegram'`. Invalid → treated as a web order; never an error.
7. **Insert the order** (service role). On a primary-key collision, regenerate the id (max 5 tries).
8. **Notify:**
   - `sendMessage` to `TG_ADMIN_CHAT_ID` with an HTML message and the claim keyboard; store `tg_chat_id`/`tg_message_id`.
   - On failure: store `notify_error` and increment `notify_attempts`. The customer still gets success, because
     the order is safely in the DB.
9. **Customer confirmation:** if `tg_user`, send a confirmation to the customer's private chat (best effort).
10. **Response:** `200 {ok:true, id, total}`.

Database down → `503 {code:'unavailable'}`. The client then shows the Instagram/Telegram fallback links.

### Admin message (Russian, `parse_mode=HTML`, all user text escaped)

```
🛍 Новый заказ #K7Q2M9

📞 +998 90 123 45 67
👤 Дилноза
💬 Удобно после 18:00
🌐 Сайт · UZ          (or: ✈️ Telegram · <user link> · RU)

1. Платье миди с принтом — M, Чёрный × 1 — 489 000
2. Брюки со стрелками — S, Бежевый × 1 — 320 000

💰 Итого: 809 000 сум
```

Product titles link to the product page.

### Claim / status buttons

- `callback_data` is `o:<id>:<action>`, with action `take | done | cancel | reset`.
- Status goes `new` → (take) `calling` → (done) `confirmed` or (cancel) `cancelled`; `reset` takes `calling` back to `new`.
- Keyboards by status:
  - `new`: [📞 Я позвоню]
  - `calling`: [📞 Звонит: {name}] [✅ Подтверждён] [❌ Отменён] [↩️ Сбросить]
  - `confirmed` / `cancelled`: [✅ Подтверждён — {name}] or [❌ Отменён — {name}] (no actions)
- **Races:** each transition is a conditional `update … where id = $1 and status = $expected returning *`. A losing
  tap gets `answerCallbackQuery("Уже звонит: …")` and the message is redrawn from the DB row.
- **Admin's name:** Telegram `first_name` (+ `@username` when present).

### Scheduled function `resend-orders` (every 15 min)

- Selects orders with `tg_message_id is null and notify_attempts < 10 and created_at > now() - interval '2 days'`
  and retries the admin message.
- The query also counts as Supabase activity, so the free project never pauses.

## 7. Telegram bot and Mini App

### POST /api/telegram/webhook

- Rejects requests whose `X-Telegram-Bot-Api-Secret-Token` doesn't match `TG_WEBHOOK_SECRET`
  (constant-time compare). Always returns 200 to Telegram after processing, so updates aren't redelivered in a loop.
- **`callback_query`:** handled only when `message.chat.id == TG_ADMIN_CHAT_ID`; anything else gets a polite
  `answerCallbackQuery` and no change.
- **`/start` in a private chat:** greeting (RU + UZ line) with a `web_app` button "Открыть магазин / Do'konni ochish"
  → `${SITE_URL}/ru?tg=1`.
- **`/start p_<slug>`:** the button opens `${SITE_URL}/ru/p/<slug>?tg=1` instead. Product pages show a
  "Открыть в Telegram" link `t.me/<bot>?start=p_<slug>` for stories.
- **`/chatid` in a group:** replies with the chat id (a setup helper).
- Everything else is ignored.

### Mini App behaviour

- When `?tg=1` is present (and on later navigations in the session, via a `sessionStorage` flag), load
  `https://telegram.org/js/telegram-web-app.js`, then:
  - call `ready()` and `expand()`
  - apply the theme from `colorScheme`
  - send `initData` with the order
- Everything else is the same site. No separate code path for pages.

### `npm run setup:telegram`

Sets the webhook (with the secret and `allowed_updates: ["message","callback_query"]`), the menu button
(`web_app` → shop), and the commands (`/start`).

## 8. Security summary

- Secrets only in server env: `SUPABASE_SERVICE_ROLE_KEY`, `TG_BOT_TOKEN`, `TG_WEBHOOK_SECRET`,
  `REVALIDATE_SECRET`, `IP_HASH_SALT`.
- Public env: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_TG_BOT_USERNAME`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_STORE_PHONE` (optional).
- Prices are recomputed on the server; customer text is HTML-escaped for Telegram; initData is HMAC-verified;
  webhook and revalidate secrets are compared in constant time; RLS denies all browser access to orders.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, and a CSP that includes
  `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org` so the Mini App can be framed.
  No `X-Frame-Options: DENY`.
- Raw IPs are never stored (salted hash only).

## 9. Error handling (customer-visible)

| Situation | What the customer sees |
|---|---|
| Field/line validation error | Inline message at the field or cart line, in their language |
| Size sold out / product gone since it was added | That line is marked; a button removes it or changes the size |
| Rate limited | "Слишком много попыток, попробуйте через 10 минут" |
| Network failure | Cart and form are kept; "Не удалось отправить…" + retry + Instagram/Telegram links |
| DB unavailable (503) | Same as a network failure |
| Telegram down | Nothing; the customer sees success and the scheduled job re-sends |

## 10. Testing

- **Unit (Vitest):**
  - phone normalisation and formatting
  - order validation and pricing (pure function over a catalog fixture)
  - admin message text and escaping
  - initData verification (fixture signed with a test token)
  - status transitions and keyboards
  - RU/UZ dictionary key parity
  - price formatting
  - cart merge logic
- **Integration:** a local Supabase (`supabase start` via Docker, with the migrations applied and seed data).
  Route handlers are called directly with a stub Telegram server (`TG_API_BASE`). Covers:
  - RLS: anon can't read orders or unpublished products
  - order insert, collision retry and rate limits
  - Telegram failure → order kept, `notify_error` set, resend job sends it
  - webhook claim race: two concurrent `take` taps → exactly one wins
- **Manual verification in a browser:**
  - phone viewport: browse → add → order → success, in both locales and both themes
  - Telegram message and buttons against a real test bot and group, once the user provides tokens

## 11. Build phases (each ends with something runnable)

1. Scaffold `tsv-shop/` (Next.js, Tailwind, fonts, design tokens, both themes, RU/UZ routing, header and footer).
   Supabase migrations + seed (demo categories, colours, products with placeholder images). Home, category and
   product pages reading from the DB.
2. Cart (localStorage, badge, cart bar), cart page with form, `POST /api/order` with validation, DB rate limits,
   order insert, Telegram admin message, success view.
3. Webhook: claim/status buttons with conditional updates; `/chatid`; `/start` + deep links.
4. Content tooling: `npm run photos`, `/api/revalidate` + database webhook instructions; `resend-orders`
   scheduled function.
5. Mini App: conditional SDK loading, theme sync, initData on orders, customer confirmation;
   `npm run setup:telegram`.
6. SEO (sitemap, robots, JSON-LD, OG, hreflang), polish, README with the full setup:
   - Supabase project, migrations, bucket, database webhook
   - Telegram bot and group
   - Netlify site and env vars
   - how to add a product

## 12. Out of scope (now)

Custom `/admin` page, online payment, delivery address and fee calculation, customer accounts, order history for
customers, Instagram import, analytics, search, wishlists, promo codes, a size×colour stock matrix.

## 13. Things the user must do (Claude can't create accounts)

- Create the Supabase project; give the URL, anon key and service-role key (as env vars, never pasted in chat).
- Create the bot with @BotFather; create the admin group and add the bot.
- Create the Netlify site (connect the repo or use `netlify deploy`); set the env vars.
- Provide `public/hero.webp` (brand photo) and the real products/photos.
