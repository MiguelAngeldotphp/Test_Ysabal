-- YSABAL · edición y eliminación segura de registros.
-- Ejecuta este archivo después de las migraciones anteriores.

begin;

-- La edición ya se valida con validar_fecha_registro_campana(). Esta regla
-- completa el caso de eliminación para que ningún registro pueda alterarse
-- una vez que la campaña se cerró.
create or replace function public.validar_eliminacion_registro_campana()
returns trigger
language plpgsql
as $$
declare
  v_estado text;
begin
  select estado
    into v_estado
  from public.campanas
  where id = old.campana_id
  for update;

  if not found then
    raise exception 'La campaña indicada no existe.';
  end if;

  if v_estado <> 'activa' then
    raise exception 'Solo se pueden eliminar registros de campañas activas.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_validar_eliminacion_mortalidad on public.registros_mortalidad;
create trigger trg_validar_eliminacion_mortalidad
before delete on public.registros_mortalidad
for each row execute function public.validar_eliminacion_registro_campana();

drop trigger if exists trg_validar_eliminacion_peso on public.registros_peso;
create trigger trg_validar_eliminacion_peso
before delete on public.registros_peso
for each row execute function public.validar_eliminacion_registro_campana();

commit;
