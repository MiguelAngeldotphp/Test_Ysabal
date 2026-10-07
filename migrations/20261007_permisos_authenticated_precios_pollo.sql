begin;

grant select
on table public.precios_pollo_mayorista
to authenticated;

commit;
