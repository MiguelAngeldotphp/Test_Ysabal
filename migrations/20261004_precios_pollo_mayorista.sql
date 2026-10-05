begin;

create table if not exists public.precios_pollo_mayorista (
  fecha_boletin date primary key,
  precio_por_kg numeric(8, 2) not null check (precio_por_kg > 0),
  fuente_url text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.precios_pollo_mayorista enable row level security;

drop policy if exists precios_pollo_mayorista_select_authenticated on public.precios_pollo_mayorista;
create policy precios_pollo_mayorista_select_authenticated
on public.precios_pollo_mayorista for select to authenticated
using (true);

commit;
