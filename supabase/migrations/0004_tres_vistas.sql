-- NavIA · corte 2: tres vistas (fiscal, conductor, estudiante) y demo por enlace.
--
-- 1) Unidades con foto y disponibilidad: el conductor marca su unidad "disponible";
--    "en ruta" se deriva de la salida activa. Fiscal y estudiante ven la foto y la placa.
-- 2) Fotos en Storage (bucket público "unidades"); solo el fiscal las sube.
-- 3) reset_demo_today(): deja las salidas de hoy como al inicio del día para repetir el tour.

-- ───────────── 1. Unidades ─────────────
alter table vehicles
  add column if not exists photo_url    text,
  add column if not exists available    boolean not null default false,
  add column if not exists available_at timestamptz;

-- La placa y la foto identifican la unidad ante el estudiante: lectura para toda sesión.
drop policy if exists vehicles_staff on vehicles;
create policy vehicles_read on vehicles for select to authenticated using (true);
create policy vehicles_coord_update on vehicles for update
  using (my_role() in ('coordinator', 'admin') and operator_id = my_operator())
  with check (operator_id = my_operator());

-- El conductor solo cambia la disponibilidad de una unidad que maneja hoy.
create or replace function set_vehicle_available(p_vehicle_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from trips t
    where t.vehicle_id = p_vehicle_id and t.driver_id = auth.uid()
      and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
  ) then
    raise exception 'Esta unidad no está asignada a ti hoy' using errcode = '42501';
  end if;
  update vehicles set available = p_available, available_at = now() where id = p_vehicle_id;
end $$;
revoke execute on function set_vehicle_available(uuid, boolean) from public, anon;
grant execute on function set_vehicle_available(uuid, boolean) to authenticated;

-- El fiscal ve a quién lleva cada salida (nombre del conductor).
-- profiles_self ya permite al coordinador leer perfiles; nada que cambiar.

-- ───────────── 2. Fotos en Storage ─────────────
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('unidades', 'unidades', true)
    on conflict (id) do update set public = true;

    execute $p$
      create policy unidades_coord_write on storage.objects for all to authenticated
      using (bucket_id = 'unidades' and public.my_role() in ('coordinator', 'admin'))
      with check (bucket_id = 'unidades' and public.my_role() in ('coordinator', 'admin'))
    $p$;
  end if;
end $$;

-- ───────────── 3. Reinicio de la demo ─────────────
-- Si hoy no hay salidas, copia el horario del último día que tuvo (mismas horas, unidad y
-- conductor). Luego deja todas las salidas de hoy del operador como "programadas", sin
-- ubicación ni paradas visitadas, y las unidades como no disponibles.
-- Solo para fiscal o admin. Los eventos quedan en trip_events como historial.
create or replace function reset_demo_today() returns int
language plpgsql security definer set search_path = public as $$
declare
  op         uuid := my_operator();
  today      date := (now() at time zone 'America/Caracas')::date;
  last_day   date;
  n          int;
begin
  if my_role() not in ('coordinator', 'admin') or op is null then
    raise exception 'Solo el fiscal puede reiniciar la demo' using errcode = '42501';
  end if;

  if not exists (
    select 1 from trips t join routes r on r.id = t.route_id
    where r.operator_id = op and (t.scheduled_at at time zone 'America/Caracas')::date = today
  ) then
    select max((t.scheduled_at at time zone 'America/Caracas')::date) into last_day
    from trips t join routes r on r.id = t.route_id
    where r.operator_id = op and (t.scheduled_at at time zone 'America/Caracas')::date < today;

    insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
    select t.route_id, t.vehicle_id, t.driver_id,
           (today + (t.scheduled_at at time zone 'America/Caracas')::time) at time zone 'America/Caracas'
    from trips t join routes r on r.id = t.route_id
    where r.operator_id = op and r.active
      and (t.scheduled_at at time zone 'America/Caracas')::date = last_day
      and t.status <> 'cancelada'
    on conflict (route_id, scheduled_at) do nothing;
  end if;

  delete from stop_visits v using trips t, routes r
  where v.trip_id = t.id and r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;

  update trips t set status = 'scheduled', current_stop_id = null, last_lat = null, last_lng = null,
                     last_seen_at = null, started_at = null, ended_at = null
  from routes r
  where r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;
  get diagnostics n = row_count;

  update vehicles set available = false, available_at = now() where operator_id = op;
  return n;
end $$;
revoke execute on function reset_demo_today() from public, anon;
grant execute on function reset_demo_today() to authenticated;

-- Realtime de unidades: el fiscal y el estudiante ven al instante cuando una pasa a disponible.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table vehicles;
  end if;
end $$;
