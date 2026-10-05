import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  answerCallbackQuery,
  descargarArchivo,
  editMessageText,
  sendMessage,
  type TelegramUpdate,
} from "./_lib/telegram.js";
import { interpretarMensaje, interpretarResumen, type Adjunto } from "./_lib/claudeParser.js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { CATEGORIAS, type Tipo } from "../shared/categories.js";
import type {
  CamposMovimiento,
  ContextoAhorro,
  ContextoBot,
  ContextoMovimiento,
  ContextoRecordatorio,
} from "../shared/types.js";
import {
  estadoParaPeriodo,
  fechaArgentinaISO,
  finDiaArgentina,
  hoyArgentina,
  hoyArgentinaISO,
  inicioDiaArgentina,
  mediodiaArgentina,
  periodoKey,
} from "../shared/recordatorios.js";
import { desmarcarPagado, marcarPagado } from "../shared/pagosRecordatorios.js";
import { capitalize, formatMonto, formatPeriodoLabel } from "./_lib/format.js";
import { checkRateLimit } from "./_lib/rateLimit.js";

const WELCOME = `Hola. Soy GasBot.

Contame tus gastos e ingresos como si se lo dijeras a un amigo, por ejemplo:
- "gasté 5000 en nafta"
- "cobré 80000 de sueldo"
- "pagué 3200 de streaming"

También puedo corregir o borrar algo que ya anotaste, manejar tus ahorros
("guardé 5000 más para el auto", "quiero ahorrar para un celu, ya tengo 20000"),
tus gastos fijos ("recordame el alquiler el día 10, son 150000", "ya pagué el alquiler")
y contarte tu balance o cómo van tus ahorros.

Si te atrasaste, mandame una captura o el PDF del resumen (Mercado Pago, banco,
tarjeta) y te cargo todos los movimientos con su fecha.`;

function haceTiempo(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

// Fila para insertar en movimientos. created_at va siempre explícito: en un
// insert de varias filas, supabase-js manda null en las columnas que faltan
// en alguna fila en vez de usar el default.
function filaMovimiento(userId: string, m: CamposMovimiento, mensajeOriginal: string) {
  return {
    user_id: userId,
    tipo: m.tipo,
    monto: m.monto,
    categoria: m.categoria,
    descripcion: m.descripcion,
    mensaje_original: mensajeOriginal,
    created_at: m.fecha ? mediodiaArgentina(m.fecha) : new Date().toISOString(),
  };
}

// "2026-10-03" -> "03/10"
function diaMes(fechaISO: string): string {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
}

async function usuarioDelChat(chatId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("telegram_links").select("user_id").eq("chat_id", chatId).maybeSingle();
  return data?.user_id ?? null;
}

/* ---------- importar resúmenes (foto o PDF) ---------- */

const IMAGEN_TIPOS = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImagenTipo = (typeof IMAGEN_TIPOS)[number];
const isImagenTipo = (v: unknown): v is ImagenTipo => (IMAGEN_TIPOS as readonly unknown[]).includes(v);

const MAX_IMAGEN_BYTES = 5 * 1024 * 1024; // límite de Claude por imagen
const MAX_PDF_BYTES = 15 * 1024 * 1024; // en base64 crece ~33%, y Claude acepta hasta 32 MB por request
const IMPORTACION_VIGENCIA_MS = 24 * 60 * 60 * 1000;
const PREVIEW_MAX_LINEAS = 40;
const PREGUNTA_IMPORTAR = "¿Los cargo?";
const TELEGRAM_MAX_TEXTO = 4000; // el tope real es 4096

type ArchivoMensaje =
  | { tipo: "imagen"; mediaType: ImagenTipo; fileId: string; size?: number }
  | { tipo: "pdf"; fileId: string; size?: number };

function archivoDelMensaje(message: NonNullable<TelegramUpdate["message"]>): ArchivoMensaje | "no_soportado" | null {
  // Telegram manda la foto en varios tamaños, de menor a mayor.
  const foto = message.photo?.at(-1);
  if (foto) return { tipo: "imagen", mediaType: "image/jpeg", fileId: foto.file_id, size: foto.file_size };

  const doc = message.document;
  if (!doc) return null;
  if (doc.mime_type === "application/pdf") return { tipo: "pdf", fileId: doc.file_id, size: doc.file_size };
  if (isImagenTipo(doc.mime_type)) {
    return { tipo: "imagen", mediaType: doc.mime_type, fileId: doc.file_id, size: doc.file_size };
  }
  return "no_soportado";
}

// Saca los movimientos que ya estaban anotados (mismo tipo, monto y día), por
// si el usuario cargó algunos a mano o manda dos veces el mismo resumen. Cuenta
// repeticiones: si había un café de $2000 anotado y el resumen tiene dos, uno
// es nuevo.
async function separarRepetidos(
  userId: string,
  movimientos: CamposMovimiento[],
): Promise<{ nuevos: CamposMovimiento[]; repetidos: number }> {
  const hoy = hoyArgentinaISO();
  const clave = (tipo: string, monto: number, fecha: string) => `${tipo}|${Number(monto)}|${fecha}`;
  const fechas = movimientos.map((m) => m.fecha ?? hoy).sort();

  const { data: existentes } = await supabaseAdmin
    .from("movimientos")
    .select("tipo, monto, created_at")
    .eq("user_id", userId)
    .gte("created_at", inicioDiaArgentina(fechas[0]))
    .lte("created_at", finDiaArgentina(fechas[fechas.length - 1]));

  const disponibles = new Map<string, number>();
  for (const e of existentes ?? []) {
    const k = clave(e.tipo, e.monto, fechaArgentinaISO(new Date(e.created_at)));
    disponibles.set(k, (disponibles.get(k) ?? 0) + 1);
  }

  const nuevos: CamposMovimiento[] = [];
  let repetidos = 0;
  for (const m of movimientos) {
    const k = clave(m.tipo, m.monto, m.fecha ?? hoy);
    const n = disponibles.get(k) ?? 0;
    if (n > 0) {
      disponibles.set(k, n - 1);
      repetidos++;
    } else {
      nuevos.push(m);
    }
  }
  return { nuevos, repetidos };
}

function textoPreview(movimientos: CamposMovimiento[], repetidos: number, nota?: string): string {
  const hoy = hoyArgentinaISO();
  const ordenados = [...movimientos].sort((a, b) => (a.fecha ?? hoy).localeCompare(b.fecha ?? hoy));
  const mostrados = ordenados.slice(0, PREVIEW_MAX_LINEAS);

  const lineas = mostrados.map(
    (m) =>
      `${diaMes(m.fecha ?? hoy)} · ${m.tipo === "ingreso" ? "+" : ""}$${formatMonto(m.monto)} · ${capitalize(m.descripcion)} (${capitalize(m.categoria)})`,
  );
  if (ordenados.length > mostrados.length) lineas.push(`… y ${ordenados.length - mostrados.length} más`);

  const gastos = movimientos.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const totales = [`Gastos: $${formatMonto(gastos)}`, ingresos > 0 ? `Ingresos: $${formatMonto(ingresos)}` : ""]
    .filter(Boolean)
    .join(" · ");

  const n = movimientos.length;
  const partes = [
    `Encontré ${n} movimiento${n === 1 ? "" : "s"} para cargar:`,
    lineas.join("\n"),
    totales,
    repetidos > 0 ? `Salteé ${repetidos} que ya tenías anotado${repetidos === 1 ? "" : "s"}.` : "",
    nota ?? "",
  ].filter(Boolean);

  const cuerpo = partes.join("\n\n").slice(0, TELEGRAM_MAX_TEXTO - PREGUNTA_IMPORTAR.length - 2);
  return `${cuerpo}\n\n${PREGUNTA_IMPORTAR}`;
}

async function manejarResumen(chatId: number, userId: string, archivo: ArchivoMensaje | "no_soportado", caption: string) {
  if (archivo === "no_soportado") {
    await sendMessage(chatId, "Ese tipo de archivo no lo puedo leer. Mandame una foto, una captura o un PDF del resumen.");
    return;
  }

  const maxBytes = archivo.tipo === "pdf" ? MAX_PDF_BYTES : MAX_IMAGEN_BYTES;
  if (archivo.size && archivo.size > maxBytes) {
    await sendMessage(chatId, `Ese archivo es muy pesado (máximo ${maxBytes / 1024 / 1024} MB). Probá mandándolo en partes.`);
    return;
  }

  await sendMessage(chatId, "Dame un toque que leo el resumen…");

  const buffer = await descargarArchivo(archivo.fileId);
  if (!buffer || buffer.length > maxBytes) {
    await sendMessage(chatId, "No pude bajar el archivo, probá mandarlo de nuevo.");
    return;
  }

  const data = buffer.toString("base64");
  const adjunto: Adjunto = archivo.tipo === "pdf" ? { tipo: "pdf", data } : { tipo: "imagen", mediaType: archivo.mediaType, data };
  const resumen = await interpretarResumen(adjunto, caption);

  if (resumen.movimientos.length === 0) {
    await sendMessage(chatId, resumen.nota ?? "No encontré movimientos para cargar en eso.");
    return;
  }

  const { nuevos, repetidos } = await separarRepetidos(userId, resumen.movimientos);
  if (nuevos.length === 0) {
    await sendMessage(
      chatId,
      [`Los ${repetidos} movimientos de ese resumen ya estaban anotados, no hay nada nuevo para cargar.`, resumen.nota]
        .filter(Boolean)
        .join("\n\n"),
    );
    return;
  }

  const { data: importacion, error } = await supabaseAdmin
    .from("importaciones")
    .insert({ user_id: userId, movimientos: nuevos })
    .select("id")
    .single();
  if (error || !importacion) {
    console.error("Insert importacion error", error);
    await sendMessage(chatId, "Hubo un problema guardando lo que leí, probá de nuevo.");
    return;
  }

  await sendMessage(chatId, textoPreview(nuevos, repetidos, resumen.nota), [
    [
      { text: `Cargar ${nuevos.length}`, callback_data: `imp:si:${importacion.id}` },
      { text: "Cancelar", callback_data: `imp:no:${importacion.id}` },
    ],
  ]);
}

async function manejarCallback(cb: NonNullable<TelegramUpdate["callback_query"]>) {
  const match = cb.data?.match(/^imp:(si|no):([0-9a-f-]{36})$/);
  const mensaje = cb.message;
  if (!match || !mensaje) {
    await answerCallbackQuery(cb.id);
    return;
  }
  const [, decision, importacionId] = match;
  const chatId = mensaje.chat.id;
  const textoOriginal = (mensaje.text ?? "").replace(`\n\n${PREGUNTA_IMPORTAR}`, "");

  const userId = await usuarioDelChat(String(chatId));
  if (!userId) {
    await answerCallbackQuery(cb.id, "Este Telegram no está conectado a tu cuenta.");
    return;
  }

  // Pasa de "pendiente" al estado final en un solo update: si se toca el botón
  // dos veces (o Telegram reintenta), solo el primero encuentra la fila
  // pendiente y los movimientos no se cargan duplicados.
  const { data: importacion } = await supabaseAdmin
    .from("importaciones")
    .update({ estado: decision === "si" ? "confirmada" : "cancelada" })
    .eq("id", importacionId)
    .eq("user_id", userId)
    .eq("estado", "pendiente")
    .gte("created_at", new Date(Date.now() - IMPORTACION_VIGENCIA_MS).toISOString())
    .select("movimientos")
    .maybeSingle();

  if (!importacion) {
    await answerCallbackQuery(cb.id);
    await editMessageText(chatId, mensaje.message_id, `${textoOriginal}\n\nEsto ya se procesó o venció. Si querés, mandame el resumen de nuevo.`);
    return;
  }

  if (decision === "no") {
    await answerCallbackQuery(cb.id);
    await editMessageText(chatId, mensaje.message_id, `${textoOriginal}\n\nListo, no cargué nada.`);
    return;
  }

  const movimientos = importacion.movimientos as CamposMovimiento[];
  const { error } = await supabaseAdmin
    .from("movimientos")
    .insert(movimientos.map((m) => filaMovimiento(userId, m, "importado de un resumen por Telegram")));

  if (error) {
    console.error("Insert movimientos importados error", error);
    // Vuelve a pendiente para que el botón siga sirviendo.
    await supabaseAdmin.from("importaciones").update({ estado: "pendiente" }).eq("id", importacionId);
    await answerCallbackQuery(cb.id, "Hubo un problema cargando los movimientos, probá de nuevo.");
    return;
  }

  await answerCallbackQuery(cb.id, "Cargados");
  await editMessageText(
    chatId,
    mensaje.message_id,
    `${textoOriginal}\n\nListo, cargué ${movimientos.length} movimiento${movimientos.length === 1 ? "" : "s"}.`,
  );
}

async function cargarContexto(userId: string): Promise<ContextoBot> {
  const [{ data: movimientosRaw }, { data: ahorrosRaw }, { data: recordatoriosRaw }] = await Promise.all([
    supabaseAdmin
      .from("movimientos")
      .select("id, tipo, monto, categoria, descripcion, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabaseAdmin.from("ahorros").select("id, nombre, monto_actual, meta").eq("user_id", userId),
    supabaseAdmin
      .from("recordatorios")
      .select("id, nombre, monto, categoria, dia_vencimiento, periodo_actual, pagado, notificado_3dias, notificado_vencimiento")
      .eq("user_id", userId)
      .eq("activo", true),
  ]);

  const movimientos: ContextoMovimiento[] = (movimientosRaw ?? []).map((m) => ({
    id: m.id,
    tipo: m.tipo,
    monto: m.monto,
    categoria: m.categoria,
    descripcion: m.descripcion,
    hace: haceTiempo(m.created_at),
  }));

  const ahorros: ContextoAhorro[] = (ahorrosRaw ?? []).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    monto_actual: a.monto_actual,
    meta: a.meta,
  }));

  const { year, month } = hoyArgentina();
  const periodoActual = periodoKey(year, month);
  const recordatorios: ContextoRecordatorio[] = (recordatoriosRaw ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    monto: r.monto,
    categoria: r.categoria,
    dia_vencimiento: r.dia_vencimiento,
    pagado: estadoParaPeriodo(r, periodoActual).pagado,
  }));

  return { movimientos, ahorros, recordatorios };
}

async function calcularBalance(
  userId: string,
  desde?: string,
  hasta?: string,
): Promise<{ ingresos: number; gastos: number }> {
  let query = supabaseAdmin.from("movimientos").select("tipo, monto").eq("user_id", userId);
  if (desde) query = query.gte("created_at", inicioDiaArgentina(desde));
  if (hasta) query = query.lte("created_at", finDiaArgentina(hasta));
  const { data } = await query;
  let ingresos = 0;
  let gastos = 0;
  for (const m of data ?? []) {
    if (m.tipo === "ingreso") ingresos += m.monto;
    else gastos += m.monto;
  }
  return { ingresos, gastos };
}

async function listarMovimientosPeriodo(
  userId: string,
  tipo: Tipo | undefined,
  desde: string | undefined,
  hasta: string | undefined,
): Promise<ContextoMovimiento[]> {
  let query = supabaseAdmin
    .from("movimientos")
    .select("id, tipo, monto, categoria, descripcion, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (tipo) query = query.eq("tipo", tipo);
  if (desde) query = query.gte("created_at", inicioDiaArgentina(desde));
  if (hasta) query = query.lte("created_at", finDiaArgentina(hasta));
  const { data } = await query.limit(50);
  return (data ?? []).map((m) => ({
    id: m.id,
    tipo: m.tipo,
    monto: m.monto,
    categoria: m.categoria,
    descripcion: m.descripcion,
    hace: haceTiempo(m.created_at),
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (receivedSecret !== expectedSecret) {
      res.status(401).send("Unauthorized");
      return;
    }
  }

  const update = req.body as TelegramUpdate;

  // Botones de "Cargar" / "Cancelar" de una importación.
  if (update.callback_query) {
    try {
      await manejarCallback(update.callback_query);
    } catch (err) {
      console.error("Callback error", err);
      await answerCallbackQuery(update.callback_query.id, "Algo falló de mi lado, probá de nuevo.").catch(() => {});
    }
    res.status(200).send("OK");
    return;
  }

  const message = update.message;
  const archivo = message ? archivoDelMensaje(message) : null;

  // Ack rápido para updates que no nos interesan (ediciones, stickers, etc.)
  if (!message || (!message.text && !archivo)) {
    res.status(200).send("OK");
    return;
  }

  const chatId = message.chat.id;
  const chatIdStr = String(chatId);
  const texto = (message.text ?? message.caption ?? "").trim();

  try {
    // "/start" o "/start <codigo>" — el deep link de vinculacion desde
    // Configuracion en la app manda "/start <codigo>" como texto del mensaje.
    const startMatch = !archivo && texto.match(/^\/start(?:@\S+)?(?:\s+(\S+))?/);
    if (startMatch) {
      const codigo = startMatch[1];

      if (!codigo) {
        await sendMessage(
          chatId,
          `${WELCOME}\n\nPara conectar este Telegram con tu cuenta, entrá a la app, tocá tu perfil y en Configuración generá el link de conexión.`,
        );
        res.status(200).send("OK");
        return;
      }

      const { data: pendiente } = await supabaseAdmin
        .from("telegram_links")
        .select("id, user_id, link_code_expires_at")
        .eq("link_code", codigo)
        .maybeSingle();

      const vencido = pendiente?.link_code_expires_at && new Date(pendiente.link_code_expires_at) < new Date();
      if (!pendiente || vencido) {
        await sendMessage(
          chatId,
          "Ese código no es válido o venció. Volvé a Configuración en la app y generá uno nuevo.",
        );
        res.status(200).send("OK");
        return;
      }

      const { data: chatEnUso } = await supabaseAdmin
        .from("telegram_links")
        .select("user_id")
        .eq("chat_id", chatIdStr)
        .maybeSingle();

      if (chatEnUso && chatEnUso.user_id !== pendiente.user_id) {
        await sendMessage(chatId, "Este Telegram ya está conectado a otra cuenta de GasBot.");
        res.status(200).send("OK");
        return;
      }

      const { error: linkError } = await supabaseAdmin
        .from("telegram_links")
        .update({
          chat_id: chatIdStr,
          linked_at: new Date().toISOString(),
          link_code: null,
          link_code_expires_at: null,
        })
        .eq("id", pendiente.id);

      if (linkError) {
        console.error("Error vinculando telegram", linkError);
        await sendMessage(chatId, "Hubo un problema conectando tu cuenta, probá de nuevo.");
        res.status(200).send("OK");
        return;
      }

      await sendMessage(chatId, `${WELCOME}\n\n¡Listo! Tu cuenta quedó conectada.`);
      res.status(200).send("OK");
      return;
    }

    const targetUserId = await usuarioDelChat(chatIdStr);

    if (!targetUserId) {
      await sendMessage(
        chatId,
        "Todavía no conectaste este Telegram con tu cuenta de GasBot. Entrá a la app, tocá tu perfil y en Configuración conectá tu Telegram.",
      );
      res.status(200).send("OK");
      return;
    }

    // Rate limit: 20 mensajes por minuto por chat.
    const rateLimit = await checkRateLimit(chatIdStr);
    if (!rateLimit.allowed) {
      const segs = rateLimit.retryAfterSeconds ?? 60;
      await sendMessage(
        chatId,
        `Tranqui, estás mandando muchos mensajes muy rápido. Esperá ${segs} segundos y probá de nuevo.`,
      );
      res.status(200).send("OK");
      return;
    }

    if (archivo) {
      await manejarResumen(chatId, targetUserId, archivo, texto);
      res.status(200).send("OK");
      return;
    }

    const contexto = await cargarContexto(targetUserId);
    const accion = await interpretarMensaje(texto, contexto);

    switch (accion.accion) {
      case "no_entendido": {
        await sendMessage(
          chatId,
          "No entendí bien eso. Puedo anotar, corregir o borrar movimientos, manejar tus ahorros, contarte tu balance, o cargar todo un resumen si me mandás la captura o el PDF.",
        );
        break;
      }

      case "crear_movimientos": {
        if (accion.movimientos.length > 0) {
          const { error } = await supabaseAdmin
            .from("movimientos")
            .insert(accion.movimientos.map((m) => filaMovimiento(targetUserId, m, texto)));
          if (error) {
            console.error("Insert movimientos error", error);
            await sendMessage(chatId, "Hubo un problema guardando el movimiento, probá de nuevo.");
            break;
          }
        }

        const detalle = accion.movimientos
          .map(
            (m) =>
              `Anotado: $${formatMonto(m.monto)} - ${capitalize(m.descripcion)} (${capitalize(m.categoria)})${
                m.fecha ? ` · ${diaMes(m.fecha)}` : ""
              }`,
          )
          .join("\n");
        const respuesta = [detalle, accion.pregunta].filter(Boolean).join("\n\n");
        await sendMessage(chatId, respuesta);
        break;
      }

      case "pregunta": {
        await sendMessage(chatId, accion.texto);
        break;
      }

      case "editar_movimiento": {
        const { error } = await supabaseAdmin
          .from("movimientos")
          .update({
            tipo: accion.tipo,
            monto: accion.monto,
            categoria: accion.categoria,
            descripcion: accion.descripcion,
          })
          .eq("id", accion.id)
          .eq("user_id", targetUserId);
        if (error) {
          console.error("Update movimiento error", error);
          await sendMessage(chatId, "Hubo un problema corrigiendo el movimiento, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Corregido: $${formatMonto(accion.monto)} - ${capitalize(accion.descripcion)} (${capitalize(accion.categoria)})`,
        );
        break;
      }

      case "eliminar_movimiento": {
        const original = contexto.movimientos.find((m) => m.id === accion.id);
        const { error } = await supabaseAdmin
          .from("movimientos")
          .delete()
          .eq("id", accion.id)
          .eq("user_id", targetUserId);
        if (error) {
          console.error("Delete movimiento error", error);
          await sendMessage(chatId, "Hubo un problema borrando el movimiento, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          original
            ? `Borrado: $${formatMonto(original.monto)} - ${capitalize(original.descripcion ?? original.categoria)}`
            : "Borrado.",
        );
        break;
      }

      case "crear_ahorro": {
        const { error } = await supabaseAdmin.from("ahorros").insert({
          user_id: targetUserId,
          nombre: accion.nombre,
          monto_actual: accion.monto,
          meta: accion.meta ?? null,
        });
        if (error) {
          console.error("Insert ahorro error", error);
          await sendMessage(chatId, "Hubo un problema creando el ahorro, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Ahorro creado: ${capitalize(accion.nombre)} - $${formatMonto(accion.monto)}${
            accion.meta ? ` (meta: $${formatMonto(accion.meta)})` : ""
          }`,
        );
        break;
      }

      case "agregar_ahorro": {
        const ahorro = contexto.ahorros.find((a) => a.id === accion.id);
        if (!ahorro) {
          await sendMessage(chatId, "No encontré ese ahorro, probá de nuevo.");
          break;
        }
        const nuevoMonto = ahorro.monto_actual + accion.monto;
        const { error } = await supabaseAdmin
          .from("ahorros")
          .update({ monto_actual: nuevoMonto })
          .eq("id", accion.id)
          .eq("user_id", targetUserId);
        if (error) {
          console.error("Update ahorro error", error);
          await sendMessage(chatId, "Hubo un problema actualizando el ahorro, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Sumado $${formatMonto(accion.monto)} a ${capitalize(ahorro.nombre)}. Ahora tenés $${formatMonto(nuevoMonto)} ahorrados.`,
        );
        break;
      }

      case "restar_ahorro": {
        const ahorro = contexto.ahorros.find((a) => a.id === accion.id);
        if (!ahorro) {
          await sendMessage(chatId, "No encontré ese ahorro, probá de nuevo.");
          break;
        }
        if (accion.monto > ahorro.monto_actual) {
          await sendMessage(
            chatId,
            `En ${capitalize(ahorro.nombre)} solo tenés $${formatMonto(ahorro.monto_actual)}, no te puedo sacar $${formatMonto(accion.monto)}.`,
          );
          break;
        }
        const nuevoMonto = ahorro.monto_actual - accion.monto;
        const { error } = await supabaseAdmin
          .from("ahorros")
          .update({ monto_actual: nuevoMonto })
          .eq("id", accion.id)
          .eq("user_id", targetUserId);
        if (error) {
          console.error("Update ahorro error", error);
          await sendMessage(chatId, "Hubo un problema actualizando el ahorro, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Sacaste $${formatMonto(accion.monto)} de ${capitalize(ahorro.nombre)}. Ahora te quedan $${formatMonto(nuevoMonto)} ahorrados.`,
        );
        break;
      }

      case "eliminar_ahorro": {
        const ahorro = contexto.ahorros.find((a) => a.id === accion.id);
        const { error } = await supabaseAdmin.from("ahorros").delete().eq("id", accion.id).eq("user_id", targetUserId);
        if (error) {
          console.error("Delete ahorro error", error);
          await sendMessage(chatId, "Hubo un problema borrando el ahorro, probá de nuevo.");
          break;
        }
        await sendMessage(chatId, ahorro ? `Ahorro borrado: ${capitalize(ahorro.nombre)}` : "Ahorro borrado.");
        break;
      }

      case "consultar_balance": {
        const { ingresos, gastos } = await calcularBalance(targetUserId, accion.desde, accion.hasta);
        const balance = ingresos - gastos;
        const periodo = formatPeriodoLabel(accion.desde, accion.hasta);
        await sendMessage(
          chatId,
          `${periodo}Ingresos: $${formatMonto(ingresos)}\nGastos: $${formatMonto(gastos)}\nBalance: ${
            balance >= 0 ? "+" : "-"
          }$${formatMonto(Math.abs(balance))}`,
        );
        break;
      }

      case "consultar_ahorros": {
        if (contexto.ahorros.length === 0) {
          await sendMessage(chatId, "Todavía no tenés ahorros cargados.");
          break;
        }
        const total = contexto.ahorros.reduce((sum, a) => sum + a.monto_actual, 0);
        const detalle = contexto.ahorros
          .map((a) => `- ${capitalize(a.nombre)}: $${formatMonto(a.monto_actual)}${a.meta ? ` / $${formatMonto(a.meta)}` : ""}`)
          .join("\n");
        await sendMessage(chatId, `${detalle}\n\nTotal ahorrado: $${formatMonto(total)}`);
        break;
      }

      case "consultar_categorias": {
        await sendMessage(chatId, CATEGORIAS.map(capitalize).join(", "));
        break;
      }

      case "listar_movimientos": {
        const conFiltroPeriodo = Boolean(accion.desde || accion.hasta);
        const filtrados = conFiltroPeriodo
          ? await listarMovimientosPeriodo(targetUserId, accion.tipo, accion.desde, accion.hasta)
          : accion.tipo
            ? contexto.movimientos.filter((m) => m.tipo === accion.tipo)
            : contexto.movimientos;
        if (filtrados.length === 0) {
          await sendMessage(
            chatId,
            conFiltroPeriodo
              ? "No encontré movimientos para mostrarte en ese período."
              : "No encontré movimientos recientes para mostrarte.",
          );
          break;
        }
        const periodo = formatPeriodoLabel(accion.desde, accion.hasta);
        const mostrados = filtrados.slice(0, 20);
        const detalle = mostrados
          .map(
            (m) =>
              `- $${formatMonto(m.monto)} - ${capitalize(m.descripcion ?? m.categoria)} (${capitalize(m.categoria)}) - ${m.hace}`,
          )
          .join("\n");
        const nota = filtrados.length > mostrados.length ? `\n\n(mostrando los ${mostrados.length} más recientes)` : "";
        await sendMessage(chatId, `${periodo}${detalle}${nota}`);
        break;
      }

      case "crear_recordatorio": {
        const { error } = await supabaseAdmin.from("recordatorios").insert({
          user_id: targetUserId,
          nombre: accion.nombre,
          monto: accion.monto,
          categoria: accion.categoria,
          dia_vencimiento: accion.dia_vencimiento,
        });
        if (error) {
          console.error("Insert recordatorio error", error);
          await sendMessage(chatId, "Hubo un problema creando el recordatorio, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Recordatorio creado: ${capitalize(accion.nombre)} - $${formatMonto(accion.monto)}, vence el día ${accion.dia_vencimiento} de cada mes. Te aviso 3 días antes y el día del vencimiento.`,
        );
        break;
      }

      case "eliminar_recordatorio": {
        const recordatorio = contexto.recordatorios.find((r) => r.id === accion.id);
        const { error } = await supabaseAdmin
          .from("recordatorios")
          .delete()
          .eq("id", accion.id)
          .eq("user_id", targetUserId);
        if (error) {
          console.error("Delete recordatorio error", error);
          await sendMessage(chatId, "Hubo un problema borrando el recordatorio, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          recordatorio ? `Recordatorio borrado: ${capitalize(recordatorio.nombre)}` : "Recordatorio borrado.",
        );
        break;
      }

      case "marcar_pagado_recordatorio": {
        const recordatorio = contexto.recordatorios.find((r) => r.id === accion.id);
        if (!recordatorio) {
          await sendMessage(chatId, "No encontré ese recordatorio, probá de nuevo.");
          break;
        }
        if (!(await marcarPagado(supabaseAdmin, targetUserId, recordatorio, texto))) {
          await sendMessage(chatId, "Hubo un problema marcando el recordatorio como pagado, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Marcado como pagado: ${capitalize(recordatorio.nombre)} - $${formatMonto(recordatorio.monto)}. También lo anoté como gasto.`,
        );
        break;
      }

      case "desmarcar_pagado_recordatorio": {
        const recordatorio = contexto.recordatorios.find((r) => r.id === accion.id);
        if (!recordatorio) {
          await sendMessage(chatId, "No encontré ese recordatorio, probá de nuevo.");
          break;
        }
        if (!recordatorio.pagado) {
          await sendMessage(chatId, `${capitalize(recordatorio.nombre)} no figura como pagado este mes, no hay nada que desmarcar.`);
          break;
        }
        if (!(await desmarcarPagado(supabaseAdmin, targetUserId, recordatorio))) {
          await sendMessage(chatId, "Hubo un problema desmarcando el recordatorio, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Desmarcado: ${capitalize(recordatorio.nombre)} vuelve a pendiente este mes y borré el gasto que había anotado.`,
        );
        break;
      }

      case "listar_recordatorios": {
        if (contexto.recordatorios.length === 0) {
          await sendMessage(chatId, "Todavía no tenés recordatorios cargados.");
          break;
        }
        const detalleRecordatorios = contexto.recordatorios
          .map(
            (r) =>
              `- ${capitalize(r.nombre)}: $${formatMonto(r.monto)} (${capitalize(r.categoria)}) - día ${r.dia_vencimiento} - ${
                r.pagado ? "pagado este mes" : "pendiente"
              }`,
          )
          .join("\n");
        await sendMessage(chatId, detalleRecordatorios);
        break;
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error", err);
    await sendMessage(chatId, "Algo falló de mi lado, probá de nuevo en un rato.").catch(() => {});
    res.status(200).send("OK");
  }
}
