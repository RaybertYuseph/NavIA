-- Vuelve a definir reset_demo_today() tal como quedó al final de la 0010. Si se corrió una versión
-- anterior de la 0010, "Reiniciar demo" fallaba; correr esta migración basta para dejarlo bien.
create or replace function reset_demo_today() returns int
language plpgsql security definer set search_path = public as $$
declare
  op uuid := my_operator();
  n  int;
begin
  if my_role() not in ('coordinator', 'admin') or op is null then
    raise exception 'Solo el fiscal puede reiniciar la demo' using errcode = '42501';
  end if;

  create temp table if not exists reset_ids (id uuid) on commit drop;
  delete from reset_ids;
  insert into reset_ids
  select t.id from trips t join routes r on r.id = t.route_id
  where r.operator_id = op and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;

  delete from payment_allocations where booking_id in (select b.id from bookings b where b.trip_id in (select id from reset_ids));
  delete from bookings       where trip_id in (select id from reset_ids);
  update escalations set trip_id = null where trip_id in (select id from reset_ids);
  delete from trip_events    where trip_id in (select id from reset_ids);
  delete from location_pings where trip_id in (select id from reset_ids);
  delete from stop_visits    where trip_id in (select id from reset_ids);
  delete from stop_waits     where trip_id in (select id from reset_ids);
  delete from trips          where id in (select id from reset_ids);
  get diagnostics n = row_count;

  update vehicles set available = false, available_at = now(), available_route_id = null, available_driver_id = null
  where operator_id = op;
  return n;
end $$;
revoke execute on function reset_demo_today() from public, anon;
grant execute on function reset_demo_today() to authenticated;
