# 💸 GasBot

Bot de finanzas personales para Telegram con dashboard web. Anotá gastos, ingresos, ahorros y gastos fijos escribiéndole al bot como si hablaras con un amigo.

<!-- Reemplazá con un screenshot o GIF del dashboard -->
<!-- ![Dashboard](./docs/dashboard.png) -->

## ¿Qué es?

GasBot es una app de finanzas personales que combina un **bot de Telegram** con un **dashboard web**. Le mandás mensajes en lenguaje natural al bot ("gasté 5000 en nafta", "cobré el sueldo 80 lucas") y él se encarga de clasificar, guardar y organizar todo. Desde la web podés ver gráficos, manejar ahorros y configurar recordatorios de gastos fijos.

## Features

### 🤖 Bot de Telegram con IA

- **Lenguaje natural en español rioplatense** — escribí como hablás, con abreviaturas, errores de tipeo y todo ("me clavé 15 lucas en un asado", "gasté 5k en nafta")
- **Anotar gastos e ingresos** — el bot detecta monto, categoría y descripción automáticamente
- **Editar y borrar movimientos** — "me equivoqué, el alfajor salía 5k", "borrá lo del cine"
- **Manejar ahorros** — crear metas, sumar/sacar plata ("guardé 5000 más para el auto")
- **Consultar balance** — "cuánto tengo disponible"
- **Recordatorios de gastos fijos** — "recordame pagar el alquiler el día 10, son 150000"
- **Marcar pagos** — "ya pagué el alquiler" (lo anota como gasto automáticamente)

<!-- Reemplazá con screenshot o GIF de una conversación con el bot -->
<!-- ![Bot conversation](./docs/telegram-bot.png) -->

### 📊 Dashboard Web

- **Balance y resumen** por día, semana o mes
- **Gráfico de gastos por categoría**
- **Historial de movimientos** con edición y borrado
- **Sección de ahorros** con metas y progreso
- **Gastos fijos** con estado de pago mensual
- **Conexión de Telegram** desde la configuración

<!-- Reemplazá con screenshot del dashboard -->
<!-- ![Dashboard](./docs/dashboard-full.png) -->

### 🔔 Notificaciones automáticas

Un cron diario avisa por Telegram:
- **3 días antes** de cada vencimiento
- **El día del vencimiento** si todavía no pagaste

### 🛡️ Seguridad

- Autenticación con Supabase Auth (email + contraseña)
- Row Level Security (RLS) en todas las tablas
- Rate limiting: 20 mensajes por minuto por usuario
- Validación de webhook con secret token
- El frontend solo usa la publishable key, nunca la secret key

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Backend / API | Vercel Serverless Functions (TypeScript) |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| IA / NLP | Claude Haiku (Anthropic) |
| Bot | Telegram Bot API (webhook) |
| Deploy | Vercel |

## Estructura del proyecto

```
├── api/                    # Serverless functions (Vercel)
│   ├── _lib/               # Módulos compartidos del backend
│   │   ├── auth.ts         # Validación de JWT del frontend
│   │   ├── claudeParser.ts # Prompt + parsing de respuestas de Claude
│   │   ├── rateLimit.ts    # Rate limiting por chat
│   │   ├── supabaseAdmin.ts# Cliente de Supabase con service role key
│   │   └── telegram.ts     # Helper para la API de Telegram
│   ├── cron/
│   │   └── recordatorios.ts# Cron diario de notificaciones
│   ├── telegram/
│   │   ├── link.ts         # Generar código de vinculación
│   │   └── unlink.ts       # Desvincular Telegram
│   └── webhook.ts          # Webhook principal del bot
├── shared/                 # Tipos y lógica compartida front/back
│   ├── categories.ts       # Categorías válidas
│   ├── recordatorios.ts    # Lógica de periodos y vencimientos
│   └── types.ts            # Interfaces de TypeScript
├── src/                    # Frontend (React)
│   ├── components/         # Componentes UI
│   ├── contexts/           # AuthContext
│   ├── hooks/              # Custom hooks (useMovimientos, useAhorros, etc.)
│   ├── lib/                # Supabase client, agregaciones, tema de gráficos
│   └── pages/              # Dashboard, Login, Register
├── supabase/
│   └── schema.sql          # Schema completo de la base de datos
└── vercel.json             # Config de crons
```

## Setup

### Requisitos previos

- Node.js 18+
- Una cuenta en [Supabase](https://supabase.com)
- Una API key de [Anthropic](https://console.anthropic.com)
- Un bot de Telegram (creado con [@BotFather](https://t.me/BotFather))
- Una cuenta en [Vercel](https://vercel.com) (para deploy)

### 1. Clonar e instalar

```bash
git clone https://github.com/tu-usuario/GasBot.git
cd GasBot
npm install
```

### 2. Configurar Supabase

1. Crear un proyecto en [Supabase](https://supabase.com/dashboard)
2. Ir a **SQL Editor** y ejecutar el contenido de [`supabase/schema.sql`](./supabase/schema.sql)
3. Copiar la URL del proyecto y las API keys desde **Project Settings > API**

### 3. Variables de entorno

Copiar `.env.example` a `.env` y completar:

```bash
cp .env.example .env
```

```env
# Telegram
TELEGRAM_BOT_TOKEN=           # Token de @BotFather
TELEGRAM_WEBHOOK_SECRET=      # String random para validar webhooks

# Claude
ANTHROPIC_API_KEY=            # API key de Anthropic

# Supabase (backend)
SUPABASE_URL=                 # URL del proyecto
SUPABASE_SECRET_KEY=          # Secret/service role key

# Supabase (frontend)
VITE_SUPABASE_URL=            # Misma URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Publishable/anon key

# Cron (opcional)
CRON_SECRET=                  # String random para proteger el endpoint de cron
```

### 4. Desarrollo local

```bash
npm run dev
```

La app web corre en `http://localhost:5173`. El bot de Telegram necesita un deploy o un túnel (ngrok) para recibir webhooks.

### 5. Deploy en Vercel

1. Conectar el repo a Vercel
2. Configurar las variables de entorno en el dashboard de Vercel
3. Configurar el webhook de Telegram apuntando a tu deploy:

```bash
curl "https://api.telegram.org/bot<TU_TOKEN>/setWebhook?url=https://<TU_DOMINIO>/api/webhook&secret_token=<TU_WEBHOOK_SECRET>"
```

## Categorías

Los movimientos se clasifican automáticamente en:

`comida` · `transporte` · `servicios` · `entretenimiento` · `salud` · `indumentaria` · `hogar` · `sueldo` · `otros`

## Ejemplos de mensajes

| Mensaje | Acción |
|---------|--------|
| "gasté 5000 en nafta" | Anota gasto de $5.000 en Transporte |
| "cobré 80 lucas de sueldo" | Anota ingreso de $80.000 en Sueldo |
| "me clavé 15k en un asado" | Anota gasto de $15.000 en Comida |
| "me equivoqué, el alfajor salía 5k" | Corrige el monto del movimiento |
| "borrá lo del cine" | Elimina el movimiento |
| "quiero ahorrar para un auto, ya tengo 50000" | Crea meta de ahorro |
| "guardé 5000 más para el auto" | Suma al ahorro existente |
| "cuánto tengo disponible" | Muestra el balance |
| "recordame pagar el alquiler el día 10, son 150000" | Crea recordatorio mensual |
| "ya pagué el alquiler" | Marca pagado + anota el gasto |

## Licencia

MIT
