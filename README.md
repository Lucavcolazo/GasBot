# GasBot

Un bot de Telegram para anotar gastos e ingresos hablando en lenguaje natural, con un dashboard web para ver en qué se te va la plata.

Le escribís "gasté 5 lucas en nafta" y él solo entiende el monto, la categoría y lo guarda. Nada de formularios.

<img width="3840" height="2242" alt="home" src="https://github.com/user-attachments/assets/e8e4e28c-cc24-49ae-9990-be265c621c1c" />

## Qué hace

- Anota gastos e ingresos escribiendo como hablás: "me clavé 15 lucas en un asado", "cobré el sueldo, 80 lucas"
- Corrige y borra movimientos por chat: "me equivoqué, el alfajor salía 5k", "borrá lo del cine"
- Maneja metas de ahorro: "quiero ahorrar para un auto, ya tengo 50000"
- Responde el balance cuando le preguntás: "cuánto tengo disponible"
- Recuerda gastos fijos y avisa antes del vencimiento: "recordame pagar el alquiler el día 10, son 150000"
- Marca pagos automáticamente: "ya pagué el alquiler"
- Dashboard con balance, gráfico de gastos por categoría, ahorros y gastos fijos
- Cada usuario ve solo sus propios datos

## Stack

React + Vite + Tailwind · Vercel Serverless Functions (TypeScript) · Supabase (Postgres + Auth) · Claude Haiku (Anthropic) · Telegram Bot API

<details>
<summary>Estructura del proyecto</summary>

```
├── api/                    # Backend
│   ├── _lib/                # Parseo con IA, Telegram, auth, rate limiting
│   ├── cron/                 # Aviso diario de gastos fijos
│   ├── telegram/              # Vincular / desvincular Telegram
│   └── webhook.ts
├── shared/                  # Tipos y categorías compartidas
├── src/                      # Dashboard (React)
├── supabase/
│   └── schema.sql
└── vercel.json
```

</details>
