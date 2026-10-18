# NavIA · Tu copiloto de ruta

PWA para el transporte universitario (piloto: Universidad Santa María). El estudiante ve en vivo dónde va la unidad; el conductor opera con 3 botones grandes que funcionan sin señal.

- PRD (Fase 1): https://claude.ai/code/artifact/2b0fe6a6-e272-42ce-9d02-88feb421ad9e
- Arquitectura (Fase 2): https://claude.ai/code/artifact/0bc35256-d4ce-4aea-9828-f55de1e13290

Stack: Next.js 15 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres, Auth OTP, Realtime), Serwist (service worker) y Dexie (cola offline).

## Qué hace el corte 1 (sprints 1 y 2)

| Zona | Ruta | Qué hace |
| --- | --- | --- |
| Todos | `/login` | Entrar con el celular y un código por SMS, sin contraseña (E1-H1) |
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

Usuarios de prueba (código OTP `123456`, sin SMS real):

| Rol | Celular |
| --- | --- |
| Conductor | 0414-0000001 |
| Estudiante | 0414-0000002 |

Abre la app en dos ventanas (una como conductor, otra como estudiante) y toca los botones: el estado cambia en vivo.

Para usar un proyecto Supabase en la nube: aplica `supabase/migrations/*.sql` en orden desde el SQL Editor (o `npx supabase db push`), activa el proveedor *Phone* en Authentication y pon las claves en `.env.local`.

## Pruebas

```bash
npm run lint && npm run typecheck && npm test   # unitarias (teléfono, horas, botones, cola offline)
npm run db:test                                 # migraciones + seed + reglas de seguridad en un Postgres temporal
```

`db:test` no necesita Docker: levanta un Postgres 15+ temporal, simula lo mínimo de Supabase (`auth.uid()`, roles) y prueba con los permisos reales de cada rol (conductor, estudiante, anónimo).

## Estructura

```
supabase/
  migrations/0001_init.sql     esquema de la Fase 2
  migrations/0002_corte1.sql   correcciones de seguridad (ver comentarios) y perfil automático
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
