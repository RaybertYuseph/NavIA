-- Pruebas del corte 1, ejecutadas con los permisos reales (RLS) de cada rol.
-- Cualquier fallo aborta con error (ON_ERROR_STOP).

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- Perfiles creados por el trigger de registro
select pg_temp.assert((select count(*) = 2 from profiles), 'el registro crea el perfil');
select pg_temp.assert((select full_name = 'Conductor de Prueba' from profiles where role = 'driver'), 'el perfil toma el nombre del registro');

-- ───── Conductor ─────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);

select pg_temp.assert((select count(*) = 2 from trips where driver_id = auth.uid()), 'el conductor ve sus 2 salidas de hoy');

insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
select id, 'en_camino', auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '10 min'
from trips where driver_id = auth.uid() order by scheduled_at limit 1;

select pg_temp.assert((select status = 'en_camino' and started_at is not null from trips order by scheduled_at limit 1),
  'En camino cambia el estado de la salida (trigger con RLS)');

-- La cola offline reenvía el mismo evento: no se duplica
insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
select id, 'en_camino', auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', now()
from trips order by scheduled_at limit 1
on conflict (client_event_id) do nothing;
select pg_temp.assert((select count(*) = 1 from trip_events), 'reenviar el mismo evento no lo duplica');

-- GPS: llegan desordenados, gana el más reciente
insert into location_pings (trip_id, lat, lng, recorded_at)
select id, 10.4950, -66.8500, now() - interval '2 min' from trips order by scheduled_at limit 1;
insert into location_pings (trip_id, lat, lng, recorded_at)
select id, 10.4917, -66.8722, now() - interval '8 min' from trips order by scheduled_at limit 1;
select pg_temp.assert((select last_lat = 10.4950 from trips order by scheduled_at limit 1),
  'un ping viejo no pisa la ubicación más reciente');

-- En parada → registra la visita; En camino → la cierra
insert into trip_events (trip_id, type, stop_id, actor_id, client_event_id, occurred_at)
select t.id, 'en_parada', s.id, auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '1 min'
from trips t join stops s on s.route_id = t.route_id and s.seq = 2 order by t.scheduled_at limit 1;
select pg_temp.assert((select status = 'en_parada' from trips order by scheduled_at limit 1), 'En parada cambia el estado');
select pg_temp.assert((select count(*) = 1 from stop_visits where departed_at is null), 'En parada registra la visita');

insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
select id, 'en_camino', auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000003', now()
from trips order by scheduled_at limit 1;
select pg_temp.assert((select count(*) = 1 from stop_visits where departed_at is not null), 'salir de la parada cierra la visita');

-- ───── Estudiante ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select pg_temp.assert((select status = 'en_camino' and last_lat is not null from trips order by scheduled_at limit 1),
  'el estudiante ve el estado en vivo');

do $$ begin
  insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
  select id, 'fin_de_ruta', auth.uid(), gen_random_uuid(), now() from trips order by scheduled_at limit 1;
  raise exception 'FALLO: el estudiante pudo enviar un evento de conductor';
exception when insufficient_privilege then raise notice 'ok: el estudiante no puede enviar eventos de conductor';
end $$;

do $$ begin
  update profiles set role = 'admin' where id = auth.uid();
  raise exception 'FALLO: el estudiante pudo cambiarse el rol';
exception when insufficient_privilege then raise notice 'ok: el estudiante no puede cambiarse el rol';
end $$;

update profiles set full_name = 'Ana Pérez' where id = auth.uid();
select pg_temp.assert((select full_name = 'Ana Pérez' from profiles where id = auth.uid()), 'el estudiante puede corregir su nombre');
select pg_temp.assert((select count(*) = 0 from vehicles), 'el estudiante no ve las unidades del operador');

-- ───── Anónimo ─────
reset role;
set role anon;
select pg_temp.assert((select count(*) = 0 from operators), 'sin sesión no se ven los datos de pago del operador');
select pg_temp.assert((select count(*) = 0 from trips), 'sin sesión no se ven las salidas');

-- ───── Fin de ruta ─────
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
insert into trip_events (trip_id, type, actor_id, client_event_id, occurred_at)
select id, 'fin_de_ruta', auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000004', now()
from trips order by scheduled_at limit 1;
select pg_temp.assert((select status = 'finalizada' and ended_at is not null from trips order by scheduled_at limit 1), 'Fin de ruta cierra la salida');

do $$ begin
  insert into location_pings (trip_id, lat, lng, recorded_at)
  select id, 10.0, -66.0, now() + interval '1 min' from trips order by scheduled_at limit 1;
  raise exception 'FALLO: se aceptó GPS de una salida finalizada';
exception when insufficient_privilege then raise notice 'ok: no se acepta GPS de una salida finalizada';
end $$;
reset role;
