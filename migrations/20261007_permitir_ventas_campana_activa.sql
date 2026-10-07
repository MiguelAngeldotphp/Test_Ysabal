begin;

-- Las ventas pueden realizarse desde el inicio de la campaña y hasta que se finalice la venta.
create or replace function public.validar_venta_campana()
returns trigger
language plpgsql
as $$
declare
  v_campana_id uuid;
  v_estado text;
  v_fecha_inicio date;
begin
  if tg_op = 'UPDATE' and new.campana_id is distinct from old.campana_id then
    raise exception 'No se puede mover una venta a otra campaña.';
  end if;

  v_campana_id := case when tg_op = 'DELETE' then old.campana_id else new.campana_id end;
  select estado, fecha_inicio into v_estado, v_fecha_inicio
  from public.campanas where id = v_campana_id for update;

  if not found then raise exception 'La campaña indicada no existe.'; end if;
  if v_estado not in ('activa', 'en_venta') then
    raise exception 'Las ventas solo se pueden modificar en campañas activas o en venta.';
  end if;

  if tg_op <> 'DELETE' and (new.fecha_venta < v_fecha_inicio or new.fecha_venta > current_date) then
    raise exception 'La fecha de venta debe estar entre el inicio de campaña y hoy.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

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
  if v_estado not in ('activa', 'en_venta') then
    raise exception 'Los grupos de javas solo se pueden modificar en campañas activas o en venta.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

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

  select max(fecha) into v_ultimo_registro
  from (
    select fecha_registro as fecha from public.registros_mortalidad where campana_id = p_campana_id
    union all
    select fecha_registro as fecha from public.registros_peso where campana_id = p_campana_id
    union all
    select fecha_venta as fecha from public.ventas where campana_id = p_campana_id
  ) registros;

  if v_ultimo_registro is not null and v_ultimo_registro > p_fecha_fin then
    raise exception 'No se puede terminar la campaña antes del último registro (%).', v_ultimo_registro;
  end if;

  update public.campanas
  set fecha_fin = p_fecha_fin, estado = 'en_venta'
  where id = p_campana_id;
end;
$$;

commit;
