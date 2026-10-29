-- NavIA · corte 2: varias rutas y unidades asignadas a cada una.
--
-- 1) routes.corridor agrupa ida y regreso (p. ej. "Guarenas – Guatire") para el filtro del fiscal;
--    routes.coming_soon marca rutas que el fiscal ya ve y prepara, pero que aún no tienen salidas.
-- 2) vehicles.route_id: la ruta que cubre cada unidad. Solo el fiscal del operador la cambia,
--    con assign_vehicle_route(). Llega a las pantallas por el Realtime de vehicles (0004).
-- 3) Una salida nueva sin unidad toma una asignada a su ruta; el reinicio de la demo también.

-- ───────────── 1. Rutas ─────────────
alter table routes
  add column if not exists corridor    text,
  add column if not exists coming_soon boolean not null default false;

update routes set corridor = 'Guarenas – Guatire'
where corridor is null and (name ilike '%guatire%' or name ilike '%guarenas%');

-- ───────────── 2. Unidad → ruta ─────────────
alter table vehicles add column if not exists route_id uuid references routes (id) on delete set null;

create or replace function assign_vehicle_route(p_vehicle_id uuid, p_route_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  op uuid := my_operator();
begin
  if my_role() not in ('coordinator', 'admin') or op is null then
    raise exception 'Solo el fiscal asigna unidades' using errcode = '42501';
  end if;
  if not exists (select 1 from vehicles where id = p_vehicle_id and operator_id = op) then
    raise exception 'Esa unidad no es de tu línea' using errcode = '42501';
  end if;
  if p_route_id is not null and not exists (select 1 from routes where id = p_route_id and operator_id = op) then
    raise exception 'Esa ruta no es de tu línea' using errcode = '22023';
  end if;
  update vehicles set route_id = p_route_id where id = p_vehicle_id;
end $$;
revoke execute on function assign_vehicle_route(uuid, uuid) from public, anon;
grant execute on function assign_vehicle_route(uuid, uuid) to authenticated;

-- ───────────── 3. Salidas nuevas ─────────────
-- Sin unidad: la asignada a la ruta (o a otra del mismo corredor) con menos salidas ese día.
create or replace function trips_default_vehicle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.vehicle_id is null then
    select v.id into new.vehicle_id
    from vehicles v
    join routes vr on vr.id = v.route_id
    join routes tr on tr.id = new.route_id
    where v.active and (v.route_id = new.route_id or (tr.corridor is not null and vr.corridor = tr.corridor))
    order by (v.route_id = new.route_id) desc,
             (select count(*) from trips t
              where t.vehicle_id = v.id
                and (t.scheduled_at at time zone 'America/Caracas')::date = (new.scheduled_at at time zone 'America/Caracas')::date),
             v.plate
    limit 1;
  end if;
  return new;
end $$;
drop trigger if exists trips_default_vehicle on trips;
create trigger trips_default_vehicle before insert on trips
  for each row execute function trips_default_vehicle();

-- El reinicio de la demo copia el horario del último día; la unidad sale de la asignación de la
-- ruta si la hay (si no, la de ese día). Igual que en 0005 en todo lo demás.
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
    select t.route_id,
           case when exists (select 1 from vehicles v where v.route_id = t.route_id and v.active) then null else t.vehicle_id end,
           t.driver_id,
           (today + (t.scheduled_at at time zone 'America/Caracas')::time) at time zone 'America/Caracas'
    from trips t join routes r on r.id = t.route_id
    where r.operator_id = op and r.active
      and (t.scheduled_at at time zone 'America/Caracas')::date = last_day
      and t.status <> 'cancelada'
    order by t.scheduled_at
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
