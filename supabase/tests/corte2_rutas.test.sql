-- Varias rutas: asignar unidades a rutas y salidas nuevas con la unidad asignada.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin
  perform assign_vehicle_route('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000041');
  raise exception 'FALLO: el conductor asignó una unidad';
exception when insufficient_privilege then raise notice 'ok: solo el fiscal asigna unidades';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select assign_vehicle_route('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000041');
select pg_temp.assert((select route_id = '00000000-0000-0000-0000-000000000041' from vehicles where id = '00000000-0000-0000-0000-000000000020'),
  'el fiscal asigna la unidad a una ruta');
do $$ begin
  perform assign_vehicle_route('00000000-0000-0000-0000-000000000020', gen_random_uuid());
  raise exception 'FALLO: se asignó una ruta que no existe';
exception when invalid_parameter_value then raise notice 'ok: no se asigna una ruta ajena';
end $$;

reset role;
insert into trips (route_id, scheduled_at) values ('00000000-0000-0000-0000-000000000041', now() + interval '1 day');
select pg_temp.assert((select vehicle_id = '00000000-0000-0000-0000-000000000020' from trips where route_id = '00000000-0000-0000-0000-000000000041'),
  'una salida nueva sin unidad toma la asignada a su ruta');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select assign_vehicle_route('00000000-0000-0000-0000-000000000020', null);
select pg_temp.assert((select route_id is null from vehicles where id = '00000000-0000-0000-0000-000000000020'), 'quitar la ruta deja la unidad libre');
reset role;
