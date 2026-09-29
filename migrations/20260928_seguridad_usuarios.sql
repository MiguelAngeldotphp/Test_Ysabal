-- YSABAL · acceso por usuario con Supabase Auth.
-- Ejecuta este archivo DESPUÉS de esquema_ysabal.sql, desde SQL Editor.
-- Es seguro ejecutarlo más de una vez.

begin;

-- La propiedad se guarda solo en el galpón. Todas las demás tablas se
-- autorizan atravesando sus relaciones hasta el galpón.
alter table public.galpones
  add column if not exists owner_id uuid references auth.users(id) on delete restrict;

alter table public.galpones
  alter column owner_id set default auth.uid();

create index if not exists idx_galpones_owner on public.galpones(owner_id);

-- El cliente usa la clave pública de Supabase: solo usuarios autenticados
-- reciben privilegios de tabla y RLS limita cada fila a su propietario.
grant usage on schema public to authenticated;
revoke all on table public.galpones, public.campanas, public.registros_mortalidad,
  public.registros_peso, public.ventas, public.detalles_venta_javas from anon;
grant select, insert, update, delete on table public.galpones, public.campanas,
  public.registros_mortalidad, public.registros_peso, public.ventas,
  public.detalles_venta_javas to authenticated;

-- Si ya existían filas antes de activar esta regla, owner_id seguirá vacío:
-- ningún usuario podrá verlas hasta que un administrador les asigne propietario.
-- Las nuevas filas reciben auth.uid() automáticamente.

drop policy if exists galpones_select_own on public.galpones;
drop policy if exists galpones_insert_own on public.galpones;
drop policy if exists galpones_update_own on public.galpones;
drop policy if exists galpones_delete_own on public.galpones;

create policy galpones_select_own
on public.galpones for select to authenticated
using (owner_id = auth.uid());

create policy galpones_insert_own
on public.galpones for insert to authenticated
with check (owner_id = auth.uid());

create policy galpones_update_own
on public.galpones for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy galpones_delete_own
on public.galpones for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists campanas_select_own on public.campanas;
drop policy if exists campanas_insert_own on public.campanas;
drop policy if exists campanas_update_own on public.campanas;
drop policy if exists campanas_delete_own on public.campanas;

create policy campanas_select_own
on public.campanas for select to authenticated
using (
  exists (
    select 1 from public.galpones g
    where g.id = campanas.galpon_id and g.owner_id = auth.uid()
  )
);

create policy campanas_insert_own
on public.campanas for insert to authenticated
with check (
  exists (
    select 1 from public.galpones g
    where g.id = campanas.galpon_id and g.owner_id = auth.uid()
  )
);

create policy campanas_update_own
on public.campanas for update to authenticated
using (
  exists (
    select 1 from public.galpones g
    where g.id = campanas.galpon_id and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.galpones g
    where g.id = campanas.galpon_id and g.owner_id = auth.uid()
  )
);

create policy campanas_delete_own
on public.campanas for delete to authenticated
using (
  exists (
    select 1 from public.galpones g
    where g.id = campanas.galpon_id and g.owner_id = auth.uid()
  )
);

drop policy if exists mortalidad_select_own on public.registros_mortalidad;
drop policy if exists mortalidad_insert_own on public.registros_mortalidad;
drop policy if exists mortalidad_update_own on public.registros_mortalidad;
drop policy if exists mortalidad_delete_own on public.registros_mortalidad;

create policy mortalidad_select_own
on public.registros_mortalidad for select to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_mortalidad.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy mortalidad_insert_own
on public.registros_mortalidad for insert to authenticated
with check (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_mortalidad.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy mortalidad_update_own
on public.registros_mortalidad for update to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_mortalidad.campana_id
      and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_mortalidad.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy mortalidad_delete_own
on public.registros_mortalidad for delete to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_mortalidad.campana_id
      and g.owner_id = auth.uid()
  )
);

drop policy if exists pesos_select_own on public.registros_peso;
drop policy if exists pesos_insert_own on public.registros_peso;
drop policy if exists pesos_update_own on public.registros_peso;
drop policy if exists pesos_delete_own on public.registros_peso;

create policy pesos_select_own
on public.registros_peso for select to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_peso.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy pesos_insert_own
on public.registros_peso for insert to authenticated
with check (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_peso.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy pesos_update_own
on public.registros_peso for update to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_peso.campana_id
      and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_peso.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy pesos_delete_own
on public.registros_peso for delete to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = registros_peso.campana_id
      and g.owner_id = auth.uid()
  )
);

drop policy if exists ventas_select_own on public.ventas;
drop policy if exists ventas_insert_own on public.ventas;
drop policy if exists ventas_update_own on public.ventas;
drop policy if exists ventas_delete_own on public.ventas;

create policy ventas_select_own
on public.ventas for select to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = ventas.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy ventas_insert_own
on public.ventas for insert to authenticated
with check (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = ventas.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy ventas_update_own
on public.ventas for update to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = ventas.campana_id
      and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = ventas.campana_id
      and g.owner_id = auth.uid()
  )
);

create policy ventas_delete_own
on public.ventas for delete to authenticated
using (
  exists (
    select 1
    from public.campanas c
    join public.galpones g on g.id = c.galpon_id
    where c.id = ventas.campana_id
      and g.owner_id = auth.uid()
  )
);

drop policy if exists detalles_venta_select_own on public.detalles_venta_javas;
drop policy if exists detalles_venta_insert_own on public.detalles_venta_javas;
drop policy if exists detalles_venta_update_own on public.detalles_venta_javas;
drop policy if exists detalles_venta_delete_own on public.detalles_venta_javas;

create policy detalles_venta_select_own
on public.detalles_venta_javas for select to authenticated
using (
  exists (
    select 1
    from public.ventas v
    join public.campanas c on c.id = v.campana_id
    join public.galpones g on g.id = c.galpon_id
    where v.id = detalles_venta_javas.venta_id
      and g.owner_id = auth.uid()
  )
);

create policy detalles_venta_insert_own
on public.detalles_venta_javas for insert to authenticated
with check (
  exists (
    select 1
    from public.ventas v
    join public.campanas c on c.id = v.campana_id
    join public.galpones g on g.id = c.galpon_id
    where v.id = detalles_venta_javas.venta_id
      and g.owner_id = auth.uid()
  )
);

create policy detalles_venta_update_own
on public.detalles_venta_javas for update to authenticated
using (
  exists (
    select 1
    from public.ventas v
    join public.campanas c on c.id = v.campana_id
    join public.galpones g on g.id = c.galpon_id
    where v.id = detalles_venta_javas.venta_id
      and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.ventas v
    join public.campanas c on c.id = v.campana_id
    join public.galpones g on g.id = c.galpon_id
    where v.id = detalles_venta_javas.venta_id
      and g.owner_id = auth.uid()
  )
);

create policy detalles_venta_delete_own
on public.detalles_venta_javas for delete to authenticated
using (
  exists (
    select 1
    from public.ventas v
    join public.campanas c on c.id = v.campana_id
    join public.galpones g on g.id = c.galpon_id
    where v.id = detalles_venta_javas.venta_id
      and g.owner_id = auth.uid()
  )
);

revoke all on function public.terminar_campana(uuid, date) from public, anon;
revoke all on function public.terminar_venta(uuid, date) from public, anon;
grant execute on function public.terminar_campana(uuid, date) to authenticated;
grant execute on function public.terminar_venta(uuid, date) to authenticated;

commit;
