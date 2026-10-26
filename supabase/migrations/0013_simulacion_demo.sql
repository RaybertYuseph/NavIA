-- Simulación para la demo: con el día vacío no hay nada que mostrar en el tour. El fiscal (o la
-- app en modo demo, entrando como el fiscal de la demo) crea tres salidas de ejemplo:
--   · una unidad en camino a mitad de ruta, con estudiantes esperando más adelante;
--   · otra cargando en la parada de salida;
--   · la salida confirmada del conductor, que él mismo arranca con «Llegué».
-- Las dos primeras avanzan solas con demo_tick(): cada parada toma 90 segundos.
-- "Reiniciar demo" las borra como a cualquier salida de hoy.

alter table trips add column if not exists simulated boolean not null default false;

create or replace function simulate_demo_day(p_driver_id uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  op       uuid := my_operator();
  today    date := (now() at time zone 'America/Caracas')::date;
  base     timestamptz := date_trunc('minute', now());
  drv      uuid;
  mine     uuid;
  others   uuid[];
  rts      uuid[];
  r_mine   uuid;
  r        uuid;
  s        record;
  trip     uuid;
  n        int := 0;
begin
  if my_role() not in ('coordinator', 'admin') or op is null then
    raise exception 'Solo el fiscal simula la demo' using errcode = '42501';
  end if;
  if exists (select 1 from trips t join routes ro on ro.id = t.route_id
             where t.simulated and ro.operator_id = op and (t.scheduled_at at time zone 'America/Caracas')::date = today) then
    return 0;  -- ya hay simulación hoy
  end if;

  drv := coalesce(p_driver_id, (select id from profiles where role = 'driver' and operator_id = op order by id limit 1));
  if drv is not null and not exists (select 1 from profiles where id = drv and role = 'driver' and operator_id = op) then
    raise exception 'Ese conductor no es de tu línea' using errcode = '42501';
  end if;

  select array_agg(ro.id order by ro.name) into rts  -- rutas activas con al menos 3 paradas
  from routes ro
  where ro.operator_id = op and ro.active and not ro.coming_soon
    and (select count(*) from stops st where st.route_id = ro.id) >= 3;
  if rts is null then return 0; end if;

  -- La unidad del conductor: la de su última salida; si no, la primera en servicio.
  select t.vehicle_id into mine from trips t join vehicles v on v.id = t.vehicle_id
  where t.driver_id = drv and v.active and v.in_service
  order by t.scheduled_at desc limit 1;
  if mine is null then
    select id into mine from vehicles where operator_id = op and active and in_service order by plate limit 1;
  end if;
  select array_agg(id order by plate) into others from vehicles
  where operator_id = op and active and in_service and id is distinct from mine
    and not exists (select 1 from trips t where t.vehicle_id = vehicles.id and t.status in ('en_parada', 'en_camino')
                      and (t.scheduled_at at time zone 'America/Caracas')::date = today);

  r_mine := coalesce((select route_id from vehicles v where v.id = mine and v.route_id = any (rts)), rts[1]);

  -- 1) En camino, a mitad de ruta.
  if coalesce(array_length(others, 1), 0) >= 1 then
    r := coalesce((select route_id from vehicles where id = others[1] and route_id = any (rts)), rts[least(2, array_length(rts, 1))]);
    insert into trips (route_id, vehicle_id, scheduled_at, status, started_at, simulated)
    values (r, others[1], base - interval '4 minutes' + interval '11 seconds', 'en_camino',
            -- a mitad de ruta (como mucho dos tramos y medio): demo_tick() quita la espera de lo ya pasado
            now() - least(225, 45 * ((select count(*) from stops where route_id = r) - 1)) * interval '1 second', true)
    returning id into trip;
    update trips set waiting = (
      select coalesce(jsonb_object_agg(st.id::text, case st.seq % 3 when 0 then 3 when 1 then 1 else 2 end), '{}'::jsonb)
      from stops st where st.route_id = r and st.seq > (select min(seq) from stops where route_id = r))
    where id = trip;
    n := n + 1;
  end if;

  -- 2) Cargando en la parada de salida; arranca en 3 minutos.
  if coalesce(array_length(others, 1), 0) >= 2 then
    r := coalesce((select route_id from vehicles where id = others[2] and route_id = any (rts)), rts[least(3, array_length(rts, 1))]);
    if r = r_mine and array_length(rts, 1) > 1 then r := (select x from unnest(rts) x where x <> r_mine limit 1); end if;
    insert into trips (route_id, vehicle_id, scheduled_at, status, started_at, simulated)
    values (r, others[2], base + interval '3 minutes' + interval '13 seconds', 'en_parada', now() + interval '180 seconds', true)
    returning id into trip;
    update trips set waiting = (
      select coalesce(jsonb_object_agg(st.id::text, 2), '{}'::jsonb)
      from stops st where st.route_id = r and st.seq = (select min(seq) + 1 from stops where route_id = r))
    where id = trip;
    n := n + 1;
  end if;

  -- 3) La salida confirmada del conductor de la demo, en 15 minutos (él la arranca).
  if drv is not null and mine is not null and not exists (
    select 1 from trips where driver_id = drv and status in ('scheduled', 'en_parada', 'en_camino')
      and (scheduled_at at time zone 'America/Caracas')::date = today
  ) then
    insert into trips (route_id, vehicle_id, driver_id, scheduled_at, simulated)
    values (r_mine, mine, drv, base + interval '15 minutes', true)
    on conflict (route_id, scheduled_at) do nothing
    returning id into trip;
    if trip is not null then
      update trips set waiting = (
        select coalesce(jsonb_object_agg(st.id::text, 2), '{}'::jsonb)
        from stops st where st.route_id = r_mine and st.seq = (select min(seq) + 1 from stops where route_id = r_mine))
      where id = trip;
      update vehicles set available = true, available_at = now(), available_route_id = r_mine, available_driver_id = drv
      where id = mine;
      n := n + 1;
    end if;
  end if;

  perform demo_tick();
  return n;
end $$;
revoke execute on function simulate_demo_day(uuid) from public, anon;
grant execute on function simulate_demo_day(uuid) to authenticated;

-- Mueve las salidas simuladas según el tiempo: 90 s por tramo entre paradas. Solo toca salidas
-- simuladas de hoy, así que cualquier sesión puede llamarla sin riesgo.
create or replace function demo_tick() returns int
language plpgsql security definer set search_path = public as $$
declare
  t      record;
  st     stops[];
  k      int;
  idx    int;
  frac   double precision;
  el     double precision;
  n      int := 0;
begin
  for t in
    select * from trips
    where simulated and driver_id is null and status in ('en_parada', 'en_camino')
      and (scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
    for update skip locked
  loop
    select array_agg(x order by x.seq) into st from stops x where x.route_id = t.route_id;
    k := coalesce(array_length(st, 1), 0);
    if k < 2 then continue; end if;
    el := extract(epoch from now() - t.started_at);
    if el < 90 * (k - 1) then
      update vehicles set available = true, available_at = coalesce(available_at, now()),
                          available_route_id = t.route_id
      where id = t.vehicle_id and not available;
    end if;

    if el < 0 then  -- todavía cargando en la salida
      update trips set status = 'en_parada', current_stop_id = st[1].id, last_lat = st[1].lat, last_lng = st[1].lng,
                       last_seen_at = now()
      where id = t.id;
    else
      idx := floor(el / 90)::int + 1;              -- última parada pasada (1 = la salida)
      frac := (el - (idx - 1) * 90) / 90.0;
      if idx >= k then
        insert into stop_visits (trip_id, stop_id, arrived_at, departed_at, source)
        select t.id, s.id, now(), now(), 'manual' from unnest(st) s
        on conflict do nothing;
        update trips set status = 'finalizada', current_stop_id = st[k].id, last_lat = st[k].lat, last_lng = st[k].lng,
                         last_seen_at = now(), ended_at = now(), waiting = '{}'::jsonb
        where id = t.id;
      else
        insert into stop_visits (trip_id, stop_id, arrived_at, departed_at, source)
        select t.id, s.id, t.started_at + (s.seq - st[1].seq) * interval '90 seconds',
               t.started_at + (s.seq - st[1].seq) * interval '90 seconds', 'manual'
        from unnest(st[1:idx]) s
        on conflict do nothing;
        update trips set status = 'en_camino', current_stop_id = st[idx].id,
                         last_lat = st[idx].lat + (st[idx + 1].lat - st[idx].lat) * frac,
                         last_lng = st[idx].lng + (st[idx + 1].lng - st[idx].lng) * frac,
                         last_seen_at = now(),
                         waiting = coalesce((select jsonb_object_agg(key, value) from jsonb_each(t.waiting)
                                             where key not in (select (s.id)::text from unnest(st[1:idx]) s)), '{}'::jsonb)
        where id = t.id;
      end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function demo_tick() from public, anon;
grant execute on function demo_tick() to authenticated;
