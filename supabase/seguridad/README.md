# Seguridad: qué configurar a mano

La auditoría completa está en el informe del proyecto. Aquí queda lo que se hace fuera del código.

## 1. Aplicar la migración 0016 (después de fusionar el PR)

1. Supabase → tu proyecto → **SQL Editor** → **New query**.
2. Pega todo `supabase/migrations/0016_seguridad.sql` y pulsa **Run**.
3. Prueba en https://navia-lovat.vercel.app/login los tres botones de la demo (Fiscal, Conductor,
   Estudiante). Si alguno falla con "Las cuentas de la demo no se pueden modificar", avisa: se
   quita el bloqueo con `drop trigger protect_demo_accounts on auth.users;`.

## 2. Cambiar la contraseña de la demo (al cerrar la prueba de 7 días)

La contraseña de la demo viaja en el JavaScript de la página: cualquiera que abra el enlace puede
leerla. Después del corte del 2 de noviembre, cámbiala:

1. SQL Editor → Run (cambia `NUEVA-CONTRASEÑA`):
   ```sql
   update auth.users set encrypted_password = crypt('NUEVA-CONTRASEÑA', gen_salt('bf'))
   where lower(email) in ('fiscal@navia.test', 'conductor@navia.test', 'estudiante@navia.test');
   ```
2. Vercel → proyecto **navia** → **Settings** → **Environment Variables** →
   `NEXT_PUBLIC_DEMO_PASSWORD` → **Edit** → la nueva → **Save**.
3. Vercel → **Deployments** → el último de Production → menú **⋯** → **Redeploy**.

## 3. Ajustes de Supabase (5 minutos)

- **Authentication → Sign In / Providers → Email**: "Minimum password length" en **8**.
  "Secure email change" encendido. "Confirm email" sigue apagado (decisión vigente).
- **Authentication → Multi-Factor**: déjalo apagado mientras existan las cuentas de la demo.
- **Authentication → Rate Limits**: baja "Sign-ups and sign-ins" a unos **30 por 5 minutos por IP**.
- **Advisors → Security Advisor**: pulsa **Rerun linter** y revisa lo que salga en rojo.
- **Project Settings → API Keys**: confirma que la `service_role` (o `secret`) **no** está en Vercel.
  La app no la usa. Si alguna vez se pegó en un chat o archivo, pulsa **Roll** para cambiarla.

## 4. Antes del piloto con estudiantes reales

1. **Separar la demo de los datos reales.** El fiscal de la demo es coordinador del operador
   piloto y su contraseña es pública: con ella se reinicia el día, se desincorporan unidades y se
   cambian fotos. Lo más simple: un segundo proyecto de Supabase (gratis) solo para la demo, y en
   el proyecto real `NEXT_PUBLIC_DEMO=0`.
2. **Solo estudiantes aprobados ven la línea.** SQL Editor → pega
   `supabase/seguridad/piloto_solo_verificados.sql` → Run. Hasta que el panel tenga botón de
   aprobar, se aprueba con el SQL que trae el archivo al inicio.

## 5. Vercel y GitHub

- Vercel → **Settings → Deployment Protection** → "Vercel Authentication" en **Standard
  Protection** (las vistas previas de cada PR quedan solo para ti).
- GitHub → repo NavIA → **Settings → Advanced Security** → activa **Dependabot alerts** y
  **Secret Protection** (avisa si alguien sube una llave).
