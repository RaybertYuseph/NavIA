-- Datos de prueba: USM, 1 operador, 1 unidad, 1 ruta con 5 paradas, 1 conductor,
-- 1 estudiante y 2 salidas para hoy. Coordenadas aproximadas, solo para probar.
-- Se aplica con `npx supabase db reset` (local). Para entrar, escribe el correo en /login y
-- busca el código en el buzón local de Supabase (Inbucket/Mailpit: http://localhost:54324).

insert into universities (id, name, short_name) values
  ('00000000-0000-0000-0000-000000000001', 'Universidad Santa María', 'USM');

insert into operators (id, name, rif, pm_bank_code, pm_phone, pm_id_number) values
  ('00000000-0000-0000-0000-000000000010', 'Transporte Piloto C.A.', 'J-00000000-0', '0102', '04120000000', 'V-00000000');

insert into vehicles (id, operator_id, plate, capacity) values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'AB123CD', 30);
-- (Las unidades extra de la demo las crea supabase/demo.sql.)

insert into routes (id, operator_id, university_id, name, direction, fare_usd) values
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001', 'Chacaíto → USM La Florencia', 'ida', 1.50);

insert into stops (route_id, seq, name, lat, lng) values
  ('00000000-0000-0000-0000-000000000030', 1, 'Chacaíto (salida Metro)',   10.4917, -66.8722),
  ('00000000-0000-0000-0000-000000000030', 2, 'Altamira (plaza)',          10.4961, -66.8494),
  ('00000000-0000-0000-0000-000000000030', 3, 'Los Dos Caminos',           10.4943, -66.8297),
  ('00000000-0000-0000-0000-000000000030', 4, 'Petare (redoma)',           10.4767, -66.8091),
  ('00000000-0000-0000-0000-000000000030', 5, 'USM La Florencia',          10.4691, -66.7797);

-- Usuarios de prueba (solo local; en producción se registran solos por OTP).
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated',
   'conductor@navia.test', now(), '{"full_name": "Conductor de Prueba"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e1', 'authenticated', 'authenticated',
   'estudiante@navia.test', now(), '{"full_name": "Estudiante de Prueba"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated',
   'fiscal@navia.test', now(), '{"full_name": "Fiscal de Prueba"}', now(), now());

-- El trigger handle_new_user ya creó los perfiles; aquí se asignan rol y operador.
update profiles set role = 'driver', status = 'verified', operator_id = '00000000-0000-0000-0000-000000000010'
  where id = '00000000-0000-0000-0000-0000000000d1';
update profiles set status = 'verified', university_id = '00000000-0000-0000-0000-000000000001'
  where id = '00000000-0000-0000-0000-0000000000e1';
update profiles set role = 'coordinator', status = 'verified', operator_id = '00000000-0000-0000-0000-000000000010'
  where id = '00000000-0000-0000-0000-0000000000c1';

-- Dos salidas para hoy (hora de Caracas, UTC-4).
insert into trips (route_id, vehicle_id, driver_id, scheduled_at)
select '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020',
       '00000000-0000-0000-0000-0000000000d1',
       ((now() at time zone 'America/Caracas')::date + t) at time zone 'America/Caracas'
from (values (time '06:00'), (time '13:00')) as s(t);

-- Ruta "Próximamente" (sin salidas) para probar el filtro del fiscal y la asignación de unidades.
update routes set corridor = 'Chacaíto' where id = '00000000-0000-0000-0000-000000000030';
insert into routes (id, operator_id, university_id, name, direction, fare_usd, corridor, coming_soon) values
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'California → USM', 'ida', 1.00, 'California', true);
insert into stops (route_id, seq, name, lat, lng) values
  ('00000000-0000-0000-0000-000000000041', 1, 'California Norte', 10.4880, -66.8160),
  ('00000000-0000-0000-0000-000000000041', 2, 'USM La Florencia', 10.4691, -66.7797);
