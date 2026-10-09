# TSV Shop

Online store for [@tsv.womenstore](https://www.instagram.com/tsv.womenstore/). A customer adds clothes to the cart
and leaves a phone number. The order is saved in Supabase and posted to the admins' Telegram group, and an admin calls
the customer to confirm size, delivery and payment (cash on delivery). The same site opens inside Telegram as a Mini App.

```
Customer (browser / Telegram Mini App)
   │  pages: static HTML, refreshed when the catalog changes
   ▼
Netlify (Next.js) ──read──► Supabase: categories, colors, products
   │ POST /api/order ──save──► Supabase: orders ──► Telegram admin group (📞 Я позвоню → ✅/❌)
   │ POST /api/telegram/webhook ◄── button taps, /start, /chatid
   │ POST /api/revalidate ◄── Supabase database webhook (catalog edited)
   │ every 15 min: re-send orders that missed Telegram (also keeps Supabase awake)
   ▼
Photos: served straight from Supabase Storage (pre-resized WebP)
```

Russian at `/ru`, Uzbek at `/uz` (`/` → `/ru`). Light theme = noir header + white gallery; dark theme = noir gallery.
It follows the phone's setting, has a switch in the menu, and follows Telegram's theme inside the Mini App.

Design and decisions: [`docs/superpowers/specs/2026-10-08-tsv-shop-design.md`](docs/superpowers/specs/2026-10-08-tsv-shop-design.md).
Build plan: [`PLAN.md`](PLAN.md).

## Run it locally

Needs Node 22 and Docker Desktop.

```bash
npm install
npm run db:start                 # local Supabase in Docker (first run downloads images)
cp .env.example .env.local
npx supabase status -o env       # copy API_URL, ANON_KEY, SERVICE_ROLE_KEY into .env.local
npm run demo:photos              # placeholder photos for the demo products + public/hero.webp
npm run dev                      # http://localhost:3000
```

Set the four secrets in `.env.local` with `openssl rand -hex 32`. Without Telegram settings, orders are still
saved, and the dev terminal prints the message that would go to the group.

`npm run db:reset` re-creates the local database from `supabase/migrations` + `supabase/seed.sql`.

## Tests

```bash
npm test             # unit tests (no services needed)
npm run test:int     # integration tests against the local Supabase — they expect the demo data: npm run db:reset first
npm run lint && npm run typecheck
```

## Add or edit a product

Products are managed in the Supabase dashboard (Table Editor).

1. Insert a row in `products`. Required: `slug` (lowercase-with-dashes, used in the URL), `title_ru`, `price` (so'm),
   `category_id`. Optional: `title_uz`/`description_uz` (empty = Russian is shown), `old_price` (shown struck through),
   `sizes` (e.g. `{S,M,L}` or `{42,44,46}`). Keep `is_published = false` for now.
2. Upload photos (they are cropped to 3:4 and shrunk to WebP; 3–5 MB phone photos become ~150 KB):
   ```bash
   npm run photos -- my-dress ~/Downloads/dress/*.jpg          # replaces the photos
   npm run photos -- my-dress ~/Downloads/dress/back.jpg --append
   ```
   `npm run photos` uploads to the **local** database (`.env.local`). For the real store use
   `npm run photos:prod -- my-dress …`, which reads `.env.prod` (see the launch checklist).
3. Colours: pick or add a colour in `colors` (`name_ru`, `name_uz`, `hex`), then add a row in `product_colors`
   (`product_id`, `color_id`, `sort`).
4. Set `is_published = true`. The site updates within seconds (database webhook below).

Everyday edits:
- Size sold out: add it to `sold_out_sizes`. It shows crossed out and can't be ordered.
- Whole item sold out: `in_stock = false`.
- Hide it: `is_published = false`.

The database rejects mistakes such as price 0, an old price below the price, a sold-out size that isn't in `sizes`,
or a slug with spaces.

### Import products from Instagram

The store's posts can become products automatically: photos, plus title, price, sizes and colours read from the caption.

1. In a browser logged into Instagram, open https://www.instagram.com/tsv.womenstore/, open the console
   (Cmd+Option+J), and paste [`scripts/instagram-export.js`](scripts/instagram-export.js). It saves
   `tsv-instagram.json` (captions + photo links). If Instagram's API is rate-limited, collect the posts by opening
   them in the browser instead, the same way the first import was done.
2. Download the photos it lists into `import/instagram/photos/<post-code>-<n>.jpg` (the folder is git-ignored).
3. Check what will be created, then import:
   ```bash
   npm run import:instagram -- import/instagram/posts.json import/instagram/photos --dry-run   # writes import/instagram/report.md
   npm run import:instagram:prod -- import/instagram/posts.json import/instagram/photos          # production, hidden drafts
   ```
   Posts with the same title and price are merged into one product (photo posts first, then reel covers).
   Posts without a price, or with several products in one caption, are skipped and listed in the report.
   Products whose slug already exists are skipped, so it is safe to run again after new posts.
4. Review the drafts in Supabase (title, category, sizes, colours) and set `is_published = true`. Square collages
   are padded to 3:4 in their own background colour, never cropped.

Orders are in the `orders` table: status, who called, and a copy of the items and prices at the time of the order.

## Launch checklist

0. **`.env.prod`:** copy `.env.example` to `.env.prod` and fill in the production values (Supabase URL and keys,
   the https site URL, the bot token, the secrets). Only the scripts read it (`photos:prod`, `setup:telegram`). Next.js
   ignores it, so local runs never touch production. It is git-ignored.
1. **Supabase:** create a project (free plan).
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push            # applies supabase/migrations — do NOT run the seed in production
   ```
   Then open Supabase → SQL Editor and run `supabase/catalog-base.sql` (starting categories and colours; a product
   can't be created without a category). It is safe to run twice.
2. **Netlify:** create a site from this folder (`npx netlify-cli deploy --build`, or connect a git repo). In
   Site settings → Environment variables, add every variable from `.env.example` with production values.
   `NEXT_PUBLIC_SITE_URL` must be the final https URL.
3. **Database webhook:** in Supabase → Database → Webhooks, create one on `products`, `categories`, `colors` and
   `product_colors` (insert, update, delete):
   - Type: HTTP request, `POST https://<site>/api/revalidate`
   - Header: `x-revalidate-secret: <REVALIDATE_SECRET>`

   Check it: change a price in the Table Editor, then reload the product page. The new price should show within a
   few seconds. If it doesn't, look at the webhook's delivery log in Supabase.
4. **Telegram bot:** create it in [@BotFather](https://t.me/BotFather) (`/newbot`). Put the token in
   `TG_BOT_TOKEN` (in `.env.prod` and on Netlify), then run `npm run setup:telegram` (it reads `.env.prod`). This sets the webhook, the
   "Магазин" menu button, and `/start`. Set `NEXT_PUBLIC_TG_BOT_USERNAME` to the printed username.
5. **Admin group:** create the group and add the bot.
   - First make it a supergroup, e.g. Group settings → Chat history for new members → Visible. Telegram changes
     the chat id when a group is upgraded, and an old id silently breaks order messages.
   - Then send `/chatid` in the group, put the number (it starts with `-100`) in `TG_ADMIN_CHAT_ID`, and redeploy.
   - If orders ever stop arriving, look at `notify_error` in the `orders` table and re-run `/chatid`. Orders are
     never lost; the 15-minute job re-sends them once the id is fixed.
6. **Test:**
   - Place an order from a phone and check that it appears in the group. Tap "📞 Я позвоню", then "✅ Подтверждён".
   - Open the bot, tap "Магазин" and order from the Mini App. The group shows "✈️ Telegram", and you get a
     confirmation in the chat.
7. **Hero photo:** replace `public/hero.webp` with a real brand photo (about 1600×1000, WebP, ≤ 150 KB) and
   redeploy.
8. **Instagram:** put the site link in the profile bio. Product pages have "Открыть в Telegram" links
   (`t.me/<bot>?start=p_<slug>`) you can use in stories.

## Free-tier budget

| Service | Limit | What uses it |
|---|---|---|
| Netlify Free | 300 credits/month; **the site pauses when they run out** | 15 per production deploy, 20/GB bandwidth, 2 per 10k requests, 10/GB-hour of functions |
| Supabase Free | 500 MB DB, 1 GB storage, 5 GB egress; pauses after a week without activity | Photos (egress), orders and catalog |

**Netlify:**
- Use deploy previews while developing; they cost 0 credits.
- Keep production deploys to about 5 a month.
- Catalog edits need no deploy.

**Supabase:** the 15-minute resend job queries the database, so the project never pauses.

**When you outgrow the free tiers:**
- Netlify Personal/Pro.
- Move photos to Cloudflare R2 (free egress). Only `src/lib/images.ts` and `scripts/lib/photos.ts` need to change.

## Project map

```
src/app/[locale]/                 pages: home, c/[slug], p/[slug], cart, not-found, [...rest] (404)
src/app/api/order                 POST order → DB → Telegram
src/app/api/telegram/webhook      claim buttons, /start, /chatid
src/app/api/revalidate            catalog cache refresh (database webhook)
src/app/api/cron/resend           re-send unsent orders (Netlify scheduled function)
src/lib/catalog.ts                catalog reads (cached, tag "catalog")
src/lib/order/                    validation, pricing, messages, status machine, service
src/lib/telegram/                 Bot API client, initData check, webhook handler
src/lib/cart.ts                   cart in localStorage (works in memory when storage is blocked)
src/i18n/                         ru.ts, uz.ts (same keys, checked by a test)
supabase/migrations               schema, RLS, storage bucket
scripts/photos.ts                 photo upload CLI
netlify/functions                 resend-orders (every 15 min)
```
