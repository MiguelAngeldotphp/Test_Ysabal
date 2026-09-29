-- YSABAL · reglas de integridad de campañas, mortalidad y ventas.
-- Ejecuta este archivo DESPUÉS de esquema_ysabal.sql y 20260928_seguridad_usuarios.sql.

begin;

-- No creamos una restricción nueva sobre datos antiguos inconsistentes.
do $$
begin
  if exists (
    select 1
    from public.campanas
    where estado in ('activa', 'en_venta')
    group by galpon_id
    having count(*) > 1
  ) then
    raise exception 'Hay galpones con más de una campaña activa o en venta. Corrige esos datos antes de continuar.';
  end if;

  if exists (
    with mortalidad as (
      select campana_id,
        coalesce(sum(hembras_muertas), 0)::bigint as hembras_muertas,
        coalesce(sum(machos_muertos), 0)::bigint as machos_muertos
      from public.registros_mortalidad
      group by campana_id
    ),
    vendidas as (
      select v.campana_id,
        coalesce(sum(case when d.sexo = 'hembra' then d.cantidad_javas::bigint * d.pollos_por_java::bigint else 0 end), 0)::bigint as hembras_vendidas,
        coalesce(sum(case when d.sexo = 'macho' then d.cantidad_javas::bigint * d.pollos_por_java::bigint else 0 end), 0)::bigint as machos_vendidos
      from public.ventas v
      left join public.detalles_venta_javas d on d.venta_id = v.id
      group by v.campana_id
    )
    select 1
    from public.campanas c
    left join mortalidad m on m.campana_id = c.id
    left join vendidas v on v.campana_id = c.id
    where coalesce(m.hembras_muertas, 0) + coalesce(v.hembras_vendidas, 0) > c.hembras_iniciales
       or coalesce(m.machos_muertos, 0) + coalesce(v.machos_vendidos, 0) > c.machos_iniciales
  ) then
    raise exception 'Hay campañas donde aves muertas más vendidas superan la población inicial.';
  end if;
end;
$$;

create unique index if not exists uq_campanas_galpon_abierta
on public.campanas (galpon_id)
where estado in ('activa', 'en_venta');

-- Solo se registran pesos y mortalidad mientras la campaña está activa, y
-- nunca fuera del rango que va desde el inicio hasta hoy.
create or replace function public.validar_fecha_registro_campana()
returns trigger
language plpgsql
as $$
declare
  v_inicio date;
  v_fin date;
  v_estado text;
  v_limite date;
begin
  if tg_op = 'UPDATE' and new.campana_id is distinct from old.campana_id then
    raise exception 'No se puede cambiar la campaña de un registro ya creado.';
  end if;

  select fecha_inicio, fecha_fin, estado
    into v_inicio, v_fin, v_estado
  from public.campanas
  where id = new.campana_id
  for update;

  if not found then
    raise exception 'La campaña indicada no existe.';
  end if;

  if v_estado <> 'activa' then
    raise exception 'Solo se pueden registrar o editar pesos y mortalidad en campañas activas.';
  end if;

  v_limite := least(coalesce(v_fin, current_date), current_date);
  if new.fecha_registro < v_inicio or new.fecha_registro > v_limite then
    raise exception 'La fecha del registro debe estar entre % y %.', v_inicio, v_limite;
  end if;

  return new;
end;
$$;

-- La mortalidad acumulada, más las aves que ya se vendieron, no puede superar
-- la población inicial de cada sexo.
create or replace function public.validar_inventario_mortalidad()
returns trigger
language plpgsql
as $$
declare
  v_campana_id uuid;
  v_hembras_iniciales integer;
  v_machos_iniciales integer;
  v_hembras_muertas bigint;
  v_machos_muertos bigint;
  v_hembras_vendidas bigint;
  v_machos_vendidos bigint;
begin
  v_campana_id := case when tg_op = 'DELETE' then old.campana_id else new.campana_id end;

  select hembras_iniciales, machos_iniciales
    into v_hembras_iniciales, v_machos_iniciales
  from public.campanas
  where id = v_campana_id
  for update;

  if not found then
    if tg_op = 'DELETE' then return null; end if;
    raise exception 'La campaña indicada no existe.';
  end if;

  select coalesce(sum(hembras_muertas), 0), coalesce(sum(machos_muertos), 0)
    into v_hembras_muertas, v_machos_muertos
  from public.registros_mortalidad
  where campana_id = v_campana_id;

  select
    coalesce(sum(case when d.sexo = 'hembra' then d.cantidad_javas::bigint * d.pollos_por_java::bigint else 0 end), 0),
    coalesce(sum(case when d.sexo = 'macho' then d.cantidad_javas::bigint * d.pollos_por_java::bigint else 0 end), 0)
    into v_hembras_vendidas, v_machos_vendidos
  from public.detalles_venta_javas d
  join public.ventas v on v.id = d.venta_id
  where v.campana_id = v_campana_id;

  if v_hembras_muertas + v_hembras_vendidas > v_hembras_iniciales then
    raise exception 'La mortalidad registrada supera las hembras disponibles de la campaña.';
  end if;
  if v_machos_muertos + v_machos_vendidos > v_machos_iniciales then
    raise exception 'La mortalidad registrada supera los machos disponibles de la campaña.';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_validar_inventario_mortalidad on public.registros_mortalidad;
create trigger trg_validar_inventario_mortalidad
after insert or update or delete on public.registros_mortalidad
for each row execute function public.validar_inventario_mortalidad();

-- Las ventas y grupos no se pueden mover ni editar cuando termina la venta.
create or replace function public.validar_venta_campana()
returns trigger
language plpgsql
as $$
declare
  v_campana_id uuid;
  v_estado text;
  v_fecha_fin date;
begin
  if tg_op = 'UPDATE' and new.campana_id is distinct from old.campana_id then
    raise exception 'No se puede mover una venta a otra campaña.';
  end if;

  v_campana_id := case when tg_op = 'DELETE' then old.campana_id else new.campana_id end;
  select estado, fecha_fin into v_estado, v_fecha_fin
  from public.campanas where id = v_campana_id for update;

  if not found then raise exception 'La campaña indicada no existe.'; end if;
  if v_estado <> 'en_venta' then
    raise exception 'Las ventas solo se pueden modificar mientras la campaña esté en venta.';
  end if;

  if tg_op <> 'DELETE' then
    if v_fecha_fin is null or new.fecha_venta < v_fecha_fin or new.fecha_venta > current_date then
      raise exception 'La fecha de venta debe estar entre el cierre de campaña y hoy.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_validar_venta_campana on public.ventas;
drop trigger if exists trg_validar_venta_campana_insert on public.ventas;
drop trigger if exists trg_validar_venta_campana_update on public.ventas;
drop trigger if exists trg_validar_venta_campana_delete on public.ventas;

create trigger trg_validar_venta_campana_insert
before insert on public.ventas
for each row execute function public.validar_venta_campana();

create trigger trg_validar_venta_campana_update
before update of campana_id, cliente, fecha_venta, precio_por_kilo on public.ventas
for each row execute function public.validar_venta_campana();

create trigger trg_validar_venta_campana_delete
before delete on public.ventas
for each row execute function public.validar_venta_campana();

create or replace function public.validar_mutacion_detalle_venta()
returns trigger
language plpgsql
as $$
declare
  v_venta_id uuid;
  v_estado text;
begin
  if tg_op = 'UPDATE' and new.venta_id is distinct from old.venta_id then
    raise exception 'No se puede mover un grupo de javas a otra venta.';
  end if;

  v_venta_id := case when tg_op = 'DELETE' then old.venta_id else new.venta_id end;
  select c.estado into v_estado
  from public.ventas v
  join public.campanas c on c.id = v.campana_id
  where v.id = v_venta_id
  for update of c;

  if not found and tg_op = 'DELETE' then return old; end if;
  if not found then raise exception 'La venta indicada no existe.'; end if;
  if v_estado <> 'en_venta' then
    raise exception 'Los grupos de javas solo se pueden modificar mientras la campaña esté en venta.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_validar_mutacion_detalle_venta on public.detalles_venta_javas;
create trigger trg_validar_mutacion_detalle_venta
before insert or update or delete on public.detalles_venta_javas
for each row execute function public.validar_mutacion_detalle_venta();

-- Valida stock por sexo usando un bloqueo sobre la campaña para que dos
-- registros simultáneos no puedan vender la misma ave.
create or replace function public.validar_inventario_venta()
returns trigger
language plpgsql
as $$
declare
  v_campana_id uuid;
  v_hembras_iniciales integer;
  v_machos_iniciales integer;
  v_hembras_muertas bigint;
  v_machos_muertos bigint;
  v_hembras_vendidas bigint;
  v_machos_vendidos bigint;
begin
  if tg_op = 'DELETE' then return null; end if;

  select campana_id into v_campana_id
  from public.ventas where id = new.venta_id;
  if not found then raise exception 'La venta indicada no existe.'; end if;

  select hembras_iniciales, machos_iniciales
    into v_hembras_iniciales, v_machos_iniciales
  from public.campanas where id = v_campana_id for update;

  select coalesce(sum(hembras_muertas), 0), coalesce(sum(machos_muertos), 0)
    into v_hembras_muertas, v_machos_muertos
  from public.registros_mortalidad where campana_id = v_campana_id;

  select
    coalesce(sum(case when d.sexo = 'hembra' then d.cantidad_javas::bigint * d.pollos_por_java::bigint else 0 end), 0),
    coalesce(sum(case when d.sexo = 'macho' then d.cantidad_javas::bigint * d.pollos_por_java::bigint else 0 end), 0)
    into v_hembras_vendidas, v_machos_vendidos
  from public.detalles_venta_javas d
  join public.ventas v on v.id = d.venta_id
  where v.campana_id = v_campana_id;

  if v_hembras_muertas + v_hembras_vendidas > v_hembras_iniciales then
    raise exception 'La venta supera las hembras disponibles.';
  end if;
  if v_machos_muertos + v_machos_vendidos > v_machos_iniciales then
    raise exception 'La venta supera los machos disponibles.';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_validar_inventario_venta on public.detalles_venta_javas;
create trigger trg_validar_inventario_venta
after insert or update or delete on public.detalles_venta_javas
for each row execute function public.validar_inventario_venta();

-- Los totales se recalculan tanto al editar javas como al cambiar el precio.
create or replace function public.recalcular_totales_venta_por_id(p_venta_id uuid)
returns void
language plpgsql
as $$
begin
  update public.ventas v
  set
    total_bruto = coalesce((
      select round(sum(d.cantidad_javas * d.peso_java_con_aves_kg * v.precio_por_kilo), 2)
      from public.detalles_venta_javas d where d.venta_id = v.id
    ), 0),
    total_neto = coalesce((
      select round(sum(d.cantidad_javas * (d.peso_java_con_aves_kg - d.peso_java_kg) * v.precio_por_kilo), 2)
      from public.detalles_venta_javas d where d.venta_id = v.id
    ), 0)
  where v.id = p_venta_id;
end;
$$;

create or replace function public.recalcular_totales_venta()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_totales_venta_por_id(old.venta_id);
  elsif tg_op = 'UPDATE' then
    perform public.recalcular_totales_venta_por_id(old.venta_id);
    if new.venta_id is distinct from old.venta_id then
      perform public.recalcular_totales_venta_por_id(new.venta_id);
    end if;
  else
    perform public.recalcular_totales_venta_por_id(new.venta_id);
  end if;
  return null;
end;
$$;

create or replace function public.recalcular_totales_por_cambio_precio()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_totales_venta_por_id(new.id);
  return new;
end;
$$;

drop trigger if exists trg_recalcular_totales_venta on public.detalles_venta_javas;
drop trigger if exists trg_recalcular_totales_por_precio on public.ventas;

create trigger trg_recalcular_totales_venta
after insert or update or delete on public.detalles_venta_javas
for each row execute function public.recalcular_totales_venta();

create trigger trg_recalcular_totales_por_precio
after update of precio_por_kilo on public.ventas
for each row
when (old.precio_por_kilo is distinct from new.precio_por_kilo)
execute function public.recalcular_totales_por_cambio_precio();

-- Corrige totales de ventas anteriores.
do $$
declare
  v_venta_id uuid;
begin
  for v_venta_id in select id from public.ventas loop
    perform public.recalcular_totales_venta_por_id(v_venta_id);
  end loop;
end;
$$;

-- Las fechas de cierre no pueden ser futuras ni anteriores a los registros.
create or replace function public.terminar_campana(
  p_campana_id uuid,
  p_fecha_fin date default current_date
)
returns void
language plpgsql
as $$
declare
  v_campana public.campanas%rowtype;
  v_ultimo_registro date;
begin
  select * into v_campana
  from public.campanas where id = p_campana_id for update;

  if not found or v_campana.estado <> 'activa' then
    raise exception 'Solo se pueden terminar campañas activas.';
  end if;
  if p_fecha_fin is null or p_fecha_fin < v_campana.fecha_inicio or p_fecha_fin > current_date then
    raise exception 'La fecha de fin debe estar entre % y hoy.', v_campana.fecha_inicio;
  end if;

  select max(fecha_registro) into v_ultimo_registro
  from (
    select fecha_registro from public.registros_mortalidad where campana_id = p_campana_id
    union all
    select fecha_registro from public.registros_peso where campana_id = p_campana_id
  ) registros;

  if v_ultimo_registro is not null and v_ultimo_registro > p_fecha_fin then
    raise exception 'No se puede terminar la campaña antes del último registro (%).', v_ultimo_registro;
  end if;

  update public.campanas
  set fecha_fin = p_fecha_fin, estado = 'en_venta'
  where id = p_campana_id;
end;
$$;

create or replace function public.terminar_venta(
  p_campana_id uuid,
  p_fecha_fin date default current_date
)
returns void
language plpgsql
as $$
declare
  v_campana public.campanas%rowtype;
  v_ultima_venta date;
begin
  select * into v_campana
  from public.campanas where id = p_campana_id for update;

  if not found or v_campana.estado <> 'en_venta' then
    raise exception 'Solo se pueden terminar ventas de campañas en venta.';
  end if;
  if v_campana.fecha_fin is null or p_fecha_fin is null
    or p_fecha_fin < v_campana.fecha_fin or p_fecha_fin > current_date then
    raise exception 'La fecha de fin de venta debe estar entre el cierre de campaña y hoy.';
  end if;

  select max(fecha_venta) into v_ultima_venta
  from public.ventas where campana_id = p_campana_id;
  if v_ultima_venta is not null and v_ultima_venta > p_fecha_fin then
    raise exception 'No se puede terminar la venta antes de la última venta registrada (%).', v_ultima_venta;
  end if;

  update public.campanas c
  set
    estado = 'finalizada',
    venta_finalizada_en = p_fecha_fin,
    perdida_hembras = greatest(c.hembras_iniciales - coalesce((
      select sum(r.hembras_muertas) from public.registros_mortalidad r where r.campana_id = c.id
    ), 0) - coalesce((
      select sum(d.cantidad_javas * d.pollos_por_java)
      from public.detalles_venta_javas d
      join public.ventas v on v.id = d.venta_id
      where v.campana_id = c.id and d.sexo = 'hembra'
    ), 0), 0),
    perdida_machos = greatest(c.machos_iniciales - coalesce((
      select sum(r.machos_muertos) from public.registros_mortalidad r where r.campana_id = c.id
    ), 0) - coalesce((
      select sum(d.cantidad_javas * d.pollos_por_java)
      from public.detalles_venta_javas d
      join public.ventas v on v.id = d.venta_id
      where v.campana_id = c.id and d.sexo = 'macho'
    ), 0), 0)
  where c.id = p_campana_id;
end;
$$;

commit;
