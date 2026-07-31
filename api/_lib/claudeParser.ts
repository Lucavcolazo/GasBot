import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS, isCategoria, isTipo } from "../../shared/categories.ts";
import type { ParsedMovimiento } from "../../shared/types.ts";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Sos un asistente que extrae información de gastos e ingresos personales de un mensaje en español rioplatense.

Categorías válidas (usá exactamente una de estas, nunca inventes otra): ${CATEGORIAS.join(", ")}.

Reglas:
- "monto" es siempre un número positivo (sin signo, sin puntos de miles, con "." como separador decimal si hace falta).
- "descripcion" es una frase corta (2-4 palabras) que resume de qué se trata, en minúscula, sin repetir el monto.
- Si el mensaje no describe un gasto o ingreso claro, respondé exactamente {"error": "no_parseable"}.
- Respondé ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin explicaciones.

Formato de respuesta:
{"tipo": "gasto"|"ingreso", "monto": number, "categoria": "...", "descripcion": "..."}

Ejemplos:
"gasté 5000 en nafta" -> {"tipo": "gasto", "monto": 5000, "categoria": "transporte", "descripcion": "nafta"}
"cobré 80000 de sueldo" -> {"tipo": "ingreso", "monto": 80000, "categoria": "sueldo", "descripcion": "sueldo"}
"pagué 15.500 de expensas" -> {"tipo": "gasto", "monto": 15500, "categoria": "hogar", "descripcion": "expensas"}
"me pagaron 3000 por un laburo freelance" -> {"tipo": "ingreso", "monto": 3000, "categoria": "otros", "descripcion": "laburo freelance"}
"hola como andas" -> {"error": "no_parseable"}`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function parseMensaje(texto: string): Promise<ParsedMovimiento> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: texto }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { error: "no_parseable" };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(textBlock.text.trim());
  } catch {
    return { error: "no_parseable" };
  }

  if (!raw || typeof raw !== "object") return { error: "no_parseable" };

  if ("error" in raw) return { error: "no_parseable" };

  const { tipo, monto, categoria, descripcion } = raw as Record<string, unknown>;

  if (
    !isTipo(tipo) ||
    !isCategoria(categoria) ||
    typeof monto !== "number" ||
    !Number.isFinite(monto) ||
    monto <= 0 ||
    typeof descripcion !== "string" ||
    descripcion.trim().length === 0
  ) {
    return { error: "no_parseable" };
  }

  return { tipo, monto, categoria, descripcion: descripcion.trim() };
}
