-- NavIA · rutas de ejemplo para el fiscal: La Guaira, California y Baruta.
-- Pegar en Supabase → SQL Editor → Run DESPUÉS de aplicar migrations/0007_rutas_y_unidades.sql.
-- Se puede correr varias veces.
--
-- Quedan "Próximamente": el fiscal las ve, puede asignarles unidades y filtrar por ellas; el
-- estudiante solo las ve listadas como próximas. No tienen salidas. Paradas y coordenadas
-- son de ejemplo (aproximadas), para cambiarlas por las reales.

insert into routes (id, operator_id, university_id, name, direction, fare_usd, corridor, coming_soon) values
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'La Guaira → USM', 'ida', 2.00, 'La Guaira', true),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'California → USM', 'ida', 1.00, 'California', true),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Baruta → USM', 'ida', 1.50, 'Baruta', true)
on conflict (id) do update set name = excluded.name, corridor = excluded.corridor, coming_soon = excluded.coming_soon, active = true;

insert into stops (route_id, seq, name, lat, lng) values
  ('00000000-0000-0000-0000-000000000040', 1, 'Macuto (bulevar) · salida', 10.6075, -66.8890),
  ('00000000-0000-0000-0000-000000000040', 2, 'Maiquetía (Terminal)',      10.5990, -66.9560),
  ('00000000-0000-0000-0000-000000000040', 3, 'Catia La Mar',              10.6010, -67.0300),
  ('00000000-0000-0000-0000-000000000040', 4, 'USM La Florencia',          10.4691, -66.7797),
  ('00000000-0000-0000-0000-000000000041', 1, 'California Norte · salida', 10.4880, -66.8160),
  ('00000000-0000-0000-0000-000000000041', 2, 'Los Ruices',                10.4900, -66.8240),
  ('00000000-0000-0000-0000-000000000041', 3, 'Petare (redoma)',           10.4767, -66.8091),
  ('00000000-0000-0000-0000-000000000041', 4, 'USM La Florencia',          10.4691, -66.7797),
  ('00000000-0000-0000-0000-000000000042', 1, 'Baruta (plaza) · salida',   10.4330, -66.8750),
  ('00000000-0000-0000-0000-000000000042', 2, 'Las Mercedes',              10.4810, -66.8600),
  ('00000000-0000-0000-0000-000000000042', 3, 'Chuao',                     10.4880, -66.8440),
  ('00000000-0000-0000-0000-000000000042', 4, 'USM La Florencia',          10.4691, -66.7797)
on conflict (route_id, seq) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng;

-- Las unidades de la demo quedan asignadas a la ruta activa de Guarenas – Guatire (si aún no tienen ruta).
update vehicles set route_id = (
  select id from routes where corridor = 'Guarenas – Guatire' and active and not coming_soon order by name limit 1
)
where operator_id = '00000000-0000-0000-0000-000000000010' and route_id is null;

select r.name, r.corridor, r.coming_soon,
       (select count(*) from stops s where s.route_id = r.id) as paradas,
       (select string_agg(v.plate, ', ') from vehicles v where v.route_id = r.id) as unidades
from routes r where r.active order by r.coming_soon, r.corridor, r.name;
