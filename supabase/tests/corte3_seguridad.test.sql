-- Seguridad (0016): qr_seed oculto, el fiscal solo ve su línea y las cuentas de la demo no se tocan.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- ───── qr_seed ─────
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select pg_temp.assert((select full_name is not null from profiles where id = auth.uid()), 'el estudiante lee su perfil');
do $$ begin
  perform qr_seed from profiles where id = auth.uid();
  raise exception 'FALLO: qr_seed se lee por la API';
exception when insufficient_privilege then raise notice 'ok: qr_seed no se lee por la API';
end $$;
reset role;

-- ───── El fiscal no ve estudiantes ni otros operadores ─────
insert into operators (id, name) values ('00000000-0000-0000-0000-000000000011', 'Otra línea C.A.');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', 'otro.conductor@gmail.com');
update profiles set role = 'driver', operator_id = '00000000-0000-0000-0000-000000000011'
  where id = '00000000-0000-0000-0000-0000000000d2';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert(not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'el fiscal no ve perfiles de estudiantes');
select pg_temp.assert(not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d2'), 'el fiscal no ve conductores de otra línea');
select pg_temp.assert(exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d1'), 'el fiscal ve a sus conductores');
update profiles set full_name = 'Hackeado' where id = '00000000-0000-0000-0000-0000000000e1';
reset role;
select pg_temp.assert((select full_name <> 'Hackeado' from profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'el fiscal no edita perfiles de estudiantes');
delete from profiles where id = '00000000-0000-0000-0000-0000000000d2';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d2';
delete from operators where id = '00000000-0000-0000-0000-000000000011';

-- ───── Cuentas de la demo ─────
-- Supabase Auth escribe como supabase_auth_admin; el stub no trae ni el rol ni la columna.
alter table auth.users add column if not exists encrypted_password text;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;
grant select, update on auth.users to supabase_auth_admin;
grant usage on schema auth to supabase_auth_admin;

set role supabase_auth_admin;
do $$ begin
  update auth.users set encrypted_password = 'nueva' where email = 'fiscal@navia.test';
  raise exception 'FALLO: se cambió la contraseña del fiscal de la demo';
exception when insufficient_privilege then raise notice 'ok: la contraseña de la demo no se cambia desde la app';
end $$;
do $$ begin
  update auth.users set email = 'mio@gmail.com' where email = 'estudiante@navia.test';
  raise exception 'FALLO: se cambió el correo del estudiante de la demo';
exception when insufficient_privilege then raise notice 'ok: el correo de la demo no se cambia desde la app';
end $$;
update auth.users set updated_at = now() where email = 'fiscal@navia.test';
select pg_temp.assert(true, 'entrar con la demo (actualiza otras columnas) sigue funcionando');
reset role;

update auth.users set encrypted_password = 'desde-sql' where email = 'fiscal@navia.test';
select pg_temp.assert((select encrypted_password = 'desde-sql' from auth.users where email = 'fiscal@navia.test'), 'el SQL Editor sí cambia la contraseña de la demo');
