-- NavIA · corte 1: correcciones de seguridad y lo mínimo para operar la ruta.
--
-- 1) Los triggers de 0001 corrían con los permisos de quien inserta. Con RLS activo,
--    el conductor no tiene UPDATE sobre trips, así que el UPDATE del trigger afectaba
--    0 filas sin dar error: el botón "En camino" se guardaba pero la salida no cambiaba.
--    Lo mismo con el GPS y con la confirmación de pagos del coordinador.
--    Se pasan a SECURITY DEFINER (la regla vive en la BD, no en el permiso del usuario).
-- 2) Tablas sin RLS quedaban abiertas a cualquier sesión (incluso anónima) vía la API.
-- 3) Al registrarse por OTP se crea el perfil automáticamente.
-- 4) Las paradas marcadas por el conductor quedan en stop_visits.
-- 5) trips se publica en Realtime para el estado en vivo del estudiante.

-- ───────────── 1 y 4. Triggers con permisos propios ─────────────
create or replace function apply_trip_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prev_stop uuid;
begin
  select current_stop_id into prev_stop from trips where id = new.trip_id;

  update trips set
    status = case new.type
               when 'en_camino'   then 'en_camino'::trip_status
               when 'en_parada'   then 'en_parada'::trip_status
               when 'fin_de_ruta' then 'finalizada'::trip_status
               when 'cancelada'   then 'cancelada'::trip_status
               else status end,
    current_stop_id = coalesce(new.stop_id, current_stop_id),
    started_at = case when new.type = 'en_camino' then coalesce(started_at, new.occurred_at) else started_at end,
    ended_at   = case when new.type = 'fin_de_ruta' then new.occurred_at else ended_at end
  where id = new.trip_id;

  if new.type = 'en_parada' and new.stop_id is not null then
    insert into stop_visits (trip_id, stop_id, arrived_at, source)
    values (new.trip_id, new.stop_id, new.occurred_at, 'manual')
    on conflict (trip_id, stop_id) do nothing;
  end if;

  -- Salir de una parada (o terminar la ruta) cierra la visita abierta.
  if new.type in ('en_camino', 'parada_completada', 'fin_de_ruta') and prev_stop is not null then
    update stop_visits set departed_at = new.occurred_at
    where trip_id = new.trip_id and stop_id = prev_stop and departed_at is null;
  end if;

  if new.type = 'abordaje' and new.booking_id is not null then
    update bookings set status = 'boarded', boarded_at = new.occurred_at
    where id = new.booking_id and trip_id = new.trip_id;
  end if;
  return new;
end $$;

create or replace function apply_location_ping() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update trips set last_lat = new.lat, last_lng = new.lng, last_seen_at = new.recorded_at
  where id = new.trip_id and (last_seen_at is null or last_seen_at < new.recorded_at);
  return new;
end $$;

create or replace function apply_payment_confirmation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    update bookings b set pay_status = case when new.method = 'cash_usd' then 'cash'::pay_status else 'paid'::pay_status end
      from payment_allocations a where a.payment_id = new.id and a.booking_id = b.id;
    update passes p set pay_status = 'paid'
      from payment_allocations a where a.payment_id = new.id and a.pass_id = p.id;
  end if;
  return new;
end $$;

-- ───────────── 2. RLS en las tablas que faltaban ─────────────
alter table universities           enable row level security;
alter table operators              enable row level security;
alter table vehicles               enable row level security;
alter table stop_visits            enable row level security;
alter table exchange_rates         enable row level security;
alter table bank_statement_imports enable row level security;
alter table escalations            enable row level security;
alter table push_subscriptions     enable row level security;

create policy universities_read   on universities   for select to authenticated using (true);
create policy operators_read      on operators      for select to authenticated using (true); -- datos de pago móvil visibles al estudiante
create policy exchange_rates_read on exchange_rates for select to authenticated using (true);
create policy stop_visits_read    on stop_visits    for select to authenticated using (true);
create policy vehicles_staff      on vehicles       for select using (
  my_role() in ('driver', 'coordinator', 'admin') and operator_id = my_operator());
create policy imports_staff       on bank_statement_imports for all using (
  my_role() in ('coordinator', 'admin') and operator_id = my_operator());
create policy escalations_self    on escalations    for select using (
  profile_id = auth.uid() or my_role() in ('coordinator', 'admin'));
create policy push_self           on push_subscriptions for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ───────────── 3. Perfil automático al registrarse ─────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.phone, 'Sin nombre'),
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- El estudiante puede completar su nombre; rol, estado y operador solo los cambia el coordinador.
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (full_name, cedula, university_id, id_card_path) on profiles to authenticated;
-- El coordinador actualiza vía service_role o funciones del panel (Sprint 4).

-- ───────────── 5. Realtime ─────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table trips;
  end if;
end $$;

-- ───────────── 6. Reenvío idempotente de la cola offline ─────────────
-- Con RLS, INSERT ... ON CONFLICT DO NOTHING falla si quien inserta no puede LEER la
-- fila que ya existe. Sin esto, reenviar un evento ya sincronizado da error en vez de
-- ignorarse. El conductor puede leer sus propios eventos y pings.
create policy trip_events_driver_read on trip_events for select using (actor_id = auth.uid());
create policy pings_driver_read on location_pings for select using (
  exists (select 1 from trips t where t.id = trip_id and t.driver_id = auth.uid()));
