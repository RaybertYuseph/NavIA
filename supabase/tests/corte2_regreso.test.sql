-- Rutas de regreso (supabase/rutas_regreso.sql): vuelta con paradas invertidas, idempotente.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

reset role;
insert into routes (id, operator_id, university_id, name, direction, fare_usd, corridor)
values ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
        'Guatire → Guarenas → USM (6:00)', 'ida', 1.50, null);
insert into stops (route_id, seq, name, lat, lng) values
  ('00000000-0000-0000-0000-000000000050', 1, 'Guatire', 10.47, -66.54),
  ('00000000-0000-0000-0000-000000000050', 2, 'Guarenas', 10.47, -66.61),
  ('00000000-0000-0000-0000-000000000050', 3, 'USM', 10.50, -66.84);

\ir ../rutas_regreso.sql
\ir ../rutas_regreso.sql

select pg_temp.assert((select count(*) = 1 from routes where name = 'USM → Guarenas → Guatire'), 'crea la vuelta con el nombre invertido y sin la hora, una sola vez');
select pg_temp.assert((select direction = 'regreso' and fare_usd = 1.50 and corridor = 'Guatire → Guarenas → USM' and not coming_soon
  from routes where name = 'USM → Guarenas → Guatire'), 'la vuelta va de regreso con la misma tarifa y el corredor de la ida');
select pg_temp.assert((select corridor = 'Guatire → Guarenas → USM' from routes where id = '00000000-0000-0000-0000-000000000050'),
  'la ida sin corredor toma uno y lo comparte con su vuelta');
select pg_temp.assert((select string_agg(s.name, ',' order by s.seq) = 'USM,Guarenas,Guatire'
  from stops s join routes r on r.id = s.route_id where r.name = 'USM → Guarenas → Guatire'), 'las paradas van en orden inverso');
select pg_temp.assert((select count(*) = 0 from routes where coming_soon and direction = 'regreso'), 'las rutas "Próximamente" no reciben vuelta');
