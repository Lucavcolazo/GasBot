# GasBot

Bot de Telegram que anota gastos e ingresos personales por chat ("gasté 5000 en
nafta"), los parsea con la API de Claude, los guarda en Supabase, y los muestra
en un dashboard web con login propio.

## Stack

- **Bot**: Telegram Bot API (HTTP directo, sin librería)
- **Backend**: función serverless de Vercel (`api/webhook.ts`)
- **Parseo**: Claude API (`claude-haiku-4-5`)
- **DB + Auth**: Supabase (Postgres + Supabase Auth, email/contraseña)
- **Frontend**: React + Vite + TS + Tailwind + Recharts

## Nota sobre el bot y el login

El dashboard web usa Supabase Auth: cada fila de `movimientos` le pertenece a
un `user_id` que tiene que coincidir con el usuario logueado (RLS). El bot de
Telegram, en cambio, inserta usando la service role key (bypassea RLS) con el
`chat_id` de Telegram como `user_id`. Por ahora esos dos mundos están
desconectados a propósito: lo que carga el bot no va a aparecer en el
dashboard hasta que decidamos cómo asociar tu chat de Telegram con tu cuenta
de Supabase. Se resuelve cuando integremos el bot de nuevo.

## Setup

### 1. Crear el bot en Telegram

Hablá con [@BotFather](https://t.me/BotFather), mandale `/newbot`, seguí los
pasos y guardá el token que te da (`TELEGRAM_BOT_TOKEN`).

### 2. Crear el proyecto en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Andá a **SQL Editor** y corré el contenido de [`supabase/schema.sql`](supabase/schema.sql)
   (es seguro re-ejecutarlo si ya lo corriste antes; reemplaza las policies de RLS por la
   versión que valida contra el usuario logueado).
3. En **Project Settings > API** copiá:
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (¡nunca la expongas en el frontend!)
4. En **Authentication > Providers**, confirmá que **Email** esté habilitado
   (viene así por default). Si querés poder registrarte y entrar al toque sin
   revisar el mail, en **Authentication > Sign In / Providers > Email** apagá
   "Confirm email" — si lo dejás prendido, después de registrarte tenés que
   confirmar por mail antes de poder loguearte.

### 3. Variables de entorno

Copiá `.env.example` a `.env` y completá todo:

```bash
cp .env.example .env
```

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=      # opcional, cualquier string random propio
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

No hay variables nuevas para el login: Supabase Auth usa el mismo cliente
anon (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) que ya se usa para leer
`movimientos`.

### 4. Instalar dependencias

```bash
npm install
```

### 5. Deploy a Vercel

```bash
npx vercel
```

Seguí el flujo de login/link del proyecto. Después, cargá las mismas variables
de entorno de `.env` en **Project Settings > Environment Variables** de Vercel
(o con `vercel env add <NOMBRE>` una por una), y hacé el deploy de producción:

```bash
npx vercel --prod
```

Anotá la URL que te da (`https://tu-proyecto.vercel.app`).

### 6. Configurar el webhook de Telegram

Reemplazá `<TOKEN>`, `<URL>` y (si la usás) `<SECRET>`:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/webhook&secret_token=<SECRET>"
```

Debería responder `{"ok":true,"result":true,...}`. Para verificar el estado
del webhook en cualquier momento:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### 7. Probar

Escribile a tu bot en Telegram: `/start`, y después algo como `gasté 5000 en
nafta`. Debería contestarte con la confirmación y el movimiento debería
aparecer en el dashboard.

### 8. Correr el dashboard en local

```bash
npm run dev
```

Al abrirlo te va a pedir crear una cuenta (`Registrate`) o iniciar sesión.
Una vez adentro podés cargar, editar y borrar movimientos a mano con el botón
"Nuevo movimiento", sin depender del bot.

## Categorías

`comida`, `transporte`, `servicios`, `entretenimiento`, `salud`,
`indumentaria`, `hogar`, `sueldo`, `otros` — lista cerrada, definida en
[`shared/categories.ts`](shared/categories.ts) y usada tanto por el prompt de
Claude como por el frontend.

## Estructura

```
api/
  webhook.ts          # handler del webhook de Telegram
  _lib/
    telegram.ts       # helper para mandar mensajes
    claudeParser.ts   # parseo de texto -> JSON con Claude
    supabaseAdmin.ts  # cliente de Supabase con service role
shared/
  categories.ts       # lista cerrada de categorías/tipos
  types.ts            # tipos compartidos (Movimiento, ParsedMovimiento)
src/
  contexts/AuthContext.tsx   # sesión de Supabase Auth
  pages/                     # Login, Register, Dashboard
  components/                # Navbar, charts, tabla, formulario de movimiento
supabase/
  schema.sql          # tabla movimientos + RLS (ownership por auth.uid())
```
