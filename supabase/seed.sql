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
