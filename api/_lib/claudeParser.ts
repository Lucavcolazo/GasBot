import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS, isCategoria, isTipo } from "../../shared/categories.js";
import { diaSemanaArgentina, hoyArgentinaISO } from "../../shared/recordatorios.js";
import type { AccionBot, CamposMovimiento, ContextoBot } from "../../shared/types.js";

const MODEL = "claude-haiku-4-5-20251001";

const BASE_PROMPT = `Sos un asistente que interpreta mensajes en español rioplatense sobre finanzas personales y los convierte en una acción estructurada.

Categorías válidas para movimientos (usá exactamente una de estas, nunca inventes otra): ${CATEGORIAS.join(", ")}.

Acciones posibles (respondé ÚNICAMENTE con el JSON de UNA de estas formas, sin texto adicional, sin markdown):

1. Anotar uno o más gastos/ingresos nuevos. Un mismo mensaje puede describir varios movimientos (por ejemplo un paseo con varias compras) — devolvé un elemento en "movimientos" por cada uno que puedas interpretar con confianza. Si además el mensaje menciona algo que no quedó claro (por ejemplo un gasto sin monto), agregá "pregunta" con lo que necesitás que te aclare; si todo quedó claro, omitila:
{"accion": "crear_movimientos", "movimientos": [{"tipo": "gasto"|"ingreso", "monto": number, "categoria": "...", "descripcion": "..."}, ...], "pregunta": "..." (opcional)}

2. Corregir un movimiento que ya existe (el usuario dice que se equivocó, que corrija algo, etc.). Usá el "id" EXACTO de la lista de movimientos recientes de más abajo — nunca inventes uno. Repetí todos los campos, no solo el que cambia:
{"accion": "editar_movimiento", "id": "...", "tipo": "gasto"|"ingreso", "monto": number, "categoria": "...", "descripcion": "..."}

3. Borrar un movimiento existente. Usá el "id" EXACTO de la lista:
{"accion": "eliminar_movimiento", "id": "..."}

4. Crear un ahorro nuevo (el usuario menciona un ahorro/meta que no está en la lista de ahorros de más abajo):
{"accion": "crear_ahorro", "nombre": "...", "monto": number, "meta": number (opcional, omitir si no da una meta)}

5. Sumar plata a un ahorro que ya existe. Usá el "id" EXACTO de la lista de ahorros:
{"accion": "agregar_ahorro", "id": "...", "monto": number}

6. Sacar/retirar/usar plata de un ahorro que ya existe (el usuario gastó o retiró parte de lo ahorrado). Usá el "id" EXACTO de la lista:
{"accion": "restar_ahorro", "id": "...", "monto": number}

7. Borrar un ahorro existente. Usá el "id" EXACTO de la lista:
{"accion": "eliminar_ahorro", "id": "..."}

8. Preguntar el balance / cuánta plata tiene disponible / cómo viene la plata, en general o en un período (esta semana, este mes, este año, el mes pasado, de marzo a mayo, en 2025, del 1 al 15 de agosto, etc.). Si no menciona ningún período, omití "desde" y "hasta" (te doy el total histórico). Si menciona un período, calculá "desde"/"hasta" en base a la fecha de hoy (más abajo), en formato "YYYY-MM-DD":
{"accion": "consultar_balance", "desde": "YYYY-MM-DD" (opcional), "hasta": "YYYY-MM-DD" (opcional)}

9. Preguntar por sus ahorros:
{"accion": "consultar_ahorros"}

10. Preguntar qué categorías existen:
{"accion": "consultar_categorias"}

11. Pedir la lista de movimientos, sean recientes o de un período (gastos y/o ingresos), por ejemplo "qué gasté", "en qué gasté esta semana", "mis últimos gastos", "qué ingresos tuve", "mostrame lo de julio", "gastos de 2025", "del 1 al 15 de agosto". "tipo" es opcional: omitilo si pide todo, usá "gasto" si pide solo gastos, "ingreso" si pide solo ingresos. "desde"/"hasta" son opcionales: omitilos si no menciona ningún período (te doy los más recientes), o calculalos en base a la fecha de hoy (más abajo) si menciona uno, en formato "YYYY-MM-DD":
{"accion": "listar_movimientos", "tipo": "gasto"|"ingreso" (opcional), "desde": "YYYY-MM-DD" (opcional), "hasta": "YYYY-MM-DD" (opcional)}

12. Crear un recordatorio de gasto fijo mensual (el usuario menciona un gasto recurrente que quiere que le recuerde, como el alquiler, un servicio, una suscripción, con un día del mes en que vence). Si no da un día del mes, respondé "no_entendido":
{"accion": "crear_recordatorio", "nombre": "...", "monto": number, "categoria": "...", "dia_vencimiento": number (1-31)}

13. Borrar un recordatorio existente. Usá el "id" EXACTO de la lista de recordatorios de más abajo:
{"accion": "eliminar_recordatorio", "id": "..."}

14. Marcar como pagado un recordatorio de este mes (el usuario dice que ya pagó ese gasto fijo). Esto también anota el gasto como movimiento, así que no crees además un "crear_movimientos" para lo mismo. Usá el "id" EXACTO de la lista de recordatorios:
{"accion": "marcar_pagado_recordatorio", "id": "..."}

15. Pedir la lista de recordatorios / gastos fijos:
{"accion": "listar_recordatorios"}

16. El mensaje es sobre plata/finanzas pero falta un dato clave para registrar algo (monto, a qué movimiento/ahorro/recordatorio se refiere, etc.) y no hay ningún movimiento nuevo que sí puedas anotar con confianza. Preguntale directamente y de forma breve qué necesitás saber:
{"accion": "pregunta", "texto": "..."}

17. Si el mensaje no encaja claramente en ninguna de las anteriores, o hace referencia a algo que no aparece en las listas de contexto:
{"accion": "no_entendido"}

Reglas:
- "monto" es siempre un número positivo (sin signo, sin puntos de miles). Interpretá abreviaturas coloquiales: "5k" o "5 lucas" o "5 mil" son 5000; "2kk" o "2 palos" son 2000000.
- "descripcion" es una frase corta (2-4 palabras), en minúscula, sin repetir el monto.
- Para editar_movimiento/eliminar_movimiento/agregar_ahorro/restar_ahorro/eliminar_ahorro: si no hay una referencia clara y confiable en el contexto (por ejemplo "el último", una descripción que coincide, un nombre de ahorro que coincide), respondé "pregunta" preguntando específicamente a qué se refiere, en vez de adivinar.
- Nunca inventes un id que no esté literalmente en las listas de contexto.
- Para calcular "desde"/"hasta" en consultar_balance/listar_movimientos, usá la fecha de hoy que te paso más abajo: "esta semana" es de este lunes a hoy; "este mes" es del día 1 del mes actual a hoy; "este año" es del 1 de enero al día de hoy; "el mes pasado" es el mes calendario completo anterior (1 al último día); "en 2025" es del 1 de enero al 31 de diciembre de 2025; "de marzo a mayo" (sin año) es del 1 de marzo al 31 de mayo del año actual. Si da un rango explícito de fechas, usalo tal cual.
- Los usuarios escriben en español rioplatense informal, con errores de tipeo, sin tildes, y usan muchos sinónimos. Interpretá la intención, no la redacción exacta. Ejemplos de sinónimos:
  - Crear gasto: "gasté", "pagué", "me clavé", "me comí", "me gasté", "salió", "tuve que pagar", "se me fue en".
  - Crear ingreso: "cobré", "entraron", "me depositaron", "me pagaron", "gané", "cayó".
  - Editar: "me equivoqué", "en realidad", "no era X sino Y", "corregí", "corrígelo", "cambialo", "arreglalo".
  - Eliminar: "bórralo", "borralo", "eliminalo", "sacalo", "anulalo", "no cuenta eso".
  - Crear ahorro: "quiero ahorrar", "quiero juntar plata para", "arranco un fondo para", "estoy guardando para".
  - Agregar a ahorro: "guardé más", "sumá", "metí más plata", "aparté más".
  - Restar de ahorro: "usé plata de", "saqué del ahorro", "gasté lo que tenía ahorrado para".
  - Crear recordatorio: "recordame pagar", "avisame cuando venza", "todos los meses pago", "quiero que me acuerdes de", "gasto fijo de".
  - Marcar recordatorio pagado: "ya pagué el/la [recordatorio]", "pagué [recordatorio] de este mes", "listo, ya aboné [recordatorio]".
- Respondé SIEMPRE con el objeto JSON solo: sin bloques de código markdown (nada de \`\`\`), sin explicaciones antes o después, sin pedir datos personales ni autenticación.

Ejemplos:
"gasté 5000 en nafta" -> {"accion": "crear_movimientos", "movimientos": [{"tipo": "gasto", "monto": 5000, "categoria": "transporte", "descripcion": "nafta"}]}
"cobré 80000 de sueldo" -> {"accion": "crear_movimientos", "movimientos": [{"tipo": "ingreso", "monto": 80000, "categoria": "sueldo", "descripcion": "sueldo"}]}
"me comí un alfajor de 10k" -> {"accion": "crear_movimientos", "movimientos": [{"tipo": "gasto", "monto": 10000, "categoria": "comida", "descripcion": "alfajor"}]}
"me clavé 15 lucas en un asado" -> {"accion": "crear_movimientos", "movimientos": [{"tipo": "gasto", "monto": 15000, "categoria": "comida", "descripcion": "asado"}]}
"salí a caminar y compré un alfajor que pagué 3k, y a la vuelta una coca de 2k" -> {"accion": "crear_movimientos", "movimientos": [{"tipo": "gasto", "monto": 3000, "categoria": "comida", "descripcion": "alfajor"}, {"tipo": "gasto", "monto": 2000, "categoria": "comida", "descripcion": "coca"}]}
"compré un alfajor y una coca, salió 5k en total" (no queda claro cuánto es cada uno) -> {"accion": "pregunta", "texto": "¿Cuánto pagaste por el alfajor y cuánto por la coca?"}
"me compré unas zapatillas y también cargué nafta, las zapatillas 40k" (la nafta no tiene monto) -> {"accion": "crear_movimientos", "movimientos": [{"tipo": "gasto", "monto": 40000, "categoria": "indumentaria", "descripcion": "zapatillas"}], "pregunta": "¿Cuánto pagaste de nafta?"}
"me equivoqué, el alfajor salía 5k" (con "alfajor rasta" en la lista de movimientos, id abc-123) -> {"accion": "editar_movimiento", "id": "abc-123", "tipo": "gasto", "monto": 5000, "categoria": "comida", "descripcion": "alfajor rasta"}
"borrá lo del alfajor" (con "alfajor rasta" en la lista, id abc-123) -> {"accion": "eliminar_movimiento", "id": "abc-123"}
"me equivoqué con el alfajor, bórralo" (con "alfajor rasta" en la lista, id abc-123) -> {"accion": "eliminar_movimiento", "id": "abc-123"}
"quiero ahorrar para un auto, ya tengo 50000, la meta son 800000" -> {"accion": "crear_ahorro", "nombre": "auto", "monto": 50000, "meta": 800000}
"guardé 5000 más para el auto" (con ahorro "auto" en la lista, id xyz-789) -> {"accion": "agregar_ahorro", "id": "xyz-789", "monto": 5000}
"usé 10000 del ahorro del auto para un arreglo" (con ahorro "auto" en la lista, id xyz-789) -> {"accion": "restar_ahorro", "id": "xyz-789", "monto": 10000}
"borrá el ahorro del celu" (con ahorro "celu nuevo" en la lista, id xyz-999) -> {"accion": "eliminar_ahorro", "id": "xyz-999"}
"cuánto tengo disponible" -> {"accion": "consultar_balance"}
"cuanto disponible tengo?" -> {"accion": "consultar_balance"}
"cómo van mis ahorros" -> {"accion": "consultar_ahorros"}
"qué categorías hay" -> {"accion": "consultar_categorias"}
"qué gastos tengo" -> {"accion": "listar_movimientos", "tipo": "gasto"}
"mostrame mis últimos movimientos" -> {"accion": "listar_movimientos"}
Los siguientes ejemplos asumen que hoy es 2026-08-05 (miércoles):
"en qué gasté esta semana" -> {"accion": "listar_movimientos", "tipo": "gasto", "desde": "2026-08-03", "hasta": "2026-08-05"}
"cómo vengo este mes" -> {"accion": "consultar_balance", "desde": "2026-08-01", "hasta": "2026-08-05"}
"cuánto gasté en julio" -> {"accion": "listar_movimientos", "tipo": "gasto", "desde": "2026-07-01", "hasta": "2026-07-31"}
"balance de este año" -> {"accion": "consultar_balance", "desde": "2026-01-01", "hasta": "2026-08-05"}
"gastos de 2025" -> {"accion": "listar_movimientos", "tipo": "gasto", "desde": "2025-01-01", "hasta": "2025-12-31"}
"cómo me fue del 1 al 15 de julio" -> {"accion": "consultar_balance", "desde": "2026-07-01", "hasta": "2026-07-15"}
"recordame pagar el alquiler el día 10, son 150000" -> {"accion": "crear_recordatorio", "nombre": "alquiler", "monto": 150000, "categoria": "hogar", "dia_vencimiento": 10}
"avisame del gimnasio el 5 de cada mes, sale 8000" -> {"accion": "crear_recordatorio", "nombre": "gimnasio", "monto": 8000, "categoria": "salud", "dia_vencimiento": 5}
"ya pagué el alquiler" (con "alquiler" en la lista de recordatorios, id rec-1) -> {"accion": "marcar_pagado_recordatorio", "id": "rec-1"}
"borrá el recordatorio del gimnasio" (con "gimnasio" en la lista, id rec-2) -> {"accion": "eliminar_recordatorio", "id": "rec-2"}
"qué gastos fijos tengo" -> {"accion": "listar_recordatorios"}
"hola como andas" -> {"accion": "no_entendido"}
"borrá lo del cine" (sin nada de "cine" en la lista de movimientos) -> {"accion": "pregunta", "texto": "No encontré ningún gasto de cine anotado, ¿a cuál te referís?"}`;

function buildSystemPrompt(contexto: ContextoBot): string {
  const movimientosTexto = contexto.movimientos.length
    ? contexto.movimientos
        .map((m) => `- id=${m.id} | ${m.tipo} | $${m.monto} | ${m.categoria} | "${m.descripcion ?? ""}" | ${m.hace}`)
        .join("\n")
    : "(sin movimientos recientes)";

  const ahorrosTexto = contexto.ahorros.length
    ? contexto.ahorros
        .map((a) => `- id=${a.id} | "${a.nombre}" | actual: $${a.monto_actual}${a.meta ? ` | meta: $${a.meta}` : ""}`)
        .join("\n")
    : "(sin ahorros cargados)";

  const recordatoriosTexto = contexto.recordatorios.length
    ? contexto.recordatorios
        .map(
          (r) =>
            `- id=${r.id} | "${r.nombre}" | $${r.monto} | ${r.categoria} | vence el día ${r.dia_vencimiento} | ${
              r.pagado ? "ya pagado este mes" : "pendiente este mes"
            }`,
        )
        .join("\n")
    : "(sin recordatorios cargados)";

  return `${BASE_PROMPT}

Hoy es ${hoyArgentinaISO()} (${diaSemanaArgentina()}), hora Argentina.

CONTEXTO ACTUAL DEL USUARIO — usalo para resolver ediciones, borrados y referencias a nombres de ahorros o recordatorios. Nunca inventes un id que no esté acá:

Movimientos recientes:
${movimientosTexto}

Ahorros:
${ahorrosTexto}

Recordatorios (gastos fijos):
${recordatoriosTexto}`;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey });
  }
  return client;
}

function validarFechaISO(v: unknown): string | undefined {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

function validarCamposMovimiento(r: Record<string, unknown>): CamposMovimiento | null {
  const { tipo, monto, categoria, descripcion } = r;
  if (!isTipo(tipo) || !isCategoria(categoria)) return null;
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) return null;
  if (typeof descripcion !== "string" || descripcion.trim().length === 0) return null;
  return { tipo, monto, categoria, descripcion: descripcion.trim() };
}

function validarAccion(raw: unknown, contexto: ContextoBot): AccionBot {
  if (!raw || typeof raw !== "object") return { accion: "no_entendido" };
  const r = raw as Record<string, unknown>;

  const idEnMovimientos = typeof r.id === "string" && contexto.movimientos.some((m) => m.id === r.id);
  const idEnAhorros = typeof r.id === "string" && contexto.ahorros.some((a) => a.id === r.id);
  const idEnRecordatorios = typeof r.id === "string" && contexto.recordatorios.some((rec) => rec.id === r.id);

  switch (r.accion) {
    case "crear_movimientos": {
      const movimientosRaw = Array.isArray(r.movimientos) ? r.movimientos : [];
      const movimientos = movimientosRaw
        .map((m) => (m && typeof m === "object" ? validarCamposMovimiento(m as Record<string, unknown>) : null))
        .filter((m): m is CamposMovimiento => m !== null);
      const pregunta = typeof r.pregunta === "string" && r.pregunta.trim().length > 0 ? r.pregunta.trim() : undefined;
      if (movimientos.length === 0 && !pregunta) return { accion: "no_entendido" };
      return { accion: "crear_movimientos", movimientos, pregunta };
    }
    case "editar_movimiento": {
      const campos = validarCamposMovimiento(r);
      if (!campos || !idEnMovimientos) return { accion: "no_entendido" };
      return { accion: "editar_movimiento", id: r.id as string, ...campos };
    }
    case "eliminar_movimiento": {
      if (!idEnMovimientos) return { accion: "no_entendido" };
      return { accion: "eliminar_movimiento", id: r.id as string };
    }
    case "crear_ahorro": {
      const { nombre, monto, meta } = r;
      if (typeof nombre !== "string" || nombre.trim().length === 0) return { accion: "no_entendido" };
      if (typeof monto !== "number" || !Number.isFinite(monto) || monto < 0) return { accion: "no_entendido" };
      if (meta !== undefined && meta !== null && (typeof meta !== "number" || !Number.isFinite(meta) || meta <= 0)) {
        return { accion: "no_entendido" };
      }
      return {
        accion: "crear_ahorro",
        nombre: nombre.trim(),
        monto,
        meta: typeof meta === "number" ? meta : undefined,
      };
    }
    case "agregar_ahorro": {
      if (!idEnAhorros) return { accion: "no_entendido" };
      if (typeof r.monto !== "number" || !Number.isFinite(r.monto) || r.monto <= 0) return { accion: "no_entendido" };
      return { accion: "agregar_ahorro", id: r.id as string, monto: r.monto };
    }
    case "restar_ahorro": {
      if (!idEnAhorros) return { accion: "no_entendido" };
      if (typeof r.monto !== "number" || !Number.isFinite(r.monto) || r.monto <= 0) return { accion: "no_entendido" };
      return { accion: "restar_ahorro", id: r.id as string, monto: r.monto };
    }
    case "eliminar_ahorro": {
      if (!idEnAhorros) return { accion: "no_entendido" };
      return { accion: "eliminar_ahorro", id: r.id as string };
    }
    case "consultar_balance":
      return { accion: "consultar_balance", desde: validarFechaISO(r.desde), hasta: validarFechaISO(r.hasta) };
    case "consultar_ahorros":
      return { accion: "consultar_ahorros" };
    case "consultar_categorias":
      return { accion: "consultar_categorias" };
    case "listar_movimientos": {
      if (r.tipo !== undefined && !isTipo(r.tipo)) return { accion: "no_entendido" };
      return {
        accion: "listar_movimientos",
        tipo: isTipo(r.tipo) ? r.tipo : undefined,
        desde: validarFechaISO(r.desde),
        hasta: validarFechaISO(r.hasta),
      };
    }
    case "crear_recordatorio": {
      const { nombre, monto, categoria, dia_vencimiento } = r;
      if (typeof nombre !== "string" || nombre.trim().length === 0) return { accion: "no_entendido" };
      if (!isCategoria(categoria)) return { accion: "no_entendido" };
      if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) return { accion: "no_entendido" };
      if (
        typeof dia_vencimiento !== "number" ||
        !Number.isInteger(dia_vencimiento) ||
        dia_vencimiento < 1 ||
        dia_vencimiento > 31
      ) {
        return { accion: "no_entendido" };
      }
      return { accion: "crear_recordatorio", nombre: nombre.trim(), monto, categoria, dia_vencimiento };
    }
    case "eliminar_recordatorio": {
      if (!idEnRecordatorios) return { accion: "no_entendido" };
      return { accion: "eliminar_recordatorio", id: r.id as string };
    }
    case "marcar_pagado_recordatorio": {
      if (!idEnRecordatorios) return { accion: "no_entendido" };
      return { accion: "marcar_pagado_recordatorio", id: r.id as string };
    }
    case "listar_recordatorios":
      return { accion: "listar_recordatorios" };
    case "pregunta": {
      if (typeof r.texto !== "string" || r.texto.trim().length === 0) return { accion: "no_entendido" };
      return { accion: "pregunta", texto: r.texto.trim() };
    }
    default:
      return { accion: "no_entendido" };
  }
}

// El modelo a veces ignora "sin markdown" y devuelve el JSON envuelto en un
// bloque ```json, o con texto charlatán alrededor. Antes esto rompía
// JSON.parse y todo caía silenciosamente en "no_entendido" aunque el modelo
// hubiera interpretado bien el mensaje. Limpiamos fences y, si hace falta,
// extraemos el primer objeto {...} del texto.
function extraerJSON(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(limpio);
  } catch {
    // sigue abajo
  }

  const match = limpio.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // no hay JSON válido
    }
  }

  return null;
}

export async function interpretarMensaje(texto: string, contexto: ContextoBot): Promise<AccionBot> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 600,
    temperature: 0,
    system: buildSystemPrompt(contexto),
    messages: [{ role: "user", content: texto }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return { accion: "no_entendido" };

  const raw = extraerJSON(textBlock.text);
  if (raw === null) return { accion: "no_entendido" };

  return validarAccion(raw, contexto);
}
