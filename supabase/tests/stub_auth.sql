-- Imita lo mínimo de Supabase en un Postgres pelado, solo para probar migraciones:
-- esquema auth, auth.uid() leído del JWT simulado y los roles anon/authenticated.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, phone text unique,
  phone_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase otorga por defecto todos los privilegios de public a estos roles; RLS decide.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
