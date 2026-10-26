-- Una salida de ayer que quedó abierta no deja la unidad "en ruta" hoy (0011).

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

create temp table v as
select v.id from vehicles v
where v.active and not exists (select 1 from trips t where t.vehicle_id = v.id and t.status in ('en_parada', 'en_camino'))
limit 1;

insert into trips (route_id, vehicle_id, scheduled_at, status)
select '00000000-0000-0000-0000-000000000030', (select id from v), now() - interval '1 day 2 hours', 'en_camino';

select pg_temp.assert(not vehicle_on_route((select id from v)), 'una salida de ayer abierta no deja la unidad en ruta hoy');

insert into trips (route_id, vehicle_id, scheduled_at, status)
select '00000000-0000-0000-0000-000000000030', (select id from v), date_trunc('minute', now()) + interval '7 seconds', 'en_camino';
select pg_temp.assert(vehicle_on_route((select id from v)), 'una salida de hoy en camino sí la deja en ruta');
