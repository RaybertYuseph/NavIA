-- NavIA · corte 2: gestor de unidades del fiscal y disponibilidad coherente con la salida.
--
-- 1) Incorporar (create_vehicle), desincorporar y reincorporar (retire_vehicle, reinstate_vehicle).
--    Desincorporar es active = false: la unidad no se borra porque la usan las salidas pasadas.
-- 2) En servicio / fuera de servicio (in_service), por ejemplo por mantenimiento. Lo marca el
--    fiscal; es distinto de "Disponible", que lo marca el conductor. Fuera de servicio no se
--    activa en la parada ni toma salidas.
-- 3) Una ruta por unidad (vehicles.route_id). Al cambiarla, las salidas que la unidad tenía en
--    la ruta vieja y no han arrancado vuelven a quedar pendientes, y el conductor recibe un aviso
--    en notifications.
-- 4) Al llegar a la parada de salida la unidad queda disponible sola; al terminar la ruta deja
--    de estarlo hasta que el conductor se vuelva a activar.
-- Desincorporar o sacar de servicio una unidad en ruta no se permite.

alter table vehicles add column if not exists in_service boolean not null default true;

-- ───────────── Avisos para el conductor ─────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_unread on notifications (user_id) where read_at is null;
alter table notifications enable row level security;
drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_read on notifications;
create policy notifications_read on notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- ───────────── Utilidades internas ─────────────
create or replace function require_fiscal_vehicle(p_vehicle_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if my_role() not in ('coordinator', 'admin') or my_operator() is null then
    raise exception 'Solo el fiscal gestiona unidades' using errcode = '42501';
  end if;
  if p_vehicle_id is not null and not exists (select 1 from vehicles where id = p_vehicle_id and operator_id = my_operator()) then
    raise exception 'Esa unidad no es de tu línea' using errcode = '42501';
  end if;
end $$;
revoke execute on function require_fiscal_vehicle(uuid) from public, anon, authenticated;

-- Salidas de hoy en curso con esa unidad: con ellas no se retira ni se saca de servicio.
create or replace function vehicle_on_route(p_vehicle_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where vehicle_id = p_vehicle_id and status in ('en_parada', 'en_camino'));
$$;
revoke execute on function vehicle_on_route(uuid) from public, anon, authenticated;

-- Las salidas que la unidad tiene y no han arrancado vuelven a quedar pendientes de unidad.
create or replace function release_vehicle_trips(p_vehicle_id uuid, p_route_id uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update trips set vehicle_id = null, driver_id = null
  where vehicle_id = p_vehicle_id and status = 'scheduled'
    and (p_route_id is null or route_id = p_route_id)
    and scheduled_at >= date_trunc('day', now() at time zone 'America/Caracas') at time zone 'America/Caracas'
    and not exists (select 1 from trip_events e where e.trip_id = trips.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function release_vehicle_trips(uuid, uuid) from public, anon, authenticated;

-- Conductores con salidas abiertas en la unidad desde hoy (o que se activaron con ella): a quién avisar.
create or replace function notify_vehicle_drivers(p_vehicle_id uuid, p_body text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into notifications (user_id, body)
  select distinct d, p_body from (
    select available_driver_id as d from vehicles where id = p_vehicle_id
    union
    select driver_id from trips
    where vehicle_id = p_vehicle_id and status in ('scheduled', 'en_parada', 'en_camino')
      and scheduled_at >= date_trunc('day', now() at time zone 'America/Caracas') at time zone 'America/Caracas'
  ) x where d is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function notify_vehicle_drivers(uuid, text) from public, anon, authenticated;

-- ───────────── Incorporar ─────────────
create or replace function create_vehicle(p_plate text, p_capacity int, p_route_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  plate_n text := upper(regexp_replace(coalesce(p_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  prev    vehicles%rowtype;
  new_id  uuid;
begin
  perform require_fiscal_vehicle(null);
  if plate_n !~ '^[A-Z0-9]{5,8}$' then
    raise exception 'Placa no válida' using errcode = '22023', hint = 'placa';
  end if;
  if p_capacity is null or p_capacity not between 4 and 80 then
    raise exception 'Puestos no válidos' using errcode = '22023', hint = 'puestos';
  end if;
  if p_route_id is not null and not exists (select 1 from routes where id = p_route_id and operator_id = my_operator()) then
    raise exception 'Esa ruta no es de tu línea' using errcode = '22023';
  end if;
  select * into prev from vehicles where plate = plate_n;
  if found then
    raise exception 'Esa placa ya está registrada' using errcode = '23505',
      hint = case when prev.operator_id = my_operator() and not prev.active then 'desincorporada' else 'registrada' end;
  end if;
  insert into vehicles (operator_id, plate, capacity, route_id)
  values (my_operator(), plate_n, p_capacity, p_route_id)
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function create_vehicle(text, int, uuid) from public, anon;
grant execute on function create_vehicle(text, int, uuid) to authenticated;

-- ───────────── Desincorporar y reincorporar ─────────────
create or replace function retire_vehicle(p_vehicle_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  released int;
  v vehicles%rowtype;
begin
  perform require_fiscal_vehicle(p_vehicle_id);
  if vehicle_on_route(p_vehicle_id) then
    raise exception 'La unidad está en ruta' using errcode = '55000', hint = 'en_ruta';
  end if;
  select * into v from vehicles where id = p_vehicle_id;
  perform notify_vehicle_drivers(p_vehicle_id, format('La unidad %s fue desincorporada. Tus salidas con ella quedan pendientes de unidad.', v.plate));
  released := release_vehicle_trips(p_vehicle_id);
  update vehicles set active = false, available = false, available_at = now(),
                      available_route_id = null, available_driver_id = null, route_id = null
  where id = p_vehicle_id;
  return released;
end $$;
revoke execute on function retire_vehicle(uuid) from public, anon;
grant execute on function retire_vehicle(uuid) to authenticated;

create or replace function reinstate_vehicle(p_vehicle_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_fiscal_vehicle(p_vehicle_id);
  update vehicles set active = true, in_service = true where id = p_vehicle_id;
end $$;
revoke execute on function reinstate_vehicle(uuid) from public, anon;
grant execute on function reinstate_vehicle(uuid) to authenticated;

-- ───────────── En servicio / fuera de servicio ─────────────
create or replace function set_vehicle_in_service(p_vehicle_id uuid, p_in_service boolean) returns int
language plpgsql security definer set search_path = public as $$
declare
  released int := 0;
  v vehicles%rowtype;
begin
  perform require_fiscal_vehicle(p_vehicle_id);
  if not p_in_service then
    if vehicle_on_route(p_vehicle_id) then
      raise exception 'La unidad está en ruta' using errcode = '55000', hint = 'en_ruta';
    end if;
    select * into v from vehicles where id = p_vehicle_id;
    perform notify_vehicle_drivers(p_vehicle_id, format('La unidad %s quedó fuera de servicio. Tus salidas con ella quedan pendientes de unidad.', v.plate));
    released := release_vehicle_trips(p_vehicle_id);
    update vehicles set available = false, available_at = now(), available_route_id = null, available_driver_id = null
    where id = p_vehicle_id;
  end if;
  update vehicles set in_service = p_in_service where id = p_vehicle_id;
  return released;
end $$;
revoke execute on function set_vehicle_in_service(uuid, boolean) from public, anon;
grant execute on function set_vehicle_in_service(uuid, boolean) to authenticated;

-- ───────────── Una ruta por unidad, con aviso ─────────────
create or replace function assign_vehicle_route(p_vehicle_id uuid, p_route_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v vehicles%rowtype;
  new_name text;
begin
  perform require_fiscal_vehicle(p_vehicle_id);
  if p_route_id is not null and not exists (select 1 from routes where id = p_route_id and operator_id = my_operator()) then
    raise exception 'Esa ruta no es de tu línea' using errcode = '22023';
  end if;
  select * into v from vehicles where id = p_vehicle_id for update;
  if v.route_id is not distinct from p_route_id then
    return;
  end if;
  if v.route_id is not null then
    select name into new_name from routes where id = p_route_id;
    perform notify_vehicle_drivers(p_vehicle_id, case
      when p_route_id is null then format('Tu unidad %s ya no cubre %s.', v.plate, (select name from routes where id = v.route_id))
      else format('Tu unidad %s ahora cubre %s.', v.plate, new_name) end);
    perform release_vehicle_trips(p_vehicle_id, v.route_id);
  end if;
  update vehicles set route_id = p_route_id,
                      available_route_id = case when available_route_id = v.route_id then null else available_route_id end,
                      available = case when available_route_id = v.route_id then false else available end
  where id = p_vehicle_id;
end $$;

-- ───────────── Fuera de servicio no se activa ─────────────
create or replace function vehicles_guard_in_service() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.available and not old.available and not (new.in_service and new.active) then
    raise exception 'Esta unidad está fuera de servicio' using errcode = '55000', hint = 'fuera_de_servicio';
  end if;
  return new;
end $$;
drop trigger if exists vehicles_guard_in_service on vehicles;
create trigger vehicles_guard_in_service before update of available on vehicles
  for each row execute function vehicles_guard_in_service();

-- Tampoco toma salidas: el conductor no puede quedar asignado a una salida con ella.
create or replace function trips_guard_in_service() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.vehicle_id is not null and new.vehicle_id is distinct from old.vehicle_id
     and exists (select 1 from vehicles where id = new.vehicle_id and not (in_service and active)) then
    raise exception 'Esta unidad está fuera de servicio' using errcode = '55000', hint = 'fuera_de_servicio';
  end if;
  return new;
end $$;
drop trigger if exists trips_guard_in_service on trips;
create trigger trips_guard_in_service before update of vehicle_id on trips
  for each row execute function trips_guard_in_service();

-- ───────────── Disponible mientras carga, no disponible al terminar ─────────────
create or replace function trips_sync_availability() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.vehicle_id is null or new.status is not distinct from old.status then
    return new;
  end if;
  if new.status in ('en_parada', 'en_camino') then
    update vehicles set available = true, available_at = coalesce(available_at, now()),
                        available_route_id = coalesce(available_route_id, new.route_id),
                        available_driver_id = coalesce(available_driver_id, new.driver_id)
    where id = new.vehicle_id and not available;
  elsif new.status in ('finalizada', 'cancelada') then
    update vehicles set available = false, available_at = now(), available_route_id = null, available_driver_id = null
    where id = new.vehicle_id;
  end if;
  return new;
end $$;
drop trigger if exists trips_sync_availability on trips;
create trigger trips_sync_availability after update of status on trips
  for each row execute function trips_sync_availability();

-- El conductor no se marca "No disponible" a mitad de ruta (igual que 0008, con esa regla).
create or replace function set_vehicle_available(p_vehicle_id uuid, p_available boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from trips t
    where t.vehicle_id = p_vehicle_id and t.driver_id = auth.uid()
      and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
  ) then
    raise exception 'Esta unidad no está asignada a ti hoy' using errcode = '42501';
  end if;
  if not p_available then
    if vehicle_on_route(p_vehicle_id) then
      raise exception 'La unidad está en ruta' using errcode = '55000', hint = 'en_ruta';
    end if;
    update trips set vehicle_id = null, driver_id = null
    where vehicle_id = p_vehicle_id and driver_id = auth.uid() and status = 'scheduled'
      and not exists (select 1 from trip_events e where e.trip_id = trips.id)
      and (scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date;
  end if;
  update vehicles set available = p_available, available_at = now(),
                      available_route_id = case when p_available then available_route_id end,
                      available_driver_id = case when p_available then available_driver_id end
  where id = p_vehicle_id;
end $$;
