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
