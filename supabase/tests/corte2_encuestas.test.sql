-- Encuestas de la demo (0014): cualquiera con sesión responde; solo el admin las lee.

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALLO: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
insert into encuestas (audiencia, vista, respuestas, contacto)
values ('estudiante', 'student', '{"usaria":"Sí, seguro"}', 'yo@correo.com');
select pg_temp.assert((select count(*) from encuestas) = 0, 'el estudiante responde pero no ve las respuestas');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
select pg_temp.assert((select count(*) from encuestas) = 0, 'el fiscal no ve las respuestas ni los contactos');
reset role;

select pg_temp.assert((select count(*) from encuestas where audiencia = 'estudiante') = 1, 'la respuesta quedó guardada');
