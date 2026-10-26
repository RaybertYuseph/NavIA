-- Simulación de la demo (0013): crea salidas de ejemplo y las mueve con el tiempo.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

insert into vehicles (operator_id, plate, capacity) values ('00000000-0000-0000-0000-000000000010', 'SIM001', 20);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select reset_demo_today();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
do $$ begin
  perform simulate_demo_day();
  raise exception 'FALLO: el conductor simuló la demo';
exception when insufficient_privilege then raise notice 'ok: solo el fiscal simula la demo';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert(simulate_demo_day('00000000-0000-0000-0000-0000000000d1') >= 2, 'la simulación crea salidas');
select pg_temp.assert(simulate_demo_day() = 0, 'simular dos veces no duplica');
reset role;
select pg_temp.assert((select count(*) = 1 from trips where simulated and status = 'en_camino' and last_lat is not null),
  'una unidad va en camino con ubicación');
select pg_temp.assert((select count(*) = 1 from trips where simulated and status = 'en_parada' and last_lat is not null and started_at is null),
  'otra carga en la parada de salida');
select pg_temp.assert((select count(*) = 1 from trips where simulated and driver_id = '00000000-0000-0000-0000-0000000000d1' and status = 'scheduled'),
  'el conductor de la demo tiene su salida confirmada');
select pg_temp.assert((select available from vehicles v join trips t on t.vehicle_id = v.id where t.simulated and t.status = 'en_camino'),
  'la unidad en camino figura en ruta');

-- Pasan 20 minutos: las simuladas llegan al final de su ruta.
update trips set started_at = started_at - interval '20 minutes', scheduled_at = scheduled_at - interval '20 minutes'
where simulated and driver_id is null;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select demo_tick();
reset role;
select pg_temp.assert((select count(*) > 0 and bool_and(status = 'finalizada') from trips where simulated and driver_id is null),
  'con el tiempo las salidas simuladas avanzan hasta terminar');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert(reset_demo_today() >= 3, 'reiniciar la demo borra la simulación');
reset role;
