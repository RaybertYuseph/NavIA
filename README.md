# NavIA · Tu copiloto de ruta

PWA para el transporte universitario (piloto: Universidad Santa María). El estudiante ve en vivo dónde va la unidad; el conductor opera con 3 botones grandes que funcionan sin señal.

- PRD (Fase 1): https://claude.ai/code/artifact/2b0fe6a6-e272-42ce-9d02-88feb421ad9e
- Arquitectura (Fase 2): https://claude.ai/code/artifact/0bc35256-d4ce-4aea-9828-f55de1e13290

Stack: Next.js 15 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres, Auth, Realtime, Storage), Leaflet, Serwist (service worker) y Dexie (cola offline).

## Las tres vistas (corte 2)

| Quién | Ruta | Qué ve y qué hace |
| --- | --- | --- |
| Fiscal de la línea (`coordinator`) | `/panel` | Unidades en ruta, disponibles y fuera de servicio; mapa en vivo; foto, placa, conductor y última parada de cada unidad; estudiantes en espera por ruta; salidas de hoy por ruta; sube la foto de cada unidad; *Reiniciar demo* |
| Conductor (`driver`) | `/conductor` | Marca su unidad *disponible*; ve cuántos estudiantes esperan en cada parada; *En camino*, *Llegué a: (parada)*, *Parada completada · seguir*, *Fin de ruta*; lista de paradas con ✓; GPS cada 20 s; funciona sin señal |
| Estudiante (`student`) | `/` | NavIA, el agente, lo saluda; próxima unidad en salir (hora, foto y placa); *Estoy en la parada* (marca dónde espera y ve cuántos esperan con él); unidades en camino en el mapa con su próxima parada; rutas y horarios de hoy |

**Estoy en la parada:** el conteo por parada vive en `trips.waiting` y llega por Realtime; cuando el conductor toca *Llegué a* esa parada, la espera se cierra sola. Nadie ve quién espera, solo cuántos.

**Marca:** NavIA es una gota azul con audífonos (`src/features/brand/NaviaAgent.tsx`). El cuerpo y la mano con el pin son imágenes en `public/brand/gota/` y la cara LED (ojos, boca que habla) es SVG animable. La guía vive en `src/features/guide/`: el tour inicial (NavIA camina hasta cada parte de la pantalla) y el botón flotante que responde preguntas con datos en vivo. La paleta está en `src/app/globals.css` (`brand-*`).

Todos entran por `/login` (correo y contraseña, sin verificar el correo) y caen en su vista según `profiles.role`. El código por correo está listo pero apagado (`NEXT_PUBLIC_LOGIN_MODE=otp`).

### Modo demo (presentación por enlace)

Con `NEXT_PUBLIC_DEMO=1`, `/login` muestra tres botones (Fiscal, Conductor, Estudiante) que entran con las cuentas `fiscal@`, `conductor@` y `estudiante@navia.test` usando `NEXT_PUBLIC_DEMO_PASSWORD`. Esa contraseña queda pública en el navegador: úsala solo para esas tres cuentas. El botón *Reiniciar demo* del fiscal deja las salidas de hoy como al inicio del día (si hoy no hay, copia las del último día).

**Sin señal:** cada botón y cada punto GPS se guardan primero en el teléfono (IndexedDB) y se envían en orden a `/api/sync` cuando vuelve la red. Reenviar no duplica nada. El conductor ve cuántos envíos tiene pendientes.

## Arrancar en tu computadora

Requisitos: Node 22, Docker (para Supabase local).

```bash
npm install
npx supabase start            # Postgres + Auth + Realtime locales; aplica migraciones y seed
cp .env.example .env.local    # pega la URL y la anon key que imprime el comando anterior
npm run dev                   # http://localhost:3000
```

Usuarios de prueba: crea en `/login` las cuentas `conductor@navia.test` y `estudiante@navia.test` (o usa el seed y, con `NEXT_PUBLIC_LOGIN_MODE=otp`, busca el código en el buzón local: http://localhost:54324).

Abre la app en dos ventanas (una como conductor, otra como estudiante) y toca los botones: el estado cambia en vivo.

### Proyecto Supabase en la nube

1. **Tablas:** SQL Editor → pega y corre `supabase/migrations/*.sql` en orden (o `npx supabase db push`). La `0004` crea también el bucket público `unidades` para las fotos.
2. **Crear cuenta sin verificar el correo:** Authentication → Sign In / Providers → Email → apaga *Confirm email*.
3. **Datos del piloto:** cuando el conductor y un estudiante hayan entrado una vez, corre `supabase/datos_piloto.sql` en el SQL Editor con sus correos.
4. **Demo:** crea en la app las cuentas `fiscal@`, `conductor@` y `estudiante@navia.test` con la misma contraseña y corre `supabase/demo.sql` (unidades, roles y reparto de las salidas de hoy).
5. **(Más adelante) código por correo:** configura un SMTP propio (Authentication → Emails → SMTP Settings), pega `supabase/templates/codigo.html` en las plantillas *Magic Link* y *Confirm signup* y pon `NEXT_PUBLIC_LOGIN_MODE=otp`.
6. Pon la URL y la anon key en `.env.local`.

### Publicar en Vercel

1. vercel.com → *Add New… → Project* → importa `RaybertYuseph/navia`.
2. *Environment Variables:* `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DEMO=1`, `NEXT_PUBLIC_DEMO_PASSWORD`.
3. *Deploy.* En Supabase → Authentication → URL Configuration, pon la URL de Vercel en *Site URL*.

## Pruebas

```bash
npm run lint && npm run typecheck && npm test   # unitarias (correo, horas, botones, cola offline)
npm run db:test                                 # migraciones + seed + reglas de seguridad en un Postgres temporal
```

`db:test` no necesita Docker: levanta un Postgres 15+ temporal, simula lo mínimo de Supabase (`auth.uid()`, roles) y prueba con los permisos reales de cada rol (conductor, estudiante, anónimo).

## Estructura

```
supabase/
  migrations/0001_init.sql     esquema de la Fase 2
  migrations/0002_corte1.sql   correcciones de seguridad (ver comentarios) y perfil automático
  migrations/0003_login_correo.sql  login por correo: el perfil toma el nombre del correo
  migrations/0004_tres_vistas.sql   foto y disponibilidad de unidades, reinicio de la demo
  migrations/0005_espera_en_parada.sql  "Estoy en la parada" y conteo por parada
  demo.sql                     cuentas, unidades y salidas de la demo
  templates/codigo.html        correo con el código de entrada
  datos_piloto.sql             ruta, paradas y salidas de hoy para el proyecto en la nube
  seed.sql                     USM, 1 operador, 1 ruta con 5 paradas, 2 salidas hoy
  tests/                       pruebas de RLS sin Docker
src/
  app/                         rutas por rol: (auth) (student) (driver) (coordinator), api/sync
  features/driver/             botones, GPS, wake lock
  features/trips/              vista del estudiante y estado en vivo (Realtime + respaldo cada 10 s)
  features/panel/              vista del fiscal
  features/map/                mapa Leaflet + OpenStreetMap
  features/vehicles/           foto de la unidad
  lib/offline/                 cola Dexie y sincronizador
  lib/supabase/                clientes de navegador, servidor y middleware
```

## Próximos sprints

3. Rutas y reservas (E2) · 4. Identidad, QR y abordaje (E1-H2, E1-H3, E3-H3) · 5. Pagos y conciliación (E4) · 6. Agente NavIA con DeepSeek y avisos push (E5).
