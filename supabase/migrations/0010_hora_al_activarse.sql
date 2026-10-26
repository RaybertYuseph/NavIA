-- NavIA · corte 2: la hora de salida la pone el conductor al activarse en la parada de salida.
--
-- set_available_at_stop() recibe en cuántos minutos sale el conductor ("Ahora", 10, 20 o 30) y
-- crea la salida a esa hora. Solo toma una salida que el fiscal anunció si queda a 10 minutos o
-- menos de esa hora. La hora real de salida sigue siendo started_at ("Ya subieron todos").
-- reset_demo_today() ya no deja horarios fijos: borra las salidas de hoy (con sus marcas) y el día
-- empieza vacío, como en la calle. El fiscal puede anunciar una con "Nueva salida".

-- p_depart_in: en cuántos minutos sale ("Ahora" = 0, 10, 20 o 30); sin él, ahora y sin mover una
-- salida que ya tenga. La versión de 2 parámetros se reemplaza para que las llamadas no sean ambiguas.
drop function if exists set_available_at_stop(uuid, uuid);
create or replace function set_available_at_stop(p_vehicle_id uuid, p_route_id uuid, p_depart_in int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  op     uuid := my_operator();
  today  date := (now() at time zone 'America/Caracas')::date;
  target timestamptz := date_trunc('minute', now()) + make_interval(mins => greatest(0, least(coalesce(p_depart_in, 0), 120)));
  trip   uuid;
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

  -- Si ya tiene una salida abierta de hoy con esta unidad, es esa (tocar dos veces no duplica). Si
  -- todavía no arranca, toma la hora nueva: así el conductor puede corregir "Salgo en…".
  select id into trip from trips
  where driver_id = auth.uid() and vehicle_id = p_vehicle_id and status in ('scheduled', 'en_camino', 'en_parada')
    and (scheduled_at at time zone 'America/Caracas')::date = today
  order by scheduled_at limit 1;
  -- (Un "Llegué" deshecho deja eventos pero la salida vuelve a programada: vale started_at.)
  if trip is not null and p_depart_in is not null
     and exists (select 1 from trips where id = trip and status = 'scheduled' and started_at is null and scheduled_at <> target) then
    if exists (select 1 from trips o, trips t where t.id = trip and o.route_id = t.route_id and o.scheduled_at = target and o.id <> t.id) then
      raise exception 'Ya hay otra salida de esa ruta a esa hora' using errcode = '23505', hint = 'hora_ocupada';
    end if;
    update trips set scheduled_at = target where id = trip;
  end if;

  if trip is null then
    -- Una salida que el fiscal anunció a 10 minutos o menos de esa hora: se toma con su hora.
    select id into trip from trips
    where route_id = p_route_id and vehicle_id is null and status = 'scheduled'
      and scheduled_at between target - interval '10 minutes' and target + interval '10 minutes'
    order by abs(extract(epoch from scheduled_at - target))
    limit 1
    for update skip locked;

    if trip is not null then
      update trips set vehicle_id = p_vehicle_id, driver_id = auth.uid() where id = trip;
    else
      insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
      values (p_route_id, p_vehicle_id, auth.uid(), target)
      on conflict (route_id, scheduled_at) do update set vehicle_id = excluded.vehicle_id, driver_id = excluded.driver_id
      where trips.vehicle_id is null
      returning id into trip;
      if trip is null then
        -- Otro conductor ya sale a esa hora en esa ruta: la suya queda un minuto después.
        insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
        values (p_route_id, p_vehicle_id, auth.uid(), target + interval '1 minute')
        returning id into trip;
      end if;
    end if;
  end if;

  update vehicles set available = true, available_at = now(), available_route_id = p_route_id, available_driver_id = auth.uid()
  where id = p_vehicle_id;
  return trip;
end $$;
revoke execute on function set_available_at_stop(uuid, uuid, int) from public, anon;
grant execute on function set_available_at_stop(uuid, uuid, int) to authenticated;

create or replace function reset_demo_today() returns int
language plpgsql security definer set search_path = public as $$
declare
  op uuid := my_operator();
  n  int;
begin
  if my_role() not in ('coordinator', 'admin') or op is null then
    raise exception 'Solo el fiscal puede reiniciar la demo' using errcode = '42501';
  end if;

  create temp table if not exists reset_ids (id uuid) on commit drop;
  delete from reset_ids;
  insert into reset_ids
  select t.id from trips t join routes r on r.id = t.route_id
  where r.operator_id = op and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;

  delete from payment_allocations where booking_id in (select b.id from bookings b where b.trip_id in (select id from reset_ids));
  delete from bookings       where trip_id in (select id from reset_ids);
  update escalations set trip_id = null where trip_id in (select id from reset_ids);
  delete from trip_events    where trip_id in (select id from reset_ids);
  delete from location_pings where trip_id in (select id from reset_ids);
  delete from stop_visits    where trip_id in (select id from reset_ids);
  delete from stop_waits     where trip_id in (select id from reset_ids);
  delete from trips          where id in (select id from reset_ids);
  get diagnostics n = row_count;

  update vehicles set available = false, available_at = now(), available_route_id = null, available_driver_id = null
  where operator_id = op;
  return n;
end $$;
