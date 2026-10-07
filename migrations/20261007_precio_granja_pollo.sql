begin;

alter table public.precios_pollo_mayorista
add column if not exists precio_granja_por_kg numeric(8, 2);

commit;
