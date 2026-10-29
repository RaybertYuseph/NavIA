-- NavIA · auditoría de seguridad (2026-10-29).
--
-- La contraseña de las cuentas de la demo es pública (NEXT_PUBLIC_DEMO_PASSWORD) y el fiscal de la
-- demo es coordinador del operador piloto. Esta migración limita lo que cualquiera puede hacer con
-- esas cuentas y con una cuenta recién creada (sin verificar el correo):
--
-- 1) qr_seed (la semilla del QR de identidad) no se lee por la API: solo funciones del servidor.
-- 2) El coordinador ve y edita solo los perfiles de su operador, no los de todos (estudiantes,
--    admin ni otros operadores). La aprobación de estudiantes irá por una función propia.
-- 3) Nadie puede cambiar la contraseña, el correo ni el teléfono de las cuentas @navia.test desde
--    la app: con la contraseña pública cualquiera podía cambiarla y dejar la demo sin acceso.
--    Para cambiarla, Raybert corre un UPDATE en el SQL Editor (ver supabase/seguridad/README.md).
-- 4) Fotos de unidades: solo imágenes de hasta 2 MB, y cada fiscal solo escribe en las carpetas de
--    las unidades de su operador.

-- ───────────── 1. qr_seed fuera de la API ─────────────
revoke select on profiles from anon, authenticated;
grant select (id, role, full_name, cedula, phone, university_id, operator_id, status,
              id_card_path, verified_by, verified_at, created_at)
  on profiles to authenticated;

-- ───────────── 2. Perfiles: el coordinador, solo su operador ─────────────
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (
  id = auth.uid()
  or my_role() = 'admin'
  or (my_role() = 'coordinator' and operator_id is not null and operator_id = my_operator())
);

drop policy if exists profiles_update_coord on profiles;
create policy profiles_update_coord on profiles for update
  using (my_role() = 'admin' or (my_role() = 'coordinator' and operator_id is not null and operator_id = my_operator()))
  with check (my_role() = 'admin' or (my_role() = 'coordinator' and operator_id is not null and operator_id = my_operator()));

-- ───────────── 3. Cuentas de la demo bloqueadas ─────────────
-- Supabase Auth (GoTrue) escribe en auth.users como supabase_auth_admin. Se bloquea solo ese
-- camino; el SQL Editor (postgres) puede seguir cambiando la contraseña.
create or replace function public.protect_demo_accounts() returns trigger
language plpgsql set search_path = public as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
begin
  if current_user <> 'supabase_auth_admin' or lower(coalesce(o ->> 'email', '')) not like '%@navia.test' then
    return new;
  end if;
  foreach k in array array['encrypted_password', 'email', 'email_change', 'phone', 'phone_change'] loop
    if (n -> k) is distinct from (o -> k) then
      raise exception 'Las cuentas de la demo no se pueden modificar' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists protect_demo_accounts on auth.users;
create trigger protect_demo_accounts before update on auth.users
  for each row execute function public.protect_demo_accounts();

-- Tampoco se les puede activar MFA (dejaría fuera a todos los demás).
create or replace function public.protect_demo_mfa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from auth.users u where u.id = new.user_id and lower(u.email) like '%@navia.test') then
    raise exception 'Las cuentas de la demo no usan MFA' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.protect_demo_mfa() from public, anon, authenticated;

do $$
begin
  if to_regclass('auth.mfa_factors') is not null then
    execute 'drop trigger if exists protect_demo_mfa on auth.mfa_factors';
    execute 'create trigger protect_demo_mfa before insert on auth.mfa_factors
               for each row execute function public.protect_demo_mfa()';
  end if;
exception when insufficient_privilege then
  raise notice 'Sin permiso sobre auth.mfa_factors: se omite el bloqueo de MFA (deja MFA apagado en Supabase).';
end $$;

-- ───────────── 4. Fotos de unidades ─────────────
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets
      set file_size_limit = 2 * 1024 * 1024,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
      where id = 'unidades';

    execute 'drop policy if exists unidades_coord_write on storage.objects';
    -- Rutas como {vehicle_id}/{fecha}.jpg (features/vehicles/uploadPhoto.ts).
    execute $p$
      create policy unidades_coord_write on storage.objects for all to authenticated
      using (
        bucket_id = 'unidades' and public.my_role() in ('coordinator', 'admin')
        and exists (select 1 from public.vehicles v
                    where v.id::text = (storage.foldername(name))[1] and v.operator_id = public.my_operator())
      )
      with check (
        bucket_id = 'unidades' and public.my_role() in ('coordinator', 'admin')
        and exists (select 1 from public.vehicles v
                    where v.id::text = (storage.foldername(name))[1] and v.operator_id = public.my_operator())
      )
    $p$;
  end if;
end $$;
