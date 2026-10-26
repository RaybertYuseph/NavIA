-- NavIA · corte 2: salidas sin horario fijo y "Deshacer" del conductor.
--
-- Salidas flexibles. Una salida aparece de dos formas:
--   a) el fiscal la crea con ruta y hora y queda "pendiente de unidad" (vehicle_id y driver_id
--      en null): create_departure();
--   b) el conductor toca "Estoy disponible en {parada de salida}": set_available_at_stop() le
--      asigna la salida pendiente más próxima de esa ruta o, si no hay, crea una para ahora.
-- Al dejar de estar disponible, la salida que no ha arrancado vuelve a quedar pendiente.
-- Por eso las salidas nuevas ya no toman unidad solas (se quita el trigger de 0007).
--
-- Deshacer. Nuevo evento 'correccion' con el estado a restaurar (restore_status, restore_stop_id).
-- apply_trip_event lo aplica: desmarca las paradas posteriores (borra su stop_visit), reabre las
-- esperas recogidas en ellas y limpia ended_at si se deshace un fin de ruta. Los eventos quedan
-- como historial; la cola offline sigue siendo idempotente por client_event_id.

drop trigger if exists trips_default_vehicle on trips;
drop function if exists trips_default_vehicle();

-- ───────────── Salidas flexibles ─────────────
alter table vehicles
  add column if not exists available_route_id  uuid references routes (id) on delete set null,
  add column if not exists available_driver_id uuid references profiles (id) on delete set null;

-- El fiscal crea una salida de hoy (o futura) sin unidad.
create or replace function create_departure(p_route_id uuid, p_scheduled_at timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  op uuid := my_operator();
  new_id uuid;
begin
  if my_role() not in ('coordinator', 'admin') or op is null then
    raise exception 'Solo el fiscal crea salidas' using errcode = '42501';
  end if;
  if not exists (select 1 from routes where id = p_route_id and operator_id = op and active and not coming_soon) then
    raise exception 'Esa ruta no está disponible' using errcode = '22023';
  end if;
  if (p_scheduled_at at time zone 'America/Caracas')::date < (now() at time zone 'America/Caracas')::date then
    raise exception 'La hora ya pasó' using errcode = '22023';
  end if;
  insert into trips (route_id, scheduled_at) values (p_route_id, p_scheduled_at)
  on conflict (route_id, scheduled_at) do nothing
  returning id into new_id;
  if new_id is null then
    raise exception 'Ya hay una salida de esa ruta a esa hora' using errcode = '23505';
  end if;
  return new_id;
end $$;
revoke execute on function create_departure(uuid, timestamptz) from public, anon;
grant execute on function create_departure(uuid, timestamptz) to authenticated;

-- El conductor se activa disponible en la parada de salida de una ruta con una unidad de su línea.
-- Devuelve la salida que queda a su cargo.
create or replace function set_available_at_stop(p_vehicle_id uuid, p_route_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  op    uuid := my_operator();
  today date := (now() at time zone 'America/Caracas')::date;
  trip  uuid;
begin
  if my_role() is distinct from 'driver' or op is null then
    raise exception 'Solo el conductor se activa disponible' using errcode = '42501';
  end if;
  if not exists (select 1 from vehicles where id = p_vehicle_id and operator_id = op and active) then
    raise exception 'Esa unidad no es de tu línea' using errcode = '42501';
  end if;
  if not exists (select 1 from routes where id = p_route_id and operator_id = op and active and not coming_soon) then
    raise exception 'Esa ruta no está disponible' using errcode = '22023';
  end if;

  -- Si ya tiene una salida abierta de hoy con esta unidad, es esa (tocar dos veces no duplica).
  select id into trip from trips
  where driver_id = auth.uid() and vehicle_id = p_vehicle_id and status in ('scheduled', 'en_camino', 'en_parada')
    and (scheduled_at at time zone 'America/Caracas')::date = today
  order by scheduled_at limit 1;

  if trip is null then
    -- La pendiente más próxima: primero las que vienen (o pasaron hace menos de 30 min), luego las viejas.
    select id into trip from trips
    where route_id = p_route_id and vehicle_id is null and status = 'scheduled'
      and (scheduled_at at time zone 'America/Caracas')::date = today
    order by (scheduled_at < now() - interval '30 minutes'), scheduled_at
    limit 1
    for update skip locked;

    if trip is not null then
      update trips set vehicle_id = p_vehicle_id, driver_id = auth.uid() where id = trip;
    else
      insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
      values (p_route_id, p_vehicle_id, auth.uid(), date_trunc('minute', now()))
      on conflict (route_id, scheduled_at) do update set vehicle_id = excluded.vehicle_id, driver_id = excluded.driver_id
      returning id into trip;
    end if;
  end if;

  update vehicles set available = true, available_at = now(), available_route_id = p_route_id, available_driver_id = auth.uid()
  where id = p_vehicle_id;
  return trip;
end $$;
revoke execute on function set_available_at_stop(uuid, uuid) from public, anon;
grant execute on function set_available_at_stop(uuid, uuid) to authenticated;

-- Dejar de estar disponible: la salida de hoy que no ha arrancado vuelve a quedar pendiente.
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
  if not p_available then
    update trips set vehicle_id = null, driver_id = null
    where vehicle_id = p_vehicle_id and driver_id = auth.uid() and status = 'scheduled'
      and not exists (select 1 from trip_events e where e.trip_id = trips.id)
      and (scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
  end if;
  update vehicles set available = p_available, available_at = now(),
                      available_route_id = case when p_available then available_route_id end,
                      available_driver_id = case when p_available then available_driver_id end
  where id = p_vehicle_id;
end $$;

-- ───────────── Deshacer ─────────────
alter type trip_event_type add value if not exists 'correccion';
alter table trip_events
  add column if not exists restore_status  trip_status,
  add column if not exists restore_stop_id uuid references stops (id);

create or replace function apply_trip_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prev_stop    uuid;
  restore_seq  int;
begin
  select current_stop_id into prev_stop from trips where id = new.trip_id;

  if new.type::text = 'correccion' then
    if new.restore_status is null then
      return new;
    end if;
    select seq into restore_seq from stops where id = new.restore_stop_id;
    -- Paradas que quedan sin marcar: las posteriores a la restaurada (todas si se vuelve al inicio).
    delete from stop_visits v using stops s
    where v.trip_id = new.trip_id and s.id = v.stop_id and (restore_seq is null or s.seq > restore_seq);
    update stop_waits w set picked_at = null from stops s
    where w.trip_id = new.trip_id and s.id = w.stop_id and w.picked_at is not null
      and (restore_seq is null or s.seq > restore_seq);
    if new.restore_status = 'en_parada' then
      update stop_visits set departed_at = null where trip_id = new.trip_id and stop_id = new.restore_stop_id;
    end if;
    update trips set
      status          = new.restore_status,
      current_stop_id = new.restore_stop_id,
      started_at      = case when new.restore_status = 'scheduled' or (new.restore_status = 'en_parada' and restore_seq = 1) then null else started_at end,
      ended_at        = case when new.restore_status in ('finalizada', 'cancelada') then ended_at end
    where id = new.trip_id;
    return new;
  end if;

  update trips set
    status = case new.type
               when 'en_camino'   then 'en_camino'::trip_status
               when 'en_parada'   then 'en_parada'::trip_status
               when 'fin_de_ruta' then 'finalizada'::trip_status
               when 'cancelada'   then 'cancelada'::trip_status
               else status end,
    current_stop_id = coalesce(new.stop_id, current_stop_id),
    started_at = case when new.type = 'en_camino' then coalesce(started_at, new.occurred_at) else started_at end,
    ended_at   = case when new.type = 'fin_de_ruta' then new.occurred_at else ended_at end
  where id = new.trip_id;

  if new.type = 'en_parada' and new.stop_id is not null then
    insert into stop_visits (trip_id, stop_id, arrived_at, source)
    values (new.trip_id, new.stop_id, new.occurred_at, 'manual')
    on conflict (trip_id, stop_id) do nothing;
  end if;

  -- Salir de una parada (o terminar la ruta) cierra la visita abierta.
  if new.type in ('en_camino', 'parada_completada', 'fin_de_ruta') and prev_stop is not null then
    update stop_visits set departed_at = new.occurred_at
    where trip_id = new.trip_id and stop_id = prev_stop and departed_at is null;
  end if;

  if new.type = 'abordaje' and new.booking_id is not null then
    update bookings set status = 'boarded', boarded_at = new.occurred_at
    where id = new.booking_id and trip_id = new.trip_id;
  end if;
  return new;
end $$;

-- ───────────── Demo ─────────────
-- El reinicio deja las salidas de hoy como pendientes de unidad (ninguna confirmada) y asegura
-- dos pendientes próximas por ruta activa, para mostrar cómo el conductor se activa y la salida
-- aparece confirmada para el estudiante.
create or replace function reset_demo_today() returns int
language plpgsql security definer set search_path = public as $$
declare
  op       uuid := my_operator();
  today    date := (now() at time zone 'America/Caracas')::date;
  last_day date;
  slot     timestamptz := date_trunc('hour', now()) + interval '30 minutes' * (floor(extract(minute from now()) / 30) + 1);
  n        int;
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

    insert into trips (route_id, scheduled_at)
    select t.route_id, (today + (t.scheduled_at at time zone 'America/Caracas')::time) at time zone 'America/Caracas'
    from trips t join routes r on r.id = t.route_id
    where r.operator_id = op and r.active and not r.coming_soon
      and (t.scheduled_at at time zone 'America/Caracas')::date = last_day
      and t.status <> 'cancelada'
    on conflict (route_id, scheduled_at) do nothing;
  end if;

  delete from stop_visits v using trips t, routes r
  where v.trip_id = t.id and r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;

  delete from stop_waits w using trips t, routes r
  where w.trip_id = t.id and r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;

  update trips t set status = 'scheduled', current_stop_id = null, last_lat = null, last_lng = null,
                     last_seen_at = null, started_at = null, ended_at = null, waiting = '{}'::jsonb,
                     vehicle_id = null, driver_id = null
  from routes r
  where r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;
  get diagnostics n = row_count;

  -- Dos pendientes próximas por ruta activa (si el día ya no tiene ninguna por delante).
  insert into trips (route_id, scheduled_at)
  select r.id, s.at
  from routes r
  cross join lateral (values (slot), (slot + interval '30 minutes')) as s(at)
  where r.operator_id = op and r.active and not r.coming_soon
    and (s.at at time zone 'America/Caracas')::date = today
    and not exists (select 1 from trips t where t.route_id = r.id and t.scheduled_at >= now()
                      and (t.scheduled_at at time zone 'America/Caracas')::date = today)
  on conflict (route_id, scheduled_at) do nothing;

  update vehicles set available = false, available_at = now(), available_route_id = null, available_driver_id = null
  where operator_id = op;
  return n;
end $$;
