# NavIA · Tu copiloto de ruta

PWA para el transporte universitario (piloto: Universidad Santa María). El estudiante ve en vivo dónde va la unidad; el conductor opera con 3 botones grandes que funcionan sin señal.

- PRD (Fase 1): https://claude.ai/code/artifact/2b0fe6a6-e272-42ce-9d02-88feb421ad9e
- Arquitectura (Fase 2): https://claude.ai/code/artifact/0bc35256-d4ce-4aea-9828-f55de1e13290

Stack: Next.js 15 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres, Auth OTP, Realtime), Serwist (service worker) y Dexie (cola offline).

## Qué hace el corte 1 (sprints 1 y 2)

| Zona | Ruta | Qué hace |
| --- | --- | --- |
| Todos | `/login` | Entrar o crear cuenta con correo y contraseña, sin verificar el correo (E1-H1). El código por correo está listo pero apagado (`NEXT_PUBLIC_LOGIN_MODE=otp`) |
| Estudiante | `/` | Salidas de hoy con estado en vivo, última parada y "ubicación hace X min" (E5-H1) |
| Conductor | `/conductor` | 3 botones: *En camino*, *Llegué a: (próxima parada)*, *Fin de ruta*; GPS cada 20 s con pantalla encendida (E3-H1, E3-H2) |
| Coordinador | `/panel` | Por ahora, las salidas en vivo |

Cada usuario cae en su zona según su rol (`profiles.role`). La app se instala como PWA y abre sin señal después de la primera visita.

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

1. **Tablas:** SQL Editor → pega y corre `supabase/migrations/*.sql` en orden (o `npx supabase db push`).
2. **Crear cuenta sin verificar el correo:** Authentication → Sign In / Providers → Email → apaga *Confirm email*.
3. **(Más adelante) código por correo:** configura un SMTP propio (Authentication → Emails → SMTP Settings), pega `supabase/templates/codigo.html` en las plantillas *Magic Link* y *Confirm signup* y pon `NEXT_PUBLIC_LOGIN_MODE=otp`.
4. **Datos del piloto:** cuando el conductor y un estudiante hayan entrado una vez, corre `supabase/datos_piloto.sql` en el SQL Editor con sus correos.
5. Pon la URL y la anon key en `.env.local`.

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
  templates/codigo.html        correo con el código de entrada
  datos_piloto.sql             ruta, paradas y salidas de hoy para el proyecto en la nube
  seed.sql                     USM, 1 operador, 1 ruta con 5 paradas, 2 salidas hoy
  tests/                       pruebas de RLS sin Docker
src/
  app/                         rutas por rol: (auth) (student) (driver) (coordinator), api/sync
  features/driver/             botones, GPS, wake lock
  features/trips/              estado en vivo (Realtime + respaldo cada 30 s)
  lib/offline/                 cola Dexie y sincronizador
  lib/supabase/                clientes de navegador, servidor y middleware
```

## Próximos sprints

3. Rutas y reservas (E2) · 4. Identidad, QR y abordaje (E1-H2, E1-H3, E3-H3) · 5. Pagos y conciliación (E4) · 6. Norbit con DeepSeek y avisos push (E5).
