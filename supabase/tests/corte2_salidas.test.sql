-- Salidas flexibles (el fiscal crea pendientes, el conductor se activa en la parada) y "Deshacer".
-- La hora de prueba lleva segundos para no chocar con las salidas de :00 y :30 del reinicio de la demo.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

reset role;
-- Punto de partida: ninguna salida de hoy con unidad (como deja el reinicio de la demo).
update trips set vehicle_id = null, driver_id = null, status = 'scheduled', current_stop_id = null
where (scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
-- Y las de la ruta de prueba, fuera de juego: así la "más próxima" es la que crea el fiscal, sea la hora que sea.
update trips set status = 'cancelada'
where route_id = '00000000-0000-0000-0000-000000000030'
  and (scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
create temp table r as
select '00000000-0000-0000-0000-000000000030'::uuid as route,
       (select id from stops where route_id = '00000000-0000-0000-0000-000000000030' and seq = 1) as s1,
       (select id from stops where route_id = '00000000-0000-0000-0000-000000000030' and seq = 2) as s2,
       (select id from stops where route_id = '00000000-0000-0000-0000-000000000030' and seq = 3) as s3,
       (select lat from stops where route_id = '00000000-0000-0000-0000-000000000030' and seq = 3) as s3_lat,
       (select lng from stops where route_id = '00000000-0000-0000-0000-000000000030' and seq = 3) as s3_lng;
grant select on r to authenticated;
create temp table t (trip uuid);
grant all on t to authenticated;

set role authenticated;

-- ───── Fiscal crea una salida pendiente ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select create_departure(route, date_trunc('minute', now()) + interval '7 minutes 17 seconds') from r;
select pg_temp.assert((select vehicle_id is null and driver_id is null from trips
  where route_id = (select route from r) and scheduled_at = date_trunc('minute', now()) + interval '7 minutes 17 seconds'),
  'el fiscal crea una salida pendiente de unidad');
do $$ begin
  perform create_departure('00000000-0000-0000-0000-000000000041', now() + interval '1 hour');
  raise exception 'FALLO: se creó una salida en una ruta "Próximamente"';
exception when invalid_parameter_value then raise notice 'ok: no se crean salidas en rutas por abrir';
end $$;

-- ───── Conductor se activa en la parada ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
insert into t select set_available_at_stop('00000000-0000-0000-0000-000000000020', route) from r;
select pg_temp.assert((select driver_id = auth.uid() and vehicle_id = '00000000-0000-0000-0000-000000000020' and scheduled_at = date_trunc('minute', now()) + interval '7 minutes 17 seconds'
  from trips where id = (select trip from t)), 'al activarse toma la salida pendiente más próxima');
select pg_temp.assert((select set_available_at_stop('00000000-0000-0000-0000-000000000020', route) = (select trip from t) from r),
  'activarse dos veces no crea otra salida');
select pg_temp.assert((select available and available_route_id = (select route from r) from vehicles where id = '00000000-0000-0000-0000-000000000020'),
  'la unidad queda disponible en la parada de esa ruta');

select set_vehicle_available('00000000-0000-0000-0000-000000000020', false);
select pg_temp.assert((select vehicle_id is null and driver_id is null from trips where id = (select trip from t)),
  'al dejar de estar disponible, la salida vuelve a quedar pendiente');

-- Sin pendientes de esa ruta, se crea una salida para ya.
reset role;
update trips set vehicle_id = '00000000-0000-0000-0000-000000000020' where vehicle_id is null and route_id = (select route from r);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
delete from t;
insert into t select set_available_at_stop('00000000-0000-0000-0000-000000000020', route) from r;
select pg_temp.assert((select scheduled_at = date_trunc('minute', now()) and driver_id = auth.uid() from trips where id = (select trip from t)),
  'sin pendientes, se crea una salida para ahora');

-- ───── Deshacer ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_my_wait((select trip from t), s3, s3_lat, s3_lng) from r;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
insert into trip_events (trip_id, type, stop_id, actor_id, client_event_id, occurred_at)
select (select trip from t), e.type::trip_event_type, e.stop, auth.uid(), gen_random_uuid(), now() + e.k * interval '1 second'
from r, lateral (values (1, 'en_parada', r.s1), (2, 'en_camino', null), (3, 'en_parada', r.s2), (4, 'en_camino', null), (5, 'en_parada', r.s3)) as e(k, type, stop);
select pg_temp.assert((select current_stop_id = (select s3 from r) from trips where id = (select trip from t)), 'el conductor llegó a la tercera parada');
select pg_temp.assert((select waiting = '{}'::jsonb from trips where id = (select trip from t)), 'al llegar se recoge al estudiante');

insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at, restore_status, restore_stop_id)
select (select trip from t), 'correccion', auth.uid(), gen_random_uuid(), now() + interval '10 seconds', 'en_parada', s1 from r;
select pg_temp.assert((select status = 'en_parada' and current_stop_id = (select s1 from r) from trips where id = (select trip from t)),
  'corregir vuelve a la parada elegida');
reset role;
select pg_temp.assert((select count(*) = 1 from stop_visits where trip_id = (select trip from t)), 'se desmarcan las paradas siguientes');
select pg_temp.assert((select departed_at is null from stop_visits where trip_id = (select trip from t)), 'la parada restaurada queda abierta');
select pg_temp.assert((select (waiting ->> (select s3 from r)::text)::int = 1 from trips where id = (select trip from t)),
  'la espera recogida en una parada desmarcada se reabre');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
select (select trip from t), 'fin_de_ruta', auth.uid(), gen_random_uuid(), now() + interval '20 seconds';
insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at, restore_status, restore_stop_id)
select (select trip from t), 'correccion', auth.uid(), gen_random_uuid(), now() + interval '21 seconds', 'en_parada', s1 from r;
select pg_temp.assert((select status = 'en_parada' and ended_at is null from trips where id = (select trip from t)), 'deshacer "Terminar ruta"');
reset role;
