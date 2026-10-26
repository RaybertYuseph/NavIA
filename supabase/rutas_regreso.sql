-- NavIA · rutas de regreso: para cada ruta de ida que ya tiene salidas, su vuelta desde la USM.
-- Pegar en Supabase → SQL Editor → Run DESPUÉS de aplicar migrations/0007_rutas_y_unidades.sql.
-- Se puede correr varias veces: si la vuelta ya existe, no la duplica.
--
-- La vuelta lleva el nombre invertido ("Guatire → Guarenas → USM" pasa a "USM → Guarenas →
-- Guatire", sin la hora entre paréntesis), dirección 'regreso', el mismo corredor, operador,
-- universidad y tarifa, y las mismas paradas en orden inverso. Al compartir corredor, el conductor
-- de una unidad de ese corredor puede hacer ida o vuelta y el fiscal las ve juntas en su filtro.

do $$
declare
  r     record;
  clean text;
  back  text;
  new_id uuid;
begin
  for r in
    select * from routes where active and not coming_soon and direction = 'ida'
  loop
    clean := btrim(regexp_replace(r.name, '\s*\([^)]*\)\s*$', ''));
    select string_agg(btrim(part), ' → ' order by n desc) into back
    from unnest(regexp_split_to_array(clean, '\s*(→|->)\s*')) with ordinality as p(part, n);

    -- Ida y vuelta comparten corredor; si la ida no tenía, toma su propio nombre.
    if r.corridor is null then
      update routes set corridor = clean where id = r.id;
      r.corridor := clean;
    end if;

    if back is null or back = clean
       or exists (select 1 from routes where operator_id = r.operator_id and name = back) then
      continue;
    end if;

    insert into routes (operator_id, university_id, name, direction, fare_usd, active, corridor, coming_soon)
    values (r.operator_id, r.university_id, back, 'regreso', r.fare_usd, true, r.corridor, false)
    returning id into new_id;

    insert into stops (route_id, seq, name, lat, lng, geofence_m)
    select new_id, row_number() over (order by seq desc), name, lat, lng, geofence_m
    from stops where route_id = r.id;

    raise notice 'Creada: % (% paradas)', back, (select count(*) from stops where route_id = new_id);
  end loop;
end $$;
