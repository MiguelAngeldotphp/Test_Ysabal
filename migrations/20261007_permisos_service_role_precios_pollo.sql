begin;

grant select, insert, update
on table public.precios_pollo_mayorista
to service_role;

commit;
