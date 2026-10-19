-- "Estoy en la parada": conteo por parada en trips.waiting. Corre después de corte2.test.sql
-- (hoy hay 2 salidas programadas del conductor d1).

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e2', 'otra@navia.test');
create temp table ctx as
select t.id as trip,
       (select id from stops where route_id = t.route_id and seq = 3) as s3,
       (select id from stops where route_id = t.route_id and seq = 4) as s4
from trips t
where (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
order by t.scheduled_at limit 1;
grant select on ctx to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_my_wait(trip, s3) from ctx;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select set_my_wait(trip, s3) from ctx;
select pg_temp.assert((select (waiting ->> s3::text)::int = 2 from trips, ctx where trips.id = ctx.trip),
  'dos estudiantes esperando en la misma parada');
select set_my_wait(trip, s4) from ctx;
select pg_temp.assert((select waiting = jsonb_build_object(s3, 1, s4, 1) from trips, ctx where trips.id = ctx.trip),
  'cambiar de parada mueve el conteo');
select pg_temp.assert((select count(*) = 1 from stop_waits), 'el estudiante solo ve su propia espera');

-- ───── Conductor ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin
  perform set_my_wait(trip, s3) from ctx;
  raise exception 'FALLO: el conductor marcó una espera';
exception when insufficient_privilege then raise notice 'ok: solo los estudiantes marcan su parada';
end $$;
select pg_temp.assert((select count(*) = 0 from stop_waits), 'el conductor no ve quién espera, solo el conteo');

insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
select trip, 'en_camino', auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000001', now() - interval '2 min' from ctx;
insert into trip_events (trip_id, type, stop_id, actor_id, client_event_id, occurred_at)
select trip, 'en_parada', s3, auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000002', now() from ctx;
select pg_temp.assert((select waiting = jsonb_build_object(s4, 1) from trips, ctx where trips.id = ctx.trip),
  'llegar a la parada limpia su conteo y deja el de las siguientes');

-- ───── Estudiante recogido ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select pg_temp.assert((select picked_at is not null from stop_waits), 'el estudiante ve que el bus llegó a su parada');
do $$ begin
  perform set_my_wait(trip, s3) from ctx;
  raise exception 'FALLO: se marcó una parada por la que el bus ya pasó';
exception when invalid_parameter_value then raise notice 'ok: no se marca una parada ya visitada';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
select set_my_wait(trip, null) from ctx;
select pg_temp.assert((select waiting = '{}'::jsonb from trips, ctx where trips.id = ctx.trip), 'desmarcar baja el conteo');

-- ───── Fiscal: reinicio ─────
select set_my_wait(trip, s4) from ctx;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select reset_demo_today();
reset role;
select pg_temp.assert((select count(*) = 0 from stop_waits) and (select bool_and(waiting = '{}'::jsonb) from trips),
  'reiniciar la demo borra las esperas');
