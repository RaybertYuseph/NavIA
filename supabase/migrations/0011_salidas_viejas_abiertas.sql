-- Una salida de un día anterior que quedó "En camino" o "Cargando" (nadie marcó fin de ruta)
-- dejaba la unidad "en ruta" para siempre: el conductor no podía marcarse No disponible y el
-- fiscal no podía reasignarla ni desincorporarla. Ahora "en ruta" es solo con una salida de hoy,
-- y las salidas viejas que quedaron abiertas se cierran.

create or replace function vehicle_on_route(p_vehicle_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trips
    where vehicle_id = p_vehicle_id and status in ('en_parada', 'en_camino')
      and scheduled_at >= date_trunc('day', now() at time zone 'America/Caracas') at time zone 'America/Caracas'
  );
$$;
revoke execute on function vehicle_on_route(uuid) from public, anon, authenticated;

-- Cierre único de lo que quedó abierto antes de hoy. Sin el disparador de disponibilidad, para no
-- apagar una unidad que hoy sí está activa.
alter table trips disable trigger trips_sync_availability;
update trips
set status   = case when status = 'scheduled' then 'cancelada'::trip_status else 'finalizada'::trip_status end,
    ended_at = case when status = 'scheduled' then ended_at else coalesce(ended_at, now()) end
where status in ('scheduled', 'en_parada', 'en_camino')
  and scheduled_at < date_trunc('day', now() at time zone 'America/Caracas') at time zone 'America/Caracas';
alter table trips enable trigger trips_sync_availability;
