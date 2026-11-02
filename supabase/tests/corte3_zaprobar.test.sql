-- Aprobar estudiantes (0017): registro con cédula y teléfono, y el fiscal aprueba o rechaza.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- ───── Registro ─────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'nueva@gmail.com',
   '{"full_name": "Nueva Estudiante", "cedula": "V-28.111.222", "phone": "+58 414 1112233"}');
select pg_temp.assert(
  (select cedula = '28111222' and phone = '04141112233' and status = 'pending' and role = 'student'
     and university_id = '00000000-0000-0000-0000-000000000001'
   from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  'el registro guarda cédula, teléfono y universidad, y queda pendiente');

-- Cédula repetida: la cuenta se crea igual, sin cédula.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f2', 'otra@gmail.com', '{"full_name": "Otra", "cedula": "28111222"}');
select pg_temp.assert((select cedula is null from profiles where id = '00000000-0000-0000-0000-0000000000f2'),
  'una cédula repetida no impide crear la cuenta');

-- ───── El estudiante no se aprueba solo ni ve la lista ─────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
do $$ begin
  perform * from students_to_review();
  raise exception 'FALLO: un estudiante ve la lista';
exception when insufficient_privilege then raise notice 'ok: un estudiante no ve la lista';
end $$;
do $$ begin
  perform review_student('00000000-0000-0000-0000-0000000000f1', true);
  raise exception 'FALLO: un estudiante se aprueba solo';
exception when insufficient_privilege then raise notice 'ok: un estudiante no se aprueba solo';
end $$;
do $$ begin
  update profiles set status = 'verified' where id = auth.uid();
exception when insufficient_privilege then raise notice 'ok: el estudiante no toca su estado';
end $$;
reset role;
select pg_temp.assert((select status = 'pending' from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  'el estudiante no cambia su estado por la API');

-- ───── El fiscal revisa ─────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert(
  (select count(*) = 2 from students_to_review() where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')),
  'el fiscal ve los registros pendientes de su universidad');
select pg_temp.assert(
  not exists (select 1 from students_to_review() where id = '00000000-0000-0000-0000-0000000000e1'),
  'el fiscal no ve a los ya aprobados');
select review_student('00000000-0000-0000-0000-0000000000f1', true);
select review_student('00000000-0000-0000-0000-0000000000f2', false);
select pg_temp.assert(
  (select status = 'rejected' from students_to_review() where id = '00000000-0000-0000-0000-0000000000f2'),
  'el rechazado sigue en la lista para corregir');
reset role;
select pg_temp.assert(
  (select status = 'verified' and verified_by = '00000000-0000-0000-0000-0000000000c1' and verified_at is not null
   from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  'aprobar deja quién y cuándo');

-- ───── Fiscal de otra línea y otra universidad ─────
insert into universities (id, name, short_name) values ('00000000-0000-0000-0000-000000000002', 'Otra Universidad', 'OU');
insert into operators (id, name) values ('00000000-0000-0000-0000-000000000012', 'Otra línea C.A.');
insert into routes (operator_id, university_id, name, direction, fare_usd)
  values ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'Otra ruta', 'ida', 1);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c2', 'otro.fiscal@gmail.com');
update profiles set role = 'coordinator', operator_id = '00000000-0000-0000-0000-000000000012'
  where id = '00000000-0000-0000-0000-0000000000c2';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
select pg_temp.assert(
  not exists (select 1 from students_to_review() where id = '00000000-0000-0000-0000-0000000000f2'),
  'el fiscal de otra línea no ve a estudiantes de otra universidad');
do $$ begin
  perform review_student('00000000-0000-0000-0000-0000000000f2', true);
  raise exception 'FALLO: un fiscal aprueba fuera de su línea';
exception when insufficient_privilege then raise notice 'ok: un fiscal no aprueba fuera de su línea';
end $$;
reset role;

-- Limpieza
delete from routes where operator_id = '00000000-0000-0000-0000-000000000012';
delete from profiles where id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
delete from operators where id = '00000000-0000-0000-0000-000000000012';
delete from universities where id = '00000000-0000-0000-0000-000000000002';
