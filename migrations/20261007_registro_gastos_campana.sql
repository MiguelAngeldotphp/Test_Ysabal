-- YSABAL · registro de ingresos y egresos por campaña.
-- Ejecuta este archivo desde Supabase SQL Editor.

begin;

create table if not exists public.tipos_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  creado_en timestamptz not null default now()
);

create table if not exists public.descripciones_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  creado_en timestamptz not null default now()
);

create table if not exists public.formas_pago_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) >= 2),
  creado_en timestamptz not null default now()
);

create table if not exists public.gastos_campana (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references public.campanas(id) on delete cascade,
  fecha date not null,
  tipo_gasto_id uuid not null references public.tipos_gasto(id),
  descripcion_gasto_id uuid not null references public.descripciones_gasto(id),
  observacion text not null check (length(trim(observacion)) > 0),
  forma_pago_id uuid not null references public.formas_pago_gasto(id),
  bancos text[] not null check (
    cardinality(bancos) > 0
    and bancos <@ array['BCP', 'INTERBANK']::text[]
  ),
  egreso numeric(12,2),
  ingreso numeric(12,2),
  creado_en timestamptz not null default now(),
  check (
    (egreso is not null and egreso > 0 and ingreso is null)
    or (ingreso is not null and ingreso > 0 and egreso is null)
  )
);

create index if not exists idx_gastos_campana_fecha on public.gastos_campana(campana_id, fecha desc);

insert into public.tipos_gasto(nombre) values
  ('COMIDA'), ('INVERSIÓN'), ('COSTO'), ('GASTO'), ('MANTENIMIENTO'), ('MATERIALES')
on conflict (nombre) do nothing;

insert into public.descripciones_gasto(nombre) values
  ('PRE INICIO'), ('ADMINISTRATIVO'), ('POLLOS'), ('GAS'), ('CÁSCARA DE ARROZ')
on conflict (nombre) do nothing;

insert into public.formas_pago_gasto(nombre) values
  ('CRÉDITO'), ('EFECTIVO'), ('AL CONTADO')
on conflict (nombre) do nothing;

create or replace function public.validar_gasto_campana()
returns trigger
language plpgsql
as $$
declare
  v_campana_id uuid;
  v_estado text;
  v_fecha_inicio date;
begin
  if tg_op = 'UPDATE' and new.campana_id is distinct from old.campana_id then
    raise exception 'No se puede mover un gasto a otra campaña.';
  end if;

  v_campana_id := case when tg_op = 'DELETE' then old.campana_id else new.campana_id end;
  select estado, fecha_inicio into v_estado, v_fecha_inicio
  from public.campanas where id = v_campana_id for update;

  if not found then raise exception 'La campaña indicada no existe.'; end if;
  if v_estado = 'finalizada' then
    raise exception 'No se pueden modificar gastos en una campaña finalizada.';
  end if;
  if tg_op <> 'DELETE' and (new.fecha < v_fecha_inicio or new.fecha > current_date) then
    raise exception 'La fecha del gasto debe estar entre el inicio de campaña y hoy.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists validar_gasto_campana_trigger on public.gastos_campana;
create trigger validar_gasto_campana_trigger
before insert or update or delete on public.gastos_campana
for each row execute function public.validar_gasto_campana();

grant select, insert on table public.tipos_gasto, public.descripciones_gasto, public.formas_pago_gasto to authenticated;
grant select, insert, update, delete on table public.gastos_campana to authenticated;

alter table public.tipos_gasto enable row level security;
alter table public.descripciones_gasto enable row level security;
alter table public.formas_pago_gasto enable row level security;
alter table public.gastos_campana enable row level security;

drop policy if exists tipos_gasto_read on public.tipos_gasto;
drop policy if exists tipos_gasto_insert on public.tipos_gasto;
create policy tipos_gasto_read on public.tipos_gasto for select to authenticated using (true);
create policy tipos_gasto_insert on public.tipos_gasto for insert to authenticated with check (true);

drop policy if exists descripciones_gasto_read on public.descripciones_gasto;
drop policy if exists descripciones_gasto_insert on public.descripciones_gasto;
create policy descripciones_gasto_read on public.descripciones_gasto for select to authenticated using (true);
create policy descripciones_gasto_insert on public.descripciones_gasto for insert to authenticated with check (true);

drop policy if exists formas_pago_gasto_read on public.formas_pago_gasto;
drop policy if exists formas_pago_gasto_insert on public.formas_pago_gasto;
create policy formas_pago_gasto_read on public.formas_pago_gasto for select to authenticated using (true);
create policy formas_pago_gasto_insert on public.formas_pago_gasto for insert to authenticated with check (true);

drop policy if exists gastos_campana_select_own on public.gastos_campana;
drop policy if exists gastos_campana_insert_own on public.gastos_campana;
drop policy if exists gastos_campana_update_own on public.gastos_campana;
drop policy if exists gastos_campana_delete_own on public.gastos_campana;

create policy gastos_campana_select_own on public.gastos_campana for select to authenticated
using (exists (
  select 1 from public.campanas c join public.galpones g on g.id = c.galpon_id
  where c.id = gastos_campana.campana_id and g.owner_id = auth.uid()
));
create policy gastos_campana_insert_own on public.gastos_campana for insert to authenticated
with check (exists (
  select 1 from public.campanas c join public.galpones g on g.id = c.galpon_id
  where c.id = gastos_campana.campana_id and g.owner_id = auth.uid()
));
create policy gastos_campana_update_own on public.gastos_campana for update to authenticated
using (exists (
  select 1 from public.campanas c join public.galpones g on g.id = c.galpon_id
  where c.id = gastos_campana.campana_id and g.owner_id = auth.uid()
)) with check (exists (
  select 1 from public.campanas c join public.galpones g on g.id = c.galpon_id
  where c.id = gastos_campana.campana_id and g.owner_id = auth.uid()
));
create policy gastos_campana_delete_own on public.gastos_campana for delete to authenticated
using (exists (
  select 1 from public.campanas c join public.galpones g on g.id = c.galpon_id
  where c.id = gastos_campana.campana_id and g.owner_id = auth.uid()
));

commit;
