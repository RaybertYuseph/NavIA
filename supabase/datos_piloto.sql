-- Datos para probar en el proyecto Supabase real (no el local).
-- Pegar en Supabase → SQL Editor DESPUÉS de que estén aplicadas las migraciones
-- y DESPUÉS de que el conductor y el estudiante hayan entrado una vez a la app
-- con su celular (así ya existe su perfil).
--
-- Cambia los dos teléfonos del bloque do $$ de abajo (formato 58 + número sin el 0: 0414-1234567 → 584141234567).
-- Se puede correr varias veces: crea las salidas de HOY sin duplicar.

insert into universities (id, name, short_name) values
  ('00000000-0000-0000-0000-000000000001', 'Universidad Santa María', 'USM')
on conflict do nothing;

insert into operators (id, name, rif, pm_bank_code, pm_phone, pm_id_number) values
  ('00000000-0000-0000-0000-000000000010', 'Transporte Piloto C.A.', 'J-00000000-0', '0102', '04120000000', 'V-00000000')
on conflict do nothing;

insert into vehicles (id, operator_id, plate, capacity) values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'AB123CD', 30)
on conflict do nothing;

insert into routes (id, operator_id, university_id, name, direction, fare_usd) values
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001', 'Chacaíto → USM La Florencia', 'ida', 1.50)
on conflict do nothing;

insert into stops (route_id, seq, name, lat, lng) values
  ('00000000-0000-0000-0000-000000000030', 1, 'Chacaíto (salida Metro)', 10.4917, -66.8722),
  ('00000000-0000-0000-0000-000000000030', 2, 'Altamira (plaza)',        10.4961, -66.8494),
  ('00000000-0000-0000-0000-000000000030', 3, 'Los Dos Caminos',         10.4943, -66.8297),
  ('00000000-0000-0000-0000-000000000030', 4, 'Petare (redoma)',         10.4767, -66.8091),
  ('00000000-0000-0000-0000-000000000030', 5, 'USM La Florencia',        10.4691, -66.7797)
on conflict do nothing;

do $$
declare
  conductor  text := '584140000001';  -- ← cambia este
  estudiante text := '584140000002';  -- ← y este
  driver_id  uuid;
begin
  update profiles set role = 'driver', status = 'verified', operator_id = '00000000-0000-0000-0000-000000000010'
    where phone = conductor returning id into driver_id;
  if driver_id is null then
    raise exception 'No hay perfil con el teléfono %: el conductor debe entrar una vez a la app primero', conductor;
  end if;
  update profiles set status = 'verified', university_id = '00000000-0000-0000-0000-000000000001'
    where phone = estudiante;

  insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
  select '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', driver_id,
         ((now() at time zone 'America/Caracas')::date + t) at time zone 'America/Caracas'
  from (values (time '06:00'), (time '13:00')) as s(t)
  on conflict (route_id, scheduled_at) do nothing;
end $$;

select full_name, phone, role, status from profiles order by created_at desc limit 5;
