-- Embudo de la prueba de 7 días (fichas v2): cada paso de un enlace de demo deja una fila.
--   visita   = abrió /demo/estudiante o /demo/conductor-fiscal (aún sin entrar)
--   entrada  = entró a la demo con un rol
--   tour     = terminó el recorrido
--   video    = vio el video de bienvenida completo (enlace de estudiantes)
--   encuesta = envió la encuesta
-- `visitante` es un id al azar por navegador: sirve para contar personas, no identifica a nadie.
-- `canal` sale del enlace (?canal=whatsapp, ?canal=usm…). La visita ocurre antes de entrar, por
-- eso también puede insertar el rol anon. Lectura: solo el admin (tablero /encuestas).

create table if not exists demo_eventos (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  audiencia   text not null check (audiencia in ('estudiante', 'conductor-fiscal')),
  evento      text not null check (evento in ('visita', 'entrada', 'tour', 'video', 'encuesta')),
  canal       text not null default 'directo' check (canal ~ '^[a-z0-9-]{1,24}$'),
  visitante   uuid not null
);

create index if not exists demo_eventos_creado on demo_eventos (created_at);

alter table demo_eventos enable row level security;

drop policy if exists demo_eventos_insert on demo_eventos;
create policy demo_eventos_insert on demo_eventos for insert to anon, authenticated with check (true);

drop policy if exists demo_eventos_admin on demo_eventos;
create policy demo_eventos_admin on demo_eventos for select using (my_role() = 'admin');
