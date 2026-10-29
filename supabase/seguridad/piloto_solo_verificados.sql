-- NavIA · solo estudiantes aprobados ven la línea (aplicar ANTES del piloto con datos reales).
--
-- Hoy cualquiera puede crear una cuenta (sin verificar el correo) y ver en vivo dónde va cada
-- unidad, sus placas y fotos, y marcarse en una parada. Con esto, una cuenta de estudiante
-- "pendiente" no ve salidas, unidades, rutas ni paradas hasta que el fiscal la aprueba
-- (profiles.status = 'verified'). Conductores, fiscales y admin no cambian.
--
-- No está en migrations/ a propósito: mientras no exista el botón de aprobar en el panel, los
-- estudiantes que se registren solos verían la app vacía. Las cuentas de la demo ya son
-- 'verified' y siguen funcionando. Para aprobar a mano mientras tanto (SQL Editor):
--   update profiles set status = 'verified', verified_at = now()
--   where id = (select id from auth.users where lower(email) = 'correo@del.estudiante');

create or replace function can_see_line() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role <> 'student' or status = 'verified' from profiles where id = auth.uid()), false)
$$;
revoke execute on function can_see_line() from public, anon;
grant execute on function can_see_line() to authenticated;

drop policy if exists trips_read on trips;
create policy trips_read on trips for select to authenticated using (can_see_line());
drop policy if exists vehicles_read on vehicles;
create policy vehicles_read on vehicles for select to authenticated using (can_see_line());
drop policy if exists routes_read on routes;
create policy routes_read on routes for select to authenticated using (can_see_line());
drop policy if exists stops_read on stops;
create policy stops_read on stops for select to authenticated using (can_see_line());
drop policy if exists stop_visits_read on stop_visits;
create policy stop_visits_read on stop_visits for select to authenticated using (can_see_line());
drop policy if exists operators_read on operators;
create policy operators_read on operators for select to authenticated using (can_see_line());

-- "Estoy aquí" también exige la cuenta aprobada (igual que 0006 en todo lo demás).
create or replace function set_my_wait(
  p_trip_id uuid,
  p_stop_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  stop_lat double precision;
  stop_lng double precision;
begin
  if my_role() is distinct from 'student' then
    raise exception 'Solo los estudiantes marcan su parada' using errcode = '42501';
  end if;
  if not can_see_line() then
    raise exception 'Tu cuenta está pendiente de aprobación' using errcode = '42501', hint = 'pendiente';
  end if;

  if p_stop_id is null then
    delete from stop_waits where trip_id = p_trip_id and student_id = auth.uid() and picked_at is null;
    return;
  end if;

  select s.lat, s.lng into stop_lat, stop_lng
  from trips t join stops s on s.route_id = t.route_id and s.id = p_stop_id
  where t.id = p_trip_id and t.status in ('scheduled', 'en_camino', 'en_parada')
    and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
  if not found or exists (select 1 from stop_visits v where v.trip_id = p_trip_id and v.stop_id = p_stop_id) then
    raise exception 'Esa parada no está disponible en esta salida' using errcode = '22023';
  end if;

  if p_lat is null or p_lng is null then
    raise exception 'Hace falta tu ubicación para marcar la parada' using errcode = '22023', hint = 'sin_ubicacion';
  end if;
  if distance_m(p_lat, p_lng, stop_lat, stop_lng) > 50 then
    raise exception 'Debes estar a menos de 50 m de tu parada para marcarla' using errcode = '22023', hint = 'fuera_de_rango';
  end if;

  insert into stop_waits (trip_id, student_id, stop_id) values (p_trip_id, auth.uid(), p_stop_id)
  on conflict (trip_id, student_id) do update set stop_id = excluded.stop_id, created_at = now(), picked_at = null;
end $$;
revoke execute on function set_my_wait(uuid, uuid, double precision, double precision) from public, anon;
grant execute on function set_my_wait(uuid, uuid, double precision, double precision) to authenticated;
