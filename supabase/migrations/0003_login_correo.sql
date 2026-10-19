-- NavIA · login por código al correo (antes era por SMS).
-- Enviar SMS con Supabase exige un Messaging Service de Twilio de pago; el código por
-- correo viene incluido. El teléfono sigue en profiles como dato de contacto opcional.

-- El perfil nuevo toma el nombre de los metadatos o, si no hay, la parte del correo
-- antes de la @ (el estudiante lo corrige después).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      new.phone,
      'Sin nombre'
    ),
    nullif(new.phone, '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
