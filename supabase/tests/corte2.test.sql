-- Pruebas del corte 2 (tres vistas), con los permisos reales de cada rol.
-- Corre después de corte1.test.sql: la primera salida de hoy quedó finalizada.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- ───── Conductor: disponible ─────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_vehicle_available('00000000-0000-0000-0000-000000000020', true);
select pg_temp.assert((select available from vehicles where id = '00000000-0000-0000-0000-000000000020'),
  'el conductor marca su unidad disponible');

do $$ begin
  update vehicles set plate = 'XX000XX';
  if (select plate from vehicles limit 1) = 'XX000XX' then raise exception 'FALLO: el conductor cambió la placa'; end if;
  raise notice 'ok: el conductor no edita la unidad directamente';
end $$;

-- ───── Estudiante ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
do $$ begin
  perform set_vehicle_available('00000000-0000-0000-0000-000000000020', false);
  raise exception 'FALLO: el estudiante cambió la disponibilidad';
exception when insufficient_privilege then raise notice 'ok: el estudiante no cambia la disponibilidad';
end $$;
do $$ begin
  perform reset_demo_today();
  raise exception 'FALLO: el estudiante reinició la demo';
exception when insufficient_privilege then raise notice 'ok: el estudiante no puede reiniciar la demo';
end $$;

-- ───── Fiscal ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert((select count(*) = 2 from profiles), 'el fiscal ve los perfiles de su línea (no los de estudiantes, 0016)');
update vehicles set photo_url = 'https://ejemplo.test/bus.jpg' where id = '00000000-0000-0000-0000-000000000020';
select pg_temp.assert((select photo_url is not null from vehicles where id = '00000000-0000-0000-0000-000000000020'),
  'el fiscal guarda la foto de la unidad');

-- Salidas de ayer: el reinicio no las toca.
reset role;
insert into trips (route_id, scheduled_at) values ('00000000-0000-0000-0000-000000000030', now() - interval '1 day');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);

select pg_temp.assert((select reset_demo_today() = 2), 'reiniciar la demo borra las 2 salidas de hoy');
select pg_temp.assert((select count(*) = 0 from trips where (scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date),
  'tras reiniciar, el día queda sin horarios fijos');
select pg_temp.assert((select count(*) = 1 from trips), 'las salidas de ayer se conservan');
select pg_temp.assert((select count(*) = 0 from stop_visits), 'tras reiniciar no quedan paradas visitadas');
select pg_temp.assert((select not available from vehicles where id = '00000000-0000-0000-0000-000000000020'),
  'tras reiniciar la unidad deja de estar disponible');
select pg_temp.assert((select reset_demo_today() = 0), 'reiniciar un día vacío no falla');
reset role;

-- Las pruebas siguientes parten de las 2 salidas de hoy del conductor d1, como el seed.
insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
select '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-0000000000d1',
       ((now() at time zone 'America/Caracas')::date + t) at time zone 'America/Caracas'
from (values (time '06:00'), (time '13:00')) as s(t);
