# YSABAL · Control de galpones

Aplicación web para administrar galpones, campañas de crianza, mortalidad,
pesos y ventas de aves. Está preparada para Next.js, Supabase y Vercel.

## Ejecutarla localmente

1. Copia `.env.example` como `.env.local`.
2. Completa únicamente estas variables con los valores de tu proyecto Supabase:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   La clave *publishable* se puede usar en el navegador; **no** agregues una
   `secret key` ni una `service_role key` en este proyecto.
3. Ejecuta `npm install` y después `npm run dev`.
4. Abre `http://localhost:3000`.

Mientras no existan esas variables, la aplicación se abre en modo demostración
con datos ficticios, sin modificar Supabase.

## Preparar Supabase

En el SQL Editor ejecuta los scripts en este orden:

1. `C:\Users\gerso\Documents\Codex\2026-09-23\ho\outputs\esquema_ysabal.sql`
   (si todavía no ejecutaste el esquema inicial).
2. `migrations/20260928_seguridad_usuarios.sql`
3. `migrations/20260928_endurecer_reglas_campanas.sql`
4. `migrations/20261001_edicion_registros.sql`

Los dos últimos añaden acceso por usuario mediante Supabase Auth, políticas
RLS y validaciones para inventario, fechas, cierres y ventas. Después crea una
cuenta desde la pantalla de acceso de la aplicación. Si Supabase exige
confirmación de correo, confirma el correo antes de iniciar sesión.

En **Authentication → URL Configuration** agrega:

- `http://localhost:3000` mientras haces pruebas locales.
- La URL final de Vercel cuando publiques la aplicación.

## Publicarla en Vercel

1. Sube esta carpeta a un repositorio Git e impórtalo desde Vercel.
2. Si el repositorio contiene más carpetas, define `ysabal-app` como
   **Root Directory**.
3. Vercel detectará **Next.js** automáticamente.
4. En **Settings → Environment Variables**, crea las dos variables `NEXT_PUBLIC_`
   indicadas arriba para Production, Preview y Development.
5. Despliega. Finalmente agrega la URL generada por Vercel en la configuración
   de URLs de Supabase.

## Comprobaciones disponibles

- `npm run typecheck`
- `npm run build`
# Test_Ysabal
# Test_Ysabal
