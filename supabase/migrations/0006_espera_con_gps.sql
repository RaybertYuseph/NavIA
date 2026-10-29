-- NavIA · corte 2: "Estoy en la parada" solo desde la parada.
--
-- set_my_wait recibe la ubicación del estudiante y solo acepta la marca si está a 50 m o menos
-- de la parada (haversine contra stops.lat/lng). El cliente lo revisa antes para dar el aviso
-- al momento; aquí se vuelve a validar para que no dependa solo del navegador.

create or replace function distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- La versión de dos argumentos se reemplaza (con los nuevos opcionales habría ambigüedad).
drop function if exists set_my_wait(uuid, uuid);

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
