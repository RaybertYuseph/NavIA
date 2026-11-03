-- Registro de errores (0018): cualquiera reporta, solo admin lee, y hay topes.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- Sin sesión (pantalla de login)
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select log_client_error('js', 'TypeError: falla en login', null, '/login', 'test', true);
select log_client_error('otro', 'tipo inventado');
do $$ begin
  perform 1 from client_errors;
  raise exception 'FALLO: un visitante lee los errores';
exception when insufficient_privilege then raise notice 'ok: un visitante no lee los errores';
end $$;
reset role;
select pg_temp.assert((select count(*) = 1 from client_errors), 'se guarda el error sin sesión y se ignora un tipo inventado');

-- Estudiante: reporta, no lee, y tiene tope por minuto
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select log_client_error('pantalla', repeat('x', 900)) from generate_series(1, 30);
select pg_temp.assert(not exists (select 1 from client_errors), 'el estudiante no lee los errores');
do $$ begin
  insert into client_errors (kind, message) values ('js', 'directo');
  raise exception 'FALLO: se escribe directo en la tabla';
exception when insufficient_privilege then raise notice 'ok: nadie escribe directo en la tabla';
end $$;
reset role;
select pg_temp.assert(
  (select count(*) = 20 and max(length(message)) = 500 from client_errors where user_id = '00000000-0000-0000-0000-0000000000e1'),
  'tope de 20 por minuto por cuenta y mensaje recortado');

-- Admin lee la tabla y el resumen
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@gmail.com');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.assert((select count(*) = 21 from client_errors), 'el admin lee los errores');
select pg_temp.assert(
  (select veces = 20 and personas = 1 and rol = 'student' from errores_resumen where kind = 'pantalla'),
  'el resumen agrupa por error con veces, personas y rol');
reset role;

delete from client_errors;
delete from profiles where id = '00000000-0000-0000-0000-0000000000a1';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
