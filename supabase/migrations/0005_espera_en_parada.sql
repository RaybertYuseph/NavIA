-- NavIA · corte 2: "Estoy en la parada".
--
-- El estudiante marca en qué parada espera una salida de hoy. El conteo por parada vive en
-- trips.waiting ({stop_id: n}), así llega por el Realtime de trips a las tres vistas sin
-- exponer quién espera. Cuando el conductor marca "Llegué a" esa parada, la espera se cierra.
-- Es independiente de bookings (reservas y pagos, sprints 3 y 5).

alter table trips add column if not exists waiting jsonb not null default '{}'::jsonb;

create table if not exists stop_waits (
  trip_id    uuid not null references trips (id) on delete cascade,
  student_id uuid not null references profiles (id),
  stop_id    uuid not null references stops (id),
  created_at timestamptz not null default now(),
  picked_at  timestamptz,                 -- el conductor llegó a la parada
  primary key (trip_id, student_id)
);
create index if not exists stop_waits_open on stop_waits (trip_id) where picked_at is null;

alter table stop_waits enable row level security;
create policy stop_waits_own on stop_waits for select to authenticated using (student_id = auth.uid());
-- Escrituras solo por set_my_wait() y el trigger del conductor.

create or replace function refresh_trip_waiting(p_trip_id uuid) returns void
language sql security definer set search_path = public as $$
  update trips set waiting = coalesce((
    select jsonb_object_agg(stop_id, n) from (
      select stop_id, count(*) as n from stop_waits
      where trip_id = p_trip_id and picked_at is null group by stop_id
    ) c), '{}'::jsonb)
  where id = p_trip_id;
$$;
revoke execute on function refresh_trip_waiting(uuid) from public, anon, authenticated;

create or replace function on_stop_wait_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_trip_waiting(coalesce(new.trip_id, old.trip_id));
  return null;
end $$;
drop trigger if exists stop_waits_count on stop_waits;
create trigger stop_waits_count after insert or update or delete on stop_waits
  for each row execute function on_stop_wait_change();

-- El estudiante marca (o cambia) su parada en una salida de hoy aún no terminada,
-- en una parada por la que el bus todavía no pasó. p_stop_id null = ya no espero.
create or replace function set_my_wait(p_trip_id uuid, p_stop_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role() is distinct from 'student' then
    raise exception 'Solo los estudiantes marcan su parada' using errcode = '42501';
  end if;

  if p_stop_id is null then
    delete from stop_waits where trip_id = p_trip_id and student_id = auth.uid() and picked_at is null;
    return;
  end if;

  if not exists (
    select 1 from trips t join stops s on s.route_id = t.route_id and s.id = p_stop_id
    where t.id = p_trip_id and t.status in ('scheduled', 'en_camino', 'en_parada')
      and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
  ) or exists (select 1 from stop_visits v where v.trip_id = p_trip_id and v.stop_id = p_stop_id) then
    raise exception 'Esa parada no está disponible en esta salida' using errcode = '22023';
  end if;

  insert into stop_waits (trip_id, student_id, stop_id) values (p_trip_id, auth.uid(), p_stop_id)
  on conflict (trip_id, student_id) do update set stop_id = excluded.stop_id, created_at = now(), picked_at = null;
end $$;
revoke execute on function set_my_wait(uuid, uuid) from public, anon;
grant execute on function set_my_wait(uuid, uuid) to authenticated;

-- Llegar a una parada recoge a quienes esperaban ahí.
create or replace function pick_up_waiting() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'en_parada' and new.stop_id is not null then
    update stop_waits set picked_at = new.occurred_at
    where trip_id = new.trip_id and stop_id = new.stop_id and picked_at is null;
  end if;
  return null;
end $$;
drop trigger if exists trip_events_pick_up on trip_events;
create trigger trip_events_pick_up after insert on trip_events
  for each row execute function pick_up_waiting();

-- El reinicio de la demo también borra las esperas de hoy.
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

  delete from stop_waits w using trips t, routes r
  where w.trip_id = t.id and r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;

  update trips t set status = 'scheduled', current_stop_id = null, last_lat = null, last_lng = null,
                     last_seen_at = null, started_at = null, ended_at = null, waiting = '{}'::jsonb
  from routes r
  where r.id = t.route_id and r.operator_id = op
    and (t.scheduled_at at time zone 'America/Caracas')::date = today;
  get diagnostics n = row_count;

  update vehicles set available = false, available_at = now() where operator_id = op;
  return n;
end $$;
