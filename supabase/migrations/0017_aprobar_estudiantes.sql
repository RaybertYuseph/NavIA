-- NavIA · el fiscal aprueba a los estudiantes que se registran (E1-H1).
--
-- Desde la 0016 el fiscal solo ve los perfiles de su operador, y un estudiante no tiene operador:
-- por eso no veía a nadie pendiente. Aquí lo hace por dos funciones propias, sin abrir la tabla:
--   students_to_review()          estudiantes pendientes (y rechazados) de las universidades que
--                                 atiende su línea, o que aún no eligieron universidad
--   review_student(id, aprobar)   los aprueba o rechaza; queda quién y cuándo
-- Además el registro guarda cédula y teléfono, para que el fiscal sepa a quién aprueba.

-- ───────────── 1. Registro con cédula y teléfono ─────────────
-- Cédula y teléfono son únicos en profiles: si ya existen (alguien se registró dos veces) se
-- guardan vacíos en vez de impedir la cuenta, y el fiscal lo ve al revisar.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_cedula text := nullif(regexp_replace(coalesce(meta ->> 'cedula', ''), '[^0-9]', '', 'g'), '');
  v_phone text := nullif(regexp_replace(coalesce(meta ->> 'phone', new.phone, ''), '[^0-9+]', '', 'g'), '');
  v_uni uuid;
begin
  -- Mismo formato que la app: 04141234567.
  if v_phone like '+58%' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_cedula is not null and exists (select 1 from profiles where cedula = v_cedula) then v_cedula := null; end if;
  if v_phone is not null and exists (select 1 from profiles where phone = v_phone) then v_phone := null; end if;
  -- Piloto con una sola universidad: se asigna sola. Con varias, el estudiante la elige después.
  if (select count(*) from universities) = 1 then select id into v_uni from universities; end if;

  insert into profiles (id, full_name, cedula, phone, university_id)
  values (
    new.id,
    coalesce(
      nullif(left(trim(meta ->> 'full_name'), 80), ''),
      nullif(split_part(new.email, '@', 1), ''),
      new.phone,
      'Sin nombre'
    ),
    v_cedula,
    v_phone,
    v_uni
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ───────────── 2. Lista para revisar ─────────────
create or replace function can_review_students() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('coordinator', 'admin') from profiles where id = auth.uid()), false)
$$;

create or replace function students_to_review()
returns table (
  id uuid,
  full_name text,
  email text,
  cedula text,
  phone text,
  status verification,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_review_students() then
    raise exception 'Solo el fiscal revisa registros' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, u.email::text, p.cedula, p.phone, p.status, p.created_at
  from profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student'
    and p.status in ('pending', 'rejected')
    and lower(coalesce(u.email, '')) not like '%@navia.test'
    and (
      my_role() = 'admin'
      or p.university_id is null
      or p.university_id in (select r.university_id from routes r where r.operator_id = my_operator())
    )
  order by p.status, p.created_at
  limit 300;
end $$;

-- ───────────── 3. Aprobar o rechazar ─────────────
create or replace function review_student(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
begin
  if not can_review_students() then
    raise exception 'Solo el fiscal revisa registros' using errcode = '42501';
  end if;
  select true into ok
  from profiles p
  where p.id = p_id and p.role = 'student'
    and (
      my_role() = 'admin'
      or p.university_id is null
      or p.university_id in (select r.university_id from routes r where r.operator_id = my_operator())
    );
  if ok is null then
    raise exception 'Ese estudiante no está en tu línea' using errcode = '42501';
  end if;

  update profiles
  set status = case when p_approve then 'verified'::verification else 'rejected'::verification end,
      verified_by = auth.uid(),
      verified_at = now()
  where id = p_id;
end $$;

revoke execute on function can_review_students() from public, anon;
revoke execute on function students_to_review() from public, anon;
revoke execute on function review_student(uuid, boolean) from public, anon;
grant execute on function can_review_students() to authenticated;
grant execute on function students_to_review() to authenticated;
grant execute on function review_student(uuid, boolean) to authenticated;
