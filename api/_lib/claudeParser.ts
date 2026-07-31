import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS, isCategoria, isTipo, type Categoria, type Tipo } from "../../shared/categories.js";
import type { AccionBot, ContextoBot } from "../../shared/types.js";

const MODEL = "claude-haiku-4-5-20251001";

const BASE_PROMPT = `Sos un asistente que interpreta mensajes en español rioplatense sobre finanzas personales y los convierte en una acción estructurada.

Categorías válidas para movimientos (usá exactamente una de estas, nunca inventes otra): ${CATEGORIAS.join(", ")}.

Acciones posibles (respondé ÚNICAMENTE con el JSON de UNA de estas formas, sin texto adicional, sin markdown):

1. Anotar un gasto o ingreso nuevo:
{"accion": "crear_movimiento", "tipo": "gasto"|"ingreso", "monto": number, "categoria": "...", "descripcion": "..."}

2. Corregir un movimiento que ya existe (el usuario dice que se equivocó, que corrija algo, etc.). Usá el "id" EXACTO de la lista de movimientos recientes de más abajo — nunca inventes uno. Repetí todos los campos, no solo el que cambia:
{"accion": "editar_movimiento", "id": "...", "tipo": "gasto"|"ingreso", "monto": number, "categoria": "...", "descripcion": "..."}

3. Borrar un movimiento existente. Usá el "id" EXACTO de la lista:
{"accion": "eliminar_movimiento", "id": "..."}

4. Crear un ahorro nuevo (el usuario menciona un ahorro/meta que no está en la lista de ahorros de más abajo):
{"accion": "crear_ahorro", "nombre": "...", "monto": number, "meta": number (opcional, omitir si no da una meta)}

5. Sumar plata a un ahorro que ya existe. Usá el "id" EXACTO de la lista de ahorros:
{"accion": "agregar_ahorro", "id": "...", "monto": number}

6. Borrar un ahorro existente. Usá el "id" EXACTO de la lista:
{"accion": "eliminar_ahorro", "id": "..."}

7. Preguntar el balance / cuánta plata tiene disponible:
{"accion": "consultar_balance"}

8. Preguntar por sus ahorros:
{"accion": "consultar_ahorros"}

9. Preguntar qué categorías existen:
{"accion": "consultar_categorias"}

10. Si el mensaje no encaja claramente en ninguna de las anteriores, o hace referencia a algo que no aparece en las listas de contexto:
{"accion": "no_entendido"}

Reglas:
- "monto" es siempre un número positivo (sin signo, sin puntos de miles).
- "descripcion" es una frase corta (2-4 palabras), en minúscula, sin repetir el monto.
- Para editar_movimiento/eliminar_movimiento/agregar_ahorro/eliminar_ahorro: si no hay una referencia clara y confiable en el contexto (por ejemplo "el último", una descripción que coincide, un nombre de ahorro que coincide), respondé "no_entendido" en vez de adivinar.
- Nunca inventes un id que no esté literalmente en las listas de contexto.

Ejemplos:
"gasté 5000 en nafta" -> {"accion": "crear_movimiento", "tipo": "gasto", "monto": 5000, "categoria": "transporte", "descripcion": "nafta"}
"cobré 80000 de sueldo" -> {"accion": "crear_movimiento", "tipo": "ingreso", "monto": 80000, "categoria": "sueldo", "descripcion": "sueldo"}
"me equivoqué, el alfajor salía 5k" (con "alfajor rasta" en la lista de movimientos, id abc-123) -> {"accion": "editar_movimiento", "id": "abc-123", "tipo": "gasto", "monto": 5000, "categoria": "comida", "descripcion": "alfajor rasta"}
"borrá lo del alfajor" (con "alfajor rasta" en la lista, id abc-123) -> {"accion": "eliminar_movimiento", "id": "abc-123"}
"quiero ahorrar para un auto, ya tengo 50000, la meta son 800000" -> {"accion": "crear_ahorro", "nombre": "auto", "monto": 50000, "meta": 800000}
"guardé 5000 más para el auto" (con ahorro "auto" en la lista, id xyz-789) -> {"accion": "agregar_ahorro", "id": "xyz-789", "monto": 5000}
"borrá el ahorro del celu" (con ahorro "celu nuevo" en la lista, id xyz-999) -> {"accion": "eliminar_ahorro", "id": "xyz-999"}
"cuánto tengo disponible" -> {"accion": "consultar_balance"}
"cómo van mis ahorros" -> {"accion": "consultar_ahorros"}
"qué categorías hay" -> {"accion": "consultar_categorias"}
"hola como andas" -> {"accion": "no_entendido"}
"borrá lo del cine" (sin nada de "cine" en la lista de movimientos) -> {"accion": "no_entendido"}`;

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

  return `${BASE_PROMPT}

CONTEXTO ACTUAL DEL USUARIO — usalo para resolver ediciones, borrados y referencias a nombres de ahorros. Nunca inventes un id que no esté acá:

Movimientos recientes:
${movimientosTexto}

Ahorros:
${ahorrosTexto}`;
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

interface CamposMovimiento {
  tipo: Tipo;
  monto: number;
  categoria: Categoria;
  descripcion: string;
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

  switch (r.accion) {
    case "crear_movimiento": {
      const campos = validarCamposMovimiento(r);
      return campos ? { accion: "crear_movimiento", ...campos } : { accion: "no_entendido" };
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
    case "eliminar_ahorro": {
      if (!idEnAhorros) return { accion: "no_entendido" };
      return { accion: "eliminar_ahorro", id: r.id as string };
    }
    case "consultar_balance":
      return { accion: "consultar_balance" };
    case "consultar_ahorros":
      return { accion: "consultar_ahorros" };
    case "consultar_categorias":
      return { accion: "consultar_categorias" };
    default:
      return { accion: "no_entendido" };
  }
}

export async function interpretarMensaje(texto: string, contexto: ContextoBot): Promise<AccionBot> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0,
    system: buildSystemPrompt(contexto),
    messages: [{ role: "user", content: texto }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return { accion: "no_entendido" };

  let raw: unknown;
  try {
    raw = JSON.parse(textBlock.text.trim());
  } catch {
    return { accion: "no_entendido" };
  }

  return validarAccion(raw, contexto);
}
