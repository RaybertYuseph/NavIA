-- NavIA · registro de errores de la app (monitoreo sin servicios externos).
--
-- Cada teléfono reporta aquí los errores que le pasan (pantalla que falla, error de JavaScript,
-- envío del conductor rechazado). Así sabemos que algo falla en el teléfono de alguien sin que
-- nos escriba. Se eligió esto en vez de Sentry para no sumar ~60 KB de JavaScript a cada carga
-- ni otra cuenta: los datos quedan en el mismo Supabase.
--
-- Para verlos: SQL Editor → select * from errores_resumen;   (ver supabase/seguridad/README.md)

create table if not exists client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users (id) on delete set null,
  kind        text not null,               -- 'js', 'promesa', 'pantalla', 'sync'
  message     text not null,
  stack       text,
  path        text,
  user_agent  text,
  online      boolean
);
create index if not exists client_errors_created_idx on client_errors (created_at desc);
create index if not exists client_errors_user_idx on client_errors (user_id, created_at desc);

alter table client_errors enable row level security;
revoke all on client_errors from anon, authenticated;
-- Solo admin los lee por la API; nadie escribe directo (solo por la función de abajo).
grant select on client_errors to authenticated;
drop policy if exists client_errors_admin on client_errors;
create policy client_errors_admin on client_errors for select to authenticated using (my_role() = 'admin');

-- Guarda un error recortado. Topes para que nadie llene la tabla: 20 por minuto por cuenta (o por
-- visitante sin sesión, todos juntos) y 600 por minuto en total. Borra lo de más de 30 días.
create or replace function log_client_error(
  p_kind text,
  p_message text,
  p_stack text default null,
  p_path text default null,
  p_user_agent text default null,
  p_online boolean default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if p_kind not in ('js', 'promesa', 'pantalla', 'sync') or coalesce(trim(p_message), '') = '' then
    return;
  end if;
  if (select count(*) from client_errors
      where created_at > now() - interval '1 minute' and user_id is not distinct from uid) >= 20 then
    return;
  end if;
  if (select count(*) from client_errors where created_at > now() - interval '1 minute') >= 600 then
    return;
  end if;

  insert into client_errors (user_id, kind, message, stack, path, user_agent, online)
  values (uid, p_kind, left(p_message, 500), left(p_stack, 2000), left(p_path, 200), left(p_user_agent, 300), p_online);

  if random() < 0.01 then
    delete from client_errors where created_at < now() - interval '30 days';
  end if;
end $$;
revoke execute on function log_client_error(text, text, text, text, text, boolean) from public;
grant execute on function log_client_error(text, text, text, text, text, boolean) to anon, authenticated;

-- Resumen de los últimos 7 días: qué error, cuántas veces, a cuántas personas y dónde.
create or replace view errores_resumen with (security_invoker = true) as
select
  e.kind,
  e.message,
  count(*)                    as veces,
  count(distinct e.user_id)   as personas,
  max(e.created_at at time zone 'America/Caracas') as ultima_vez,
  (array_agg(e.path order by e.created_at desc))[1] as ultima_pantalla,
  (array_agg(p.role::text order by e.created_at desc))[1] as rol
from client_errors e
left join profiles p on p.id = e.user_id
where e.created_at > now() - interval '7 days'
group by e.kind, e.message
order by max(e.created_at) desc;
revoke all on errores_resumen from anon;
