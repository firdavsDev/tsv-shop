-- Idempotency key sent by the cart page. A unique constraint makes double submits (two taps, a retry after a lost
-- response) resolve to one order atomically, even when the requests arrive at the same moment.
alter table public.orders
  add column client_key text check (client_key is null or client_key ~ '^[A-Za-z0-9-]{8,64}$');

create unique index orders_client_key_idx on public.orders (client_key) where client_key is not null;
