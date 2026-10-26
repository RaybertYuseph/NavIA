-- Gestor de unidades: incorporar, desincorporar, fuera de servicio, cambio de ruta con aviso y
-- disponibilidad que sigue a la salida. Corre después de corte2_salidas (AB123CD queda en ruta).

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

create temp table u (id uuid, trip uuid);
grant all on u to authenticated;
set role authenticated;

-- ───── Disponibilidad que sigue a la salida ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select pg_temp.assert((select available from vehicles where id = '00000000-0000-0000-0000-000000000020'),
  'cargando en la parada de salida, la unidad queda disponible');
do $$ begin
  perform set_vehicle_available('00000000-0000-0000-0000-000000000020', false);
  raise exception 'FALLO: se marcó no disponible a mitad de ruta';
exception when object_not_in_prerequisite_state then raise notice 'ok: no se marca "No disponible" a mitad de ruta';
end $$;

-- ───── Permisos ─────
do $$ begin
  perform create_vehicle('ZZ111ZZ', 30);
  raise exception 'FALLO: el conductor incorporó una unidad';
exception when insufficient_privilege then raise notice 'ok: solo el fiscal incorpora unidades';
end $$;

-- ───── Incorporar ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
insert into u (id) select create_vehicle(' zz-111 zz ', 28, '00000000-0000-0000-0000-000000000030');
select pg_temp.assert((select plate = 'ZZ111ZZ' and capacity = 28 and active and in_service and route_id = '00000000-0000-0000-0000-000000000030'
  from vehicles where id = (select id from u)), 'el fiscal incorpora una unidad con la placa normalizada y su ruta');
do $$ begin
  perform create_vehicle('ZZ111ZZ', 30);
  raise exception 'FALLO: se repitió la placa';
exception when unique_violation then raise notice 'ok: no se repite una placa';
end $$;
do $$ begin
  perform create_vehicle('X1', 30);
  raise exception 'FALLO: se aceptó una placa no válida';
exception when invalid_parameter_value then raise notice 'ok: se valida la placa';
end $$;

-- ───── En ruta no se desincorpora ni sale de servicio ─────
do $$ begin
  perform retire_vehicle('00000000-0000-0000-0000-000000000020');
  raise exception 'FALLO: se desincorporó una unidad en ruta';
exception when object_not_in_prerequisite_state then raise notice 'ok: una unidad en ruta no se desincorpora';
end $$;
do $$ begin
  perform set_vehicle_in_service('00000000-0000-0000-0000-000000000020', false);
  raise exception 'FALLO: se sacó de servicio una unidad en ruta';
exception when object_not_in_prerequisite_state then raise notice 'ok: una unidad en ruta no sale de servicio';
end $$;

-- ───── Cambio de ruta: libera salidas y avisa ─────
reset role;
with t as (
  insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
  select '00000000-0000-0000-0000-000000000030', id, '00000000-0000-0000-0000-0000000000d1', date_trunc('minute', now()) + interval '2 hours 13 seconds' from u
  returning id)
update u set trip = (select id from t);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select assign_vehicle_route((select id from u), '00000000-0000-0000-0000-000000000041');
select pg_temp.assert((select route_id = '00000000-0000-0000-0000-000000000041' from vehicles where id = (select id from u)), 'la unidad cambia de ruta');
select pg_temp.assert((select vehicle_id is null and driver_id is null from trips where id = (select trip from u)),
  'sus salidas pendientes de la ruta vieja quedan sin unidad');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select pg_temp.assert((select count(*) = 1 from notifications where body like 'Tu unidad ZZ111ZZ ahora cubre %'), 'el conductor recibe el aviso');
update notifications set read_at = now() where user_id = auth.uid();
select pg_temp.assert((select count(*) = 0 from notifications where read_at is null), 'el conductor marca el aviso como leído');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select pg_temp.assert((select count(*) = 0 from notifications), 'otro usuario no ve avisos ajenos');

-- ───── Fuera de servicio ─────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_vehicle_in_service((select id from u), false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin
  perform set_available_at_stop((select id from u), '00000000-0000-0000-0000-000000000030');
  raise exception 'FALLO: se activó una unidad fuera de servicio';
exception when object_not_in_prerequisite_state then raise notice 'ok: fuera de servicio no se activa en la parada';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select set_vehicle_in_service((select id from u), true);
select pg_temp.assert((select in_service from vehicles where id = (select id from u)), 'vuelve a estar en servicio');

-- ───── Desincorporar y reincorporar ─────
select retire_vehicle((select id from u));
select pg_temp.assert((select not active and route_id is null and not available from vehicles where id = (select id from u)),
  'desincorporar deja la unidad inactiva, sin ruta y sin borrarla');
do $$ begin
  perform create_vehicle('ZZ111ZZ', 30);
  raise exception 'FALLO: se repitió la placa de una desincorporada';
exception when unique_violation then raise notice 'ok: la placa de una desincorporada se reincorpora, no se repite';
end $$;
select reinstate_vehicle((select id from u));
select pg_temp.assert((select active from vehicles where id = (select id from u)), 'el fiscal reincorpora la unidad');
reset role;

-- ───── La hora la pone el conductor al activarse (0010) ─────
create temp table lejana (id uuid);
with t as (insert into trips (route_id, scheduled_at)
  values ('00000000-0000-0000-0000-000000000030', date_trunc('minute', now()) + interval '3 hours 29 seconds') returning id)
insert into lejana select id from t;
grant select on lejana to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
update u set trip = set_available_at_stop(id, '00000000-0000-0000-0000-000000000030');
select pg_temp.assert((select scheduled_at between now() - interval '1 minute' and now() + interval '1 minute' and vehicle_id = (select id from u)
  from trips where id = (select trip from u)), 'sin salida anunciada para la próxima media hora, sale a la hora de activación');
reset role;
select pg_temp.assert((select vehicle_id is null from trips where id = (select id from lejana)), 'una salida anunciada para más tarde no se toma antes de tiempo');
