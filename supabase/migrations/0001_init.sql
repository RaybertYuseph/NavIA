-- NavIA · migración inicial (Supabase / Postgres 15+)
-- Ubicación en el repo: supabase/migrations/0001_init.sql
-- Principio: NavIA no custodia fondos. Los pagos entran a la cuenta del operador;
-- aquí solo se registran referencias y se concilian.

create extension if not exists pgcrypto;

-- ───────────── Tipos ─────────────
create type user_role       as enum ('student', 'driver', 'coordinator', 'admin');
create type verification    as enum ('pending', 'verified', 'rejected');
create type route_direction as enum ('ida', 'regreso');
create type trip_status     as enum ('scheduled', 'en_camino', 'en_parada', 'finalizada', 'cancelada');
create type trip_event_type as enum ('en_camino', 'en_parada', 'parada_completada', 'fin_de_ruta', 'abordaje', 'cancelada');
create type booking_status  as enum ('reserved', 'waitlist', 'boarded', 'no_show', 'cancelled');
create type pay_status      as enum ('unpaid', 'pending', 'paid', 'cash', 'pass');
create type pay_method      as enum ('pago_movil', 'cash_usd');
create type payment_status  as enum ('reported', 'matched', 'confirmed', 'rejected');

-- ───────────── Organización ─────────────
create table universities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text not null unique            -- 'USM'
);

create table operators (                     -- dueño de las unidades y de la cuenta que cobra
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  rif                text unique,
  pm_bank_code       text,                    -- datos de pago móvil que ve el estudiante
  pm_phone           text,
  pm_id_number       text,
  created_at         timestamptz not null default now()
);

-- ───────────── Usuarios ─────────────
create table profiles (                      -- 1:1 con auth.users de Supabase
  id             uuid primary key references auth.users (id) on delete cascade,
  role           user_role not null default 'student',
  full_name      text not null,
  cedula         text unique,
  phone          text unique,
  university_id  uuid references universities (id),
  operator_id    uuid references operators (id),   -- conductores y coordinadores
  status         verification not null default 'pending',
  id_card_path   text,                              -- foto del carnet en Storage (E1-H2)
  qr_seed        bytea not null default gen_random_bytes(20), -- semilla TOTP del QR rotativo (E1-H3)
  verified_by    uuid references profiles (id),
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators (id),
  plate        text not null unique,
  capacity     int  not null check (capacity > 0),
  active       boolean not null default true
);

-- ───────────── Rutas y salidas ─────────────
create table routes (
  id             uuid primary key default gen_random_uuid(),
  operator_id    uuid not null references operators (id),
  university_id  uuid not null references universities (id),
  name           text not null,
  direction      route_direction not null,
  fare_usd       numeric(8,2) not null check (fare_usd >= 0),
  active         boolean not null default true
);

create table stops (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid not null references routes (id) on delete cascade,
  seq         int  not null,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  geofence_m  int not null default 80,        -- radio para marcar la parada sola (E3-H4)
  unique (route_id, seq)
);

create table trips (                          -- una salida concreta de una ruta
  id               uuid primary key default gen_random_uuid(),
  route_id         uuid not null references routes (id),
  vehicle_id       uuid references vehicles (id),
  driver_id        uuid references profiles (id),
  scheduled_at     timestamptz not null,
  status           trip_status not null default 'scheduled',
  current_stop_id  uuid references stops (id),
  last_lat         double precision,
  last_lng         double precision,
  last_seen_at     timestamptz,               -- antigüedad del dato que ve el estudiante
  started_at       timestamptz,
  ended_at         timestamptz,
  unique (route_id, scheduled_at)
);
create index on trips (status, scheduled_at);

create table trip_events (                    -- log inmutable de botones y abordajes
  id               bigint generated always as identity primary key,
  trip_id          uuid not null references trips (id),
  type             trip_event_type not null,
  stop_id          uuid references stops (id),
  booking_id       uuid,
  actor_id         uuid not null references profiles (id),
  client_event_id  uuid not null unique,      -- idempotencia de la cola offline
  occurred_at      timestamptz not null,      -- hora del teléfono
  received_at      timestamptz not null default now()
);
create index on trip_events (trip_id, occurred_at);

create table location_pings (                 -- GPS cada 15–30 s (E3-H2); retención 30 días con pg_cron
  id           bigint generated always as identity primary key,
  trip_id      uuid not null references trips (id),
  lat          double precision not null,
  lng          double precision not null,
  speed_kmh    real,
  recorded_at  timestamptz not null,
  unique (trip_id, recorded_at)
);

create table stop_visits (                    -- paradas completadas (E3-H4)
  trip_id      uuid not null references trips (id),
  stop_id      uuid not null references stops (id),
  arrived_at   timestamptz,
  departed_at  timestamptz,
  source       text not null check (source in ('geofence', 'manual')),
  primary key (trip_id, stop_id)
);

-- ───────────── Reservas y pases ─────────────
create table passes (                         -- pase semanal (E4-H4)
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles (id),
  route_id    uuid references routes (id),    -- null = todas las rutas del operador
  valid_from  date not null,
  valid_to    date not null,
  price_usd   numeric(8,2) not null,
  pay_status  pay_status not null default 'unpaid',
  check (valid_to >= valid_from)
);

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips (id),
  student_id     uuid not null references profiles (id),
  stop_id        uuid not null references stops (id),
  status         booking_status not null default 'reserved',
  waitlist_pos   int,                          -- solo si status = 'waitlist' (E2-H3)
  pay_status     pay_status not null default 'unpaid',
  pass_id        uuid references passes (id),
  fare_usd       numeric(8,2) not null,        -- tarifa congelada al reservar
  boarded_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (trip_id, student_id)
);
create index on bookings (trip_id, status);

-- ───────────── Pagos (solo conciliación) ─────────────
create table exchange_rates (                 -- tasa BCV diaria (E4-H1)
  rate_date  date primary key,
  usd_ves    numeric(14,4) not null check (usd_ves > 0),
  source     text not null default 'BCV'
);

create table payments (                       -- lo que el estudiante declara haber pagado
  id            uuid primary key default gen_random_uuid(),
  payer_id      uuid not null references profiles (id),
  operator_id   uuid not null references operators (id),
  method        pay_method not null,
  amount_ves    numeric(14,2),
  amount_usd    numeric(10,2) not null,
  rate_date     date references exchange_rates (rate_date),
  bank_code     text,                         -- banco emisor del pago móvil
  reference     text,                         -- referencia bancaria
  payer_phone   text,
  paid_at       timestamptz not null,
  status        payment_status not null default 'reported',
  recorded_by   uuid references profiles (id), -- el conductor, si es efectivo (E4-H5)
  confirmed_by  uuid references profiles (id),
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (method = 'cash_usd' or (reference is not null and amount_ves is not null))
);
create unique index payments_ref_unique on payments (operator_id, bank_code, reference)
  where reference is not null;               -- una referencia no se usa dos veces

create table payment_allocations (            -- un pago puede cubrir varias reservas o un pase
  payment_id  uuid not null references payments (id) on delete cascade,
  booking_id  uuid references bookings (id),
  pass_id     uuid references passes (id),
  amount_usd  numeric(10,2) not null,
  check ((booking_id is null) <> (pass_id is null))
);

create table bank_statement_imports (         -- CSV del banco del operador subido por el coordinador
  id           uuid primary key default gen_random_uuid(),
  operator_id  uuid not null references operators (id),
  file_path    text not null,
  imported_by  uuid not null references profiles (id),
  imported_at  timestamptz not null default now()
);

create table bank_statement_lines (
  id                  bigint generated always as identity primary key,
  import_id           uuid not null references bank_statement_imports (id) on delete cascade,
  operator_id         uuid not null references operators (id),
  posted_at           timestamptz not null,
  reference           text not null,
  amount_ves          numeric(14,2) not null,
  matched_payment_id  uuid references payments (id),
  unique (operator_id, reference, posted_at)
);

-- ───────────── Norbit y avisos ─────────────
create table norbit_messages (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references profiles (id),
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  tool_calls  jsonb,
  tokens_in   int,
  tokens_out  int,
  fallback    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on norbit_messages (profile_id, created_at desc);

create table escalations (                    -- "Norbit no sabe" → coordinador (E5-H3)
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles (id),
  trip_id      uuid references trips (id),
  reason       text not null,
  resolved_by  uuid references profiles (id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ───────────── Reglas en la BD ─────────────
-- El conductor solo envía eventos; el estado de la salida se deriva aquí.
create or replace function apply_trip_event() returns trigger language plpgsql as $$
begin
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
  if new.type = 'abordaje' and new.booking_id is not null then
    update bookings set status = 'boarded', boarded_at = new.occurred_at where id = new.booking_id;
  end if;
  return new;
end $$;
create trigger trip_events_apply after insert on trip_events
  for each row execute function apply_trip_event();

create or replace function apply_location_ping() returns trigger language plpgsql as $$
begin
  update trips set last_lat = new.lat, last_lng = new.lng, last_seen_at = new.recorded_at
  where id = new.trip_id and (last_seen_at is null or last_seen_at < new.recorded_at);
  return new;
end $$;
create trigger location_pings_apply after insert on location_pings
  for each row execute function apply_location_ping();

-- Al confirmar un pago, sus reservas y pases quedan pagados.
create or replace function apply_payment_confirmation() returns trigger language plpgsql as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    update bookings b set pay_status = case when new.method = 'cash_usd' then 'cash'::pay_status else 'paid'::pay_status end
      from payment_allocations a where a.payment_id = new.id and a.booking_id = b.id;
    update passes p set pay_status = 'paid'
      from payment_allocations a where a.payment_id = new.id and a.pass_id = p.id;
  end if;
  return new;
end $$;
create trigger payments_confirm after update of status on payments
  for each row execute function apply_payment_confirmation();

-- Sugerencia de conciliación: misma referencia (últimos 6 dígitos) y mismo monto ±1 Bs.
create or replace view reconciliation_suggestions as
select p.id as payment_id, l.id as line_id, p.reference, p.amount_ves, l.amount_ves as bank_amount_ves, l.posted_at
from payments p
join bank_statement_lines l
  on l.operator_id = p.operator_id
 and right(l.reference, 6) = right(p.reference, 6)
 and abs(l.amount_ves - p.amount_ves) <= 1
where p.status = 'reported' and l.matched_payment_id is null;

-- ───────────── Seguridad (RLS) ─────────────
create or replace function my_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function my_operator() returns uuid language sql stable security definer set search_path = public as $$
  select operator_id from profiles where id = auth.uid()
$$;

alter table profiles             enable row level security;
alter table trips                enable row level security;
alter table trip_events          enable row level security;
alter table location_pings       enable row level security;
alter table bookings             enable row level security;
alter table passes               enable row level security;
alter table payments             enable row level security;
alter table payment_allocations  enable row level security;
alter table bank_statement_lines enable row level security;
alter table norbit_messages      enable row level security;
alter table routes               enable row level security;
alter table stops                enable row level security;

-- Catálogo público para usuarios autenticados
create policy routes_read on routes for select to authenticated using (true);
create policy stops_read  on stops  for select to authenticated using (true);
create policy trips_read  on trips  for select to authenticated using (true);

-- Perfil: cada quien el suyo; coordinador ve los de su operador y aprueba
create policy profiles_self on profiles for select using (id = auth.uid() or my_role() in ('coordinator', 'admin'));
create policy profiles_update_coord on profiles for update using (my_role() in ('coordinator', 'admin'));

-- Reservas: el estudiante las suyas; conductor y coordinador las de su operador
create policy bookings_student on bookings for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy bookings_staff on bookings for select using (
  my_role() in ('driver', 'coordinator', 'admin')
  and exists (select 1 from trips t join routes r on r.id = t.route_id where t.id = trip_id and r.operator_id = my_operator()));

-- Eventos y GPS: solo el conductor asignado a la salida
create policy trip_events_driver on trip_events for insert with check (
  actor_id = auth.uid() and exists (select 1 from trips t where t.id = trip_id and t.driver_id = auth.uid()));
create policy pings_driver on location_pings for insert with check (
  exists (select 1 from trips t where t.id = trip_id and t.driver_id = auth.uid() and t.status in ('en_camino', 'en_parada')));

-- Pagos: el estudiante reporta y ve los suyos; el coordinador concilia los de su operador
create policy payments_student_read   on payments for select using (payer_id = auth.uid());
create policy payments_student_insert on payments for insert with check (payer_id = auth.uid() and status = 'reported');
create policy payments_staff on payments for all using (my_role() in ('coordinator', 'admin') and operator_id = my_operator());
create policy statement_staff on bank_statement_lines for all using (my_role() in ('coordinator', 'admin') and operator_id = my_operator());

create policy norbit_self on norbit_messages for select using (profile_id = auth.uid());
