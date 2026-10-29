-- Encuestas de la demo: al terminar el tour de un enlace de demo (/demo/estudiante o
-- /demo/conductor-fiscal) se responden 7 preguntas dentro de la app. Las cuentas de la demo son
-- compartidas, así que cada fila es una respuesta anónima, salvo el contacto que la persona
-- deja si quiere entrar al piloto.
-- Lectura: solo el admin desde la app (el fiscal de la demo es público y no debe ver contactos).
-- Raybert las revisa en Supabase, Table Editor, encuestas, y las exporta a CSV.

create table if not exists encuestas (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  audiencia   text not null check (audiencia in ('estudiante', 'conductor-fiscal')),
  vista       text not null check (vista in ('student', 'driver', 'fiscal')),
  respuestas  jsonb not null check (jsonb_typeof(respuestas) = 'object'),
  contacto    text check (char_length(contacto) <= 200),
  user_id     uuid default auth.uid()
);

alter table encuestas enable row level security;

drop policy if exists encuestas_insert on encuestas;
create policy encuestas_insert on encuestas for insert to authenticated
  with check (user_id = auth.uid() and pg_column_size(respuestas) < 4000);

drop policy if exists encuestas_admin on encuestas;
create policy encuestas_admin on encuestas for select using (my_role() = 'admin');
