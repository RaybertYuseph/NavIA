-- NavIA · cuentas y unidades de la demo para la presentación.
-- Pegar en Supabase → SQL Editor → Run, DESPUÉS de:
--   1. aplicar supabase/migrations/0004_tres_vistas.sql, y
--   2. crear en la app (pestaña "Crear cuenta") las tres cuentas de la demo, todas con la
--      misma contraseña (la que pongas en NEXT_PUBLIC_DEMO_PASSWORD en Vercel):
--        fiscal@navia.test · conductor@navia.test · estudiante@navia.test
-- Se puede correr varias veces.

-- Tres unidades del operador piloto (cambia placas y capacidad por las reales).
insert into vehicles (id, operator_id, plate, capacity) values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'AB123CD', 30),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000010', 'AC456EF', 30),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000010', 'AD789GH', 25)
on conflict (id) do update set plate = excluded.plate, capacity = excluded.capacity, active = true;

do $$
declare
  fiscal     uuid := (select id from auth.users where lower(email) = 'fiscal@navia.test');
  conductor  uuid := (select id from auth.users where lower(email) = 'conductor@navia.test');
  estudiante uuid := (select id from auth.users where lower(email) = 'estudiante@navia.test');
begin
  if fiscal is null or conductor is null or estudiante is null then
    raise exception 'Faltan cuentas: crea fiscal@, conductor@ y estudiante@navia.test en la app primero';
  end if;

  update profiles set role = 'coordinator', status = 'verified', full_name = 'Fiscal de la línea',
                      operator_id = '00000000-0000-0000-0000-000000000010'
    where id = fiscal;
  update profiles set role = 'driver', status = 'verified', full_name = 'Conductor de la demo',
                      operator_id = '00000000-0000-0000-0000-000000000010'
    where id = conductor;
  update profiles set role = 'student', status = 'verified', full_name = 'Estudiante de la demo',
                      university_id = '00000000-0000-0000-0000-000000000001'
    where id = estudiante;

  -- Reparte las salidas de hoy entre las 3 unidades (por hora) y se las asigna al conductor demo.
  with hoy as (
    select t.id, row_number() over (order by t.scheduled_at, t.route_id) as n
    from trips t join routes r on r.id = t.route_id
    where r.operator_id = '00000000-0000-0000-0000-000000000010'
      and (t.scheduled_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
  )
  update trips t set
    driver_id = conductor,
    vehicle_id = (array['00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000021',
                        '00000000-0000-0000-0000-000000000022']::uuid[])[1 + (hoy.n - 1) % 3]
  from hoy where hoy.id = t.id;
end $$;

select u.email, p.full_name, p.role from profiles p join auth.users u on u.id = p.id
where u.email like '%@navia.test' order by p.role;
