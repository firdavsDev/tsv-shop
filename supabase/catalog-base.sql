-- Starting categories and colour palette for PRODUCTION (no demo products).
-- Run once in Supabase → SQL Editor after `npx supabase db push`. Safe to run again: existing rows are skipped.
-- Edit names/hex values freely; products reference categories by id, colours via product_colors.

insert into public.categories (slug, name_ru, name_uz, sort) values
  ('korsety-topy', 'Корсеты и топы', 'Korset va toplar', 1),
  ('platya', 'Платья', 'Koʻylaklar', 2),
  ('kostyumy', 'Костюмы и комплекты', 'Kostyum va toʻplamlar', 3),
  ('zhakety', 'Жакеты и пиджаки', 'Jaket va pidjaklar', 4),
  ('bryuki', 'Брюки и джинсы', 'Shim va jinsilar', 5),
  ('verhnyaya-odezhda', 'Верхняя одежда', 'Ustki kiyim', 6)
on conflict (slug) do nothing;

insert into public.colors (name_ru, name_uz, hex)
select v.name_ru, v.name_uz, v.hex
from (values
  ('Чёрный', 'Qora', '#1d1d1d'),
  ('Белый', 'Oq', '#f7f7f5'),
  ('Молочный', 'Sutrang', '#efe6d6'),
  ('Бежевый', 'Bej', '#d8c3a5'),
  ('Шампань', 'Shampan', '#e7d3b0'),
  ('Графит', 'Grafit', '#3b3b3d')
) as v(name_ru, name_uz, hex)
where not exists (select 1 from public.colors c where c.name_ru = v.name_ru);
