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
Telegram inserta usando la secret key (bypassea RLS), pero para que esas filas
aparezcan en tu dashboard hay que decirle explícitamente con qué usuario de
Supabase asociarlas — eso es lo que hace `TELEGRAM_USER_ID` (ver paso 3). Es un
bot pensado para un solo usuario: además, `TELEGRAM_ALLOWED_CHAT_ID` hace que
ignore cualquier mensaje que no venga de tu chat de Telegram.

## Setup

### 1. Crear el bot en Telegram

Hablá con [@BotFather](https://t.me/BotFather), mandale `/newbot`, seguí los
pasos y guardá el token que te da (`TELEGRAM_BOT_TOKEN`).

### 2. Crear el proyecto en Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Andá a **SQL Editor** y corré el contenido de [`supabase/schema.sql`](supabase/schema.sql)
   (es seguro re-ejecutarlo si ya lo corriste antes; reemplaza las policies de RLS por la
   versión que valida contra el usuario logueado).
3. En **Project Settings > API Keys** copiá:
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `publishable` key → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `secret` key → `SUPABASE_SECRET_KEY` (¡nunca la expongas en el frontend!)
4. En **Authentication > Providers**, confirmá que **Email** esté habilitado
   (viene así por default). Si querés poder registrarte y entrar al toque sin
   revisar el mail, en **Authentication > Sign In / Providers > Email** apagá
   "Confirm email" — si lo dejás prendido, después de registrarte tenés que
   confirmar por mail antes de poder loguearte.
5. Registrate/logueate una vez en el dashboard web (paso 9), después andá a
   **Authentication > Users** y copiá el UUID de tu usuario → `TELEGRAM_USER_ID`
   (paso 3). Es el usuario al que se le van a atribuir los movimientos que
   cargue el bot.

### 3. Variables de entorno

Copiá `.env.example` a `.env` y completá todo:

```bash
cp .env.example .env
```

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=      # opcional, cualquier string random propio
TELEGRAM_ALLOWED_CHAT_ID=    # se completa en el paso 7, dejalo vacio por ahora
TELEGRAM_USER_ID=            # UUID de tu usuario en Supabase (paso 2.5)
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

No hay variables nuevas para el login: Supabase Auth usa el mismo cliente
publishable (`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`) que ya se
usa para leer `movimientos`.

`ANTHROPIC_API_KEY` — usá una key con poco saldo cargado (con $5 alcanza de
sobra). El parseo usa `claude-haiku-4-5`, el modelo más barato de la familia,
con `max_tokens: 300` y sin reintentos — cada mensaje cuesta una fracción de
centavo, así que $5 rinden para miles de mensajes.

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

### 7. Restringir el bot a tu chat

Escribile `/start` a tu bot en Telegram. Te va a contestar con tu `chat id`.
Copiá ese número en `TELEGRAM_ALLOWED_CHAT_ID` (local y en Vercel) y hacé un
redeploy (`npx vercel --prod`). De ahí en adelante el bot solo va a responder
a mensajes tuyos; cualquier otro chat solo recibe su propio chat id, sin poder
cargar nada.

### 8. Probar

Escribile algo como `gasté 5000 en nafta`. Debería contestarte con la
confirmación, y el movimiento debería aparecer en el dashboard (mismo usuario
que pusiste en `TELEGRAM_USER_ID`).

### 9. Correr el dashboard en local

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
    supabaseAdmin.ts  # cliente de Supabase con la secret key
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
