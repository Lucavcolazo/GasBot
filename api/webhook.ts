import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendMessage, type TelegramUpdate } from "./_lib/telegram.js";
import { interpretarMensaje } from "./_lib/claudeParser.js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { CATEGORIAS } from "../shared/categories.js";
import type { ContextoAhorro, ContextoBot, ContextoMovimiento } from "../shared/types.js";

const WELCOME = `Hola. Soy GasBot.

Contame tus gastos e ingresos como si se lo dijeras a un amigo, por ejemplo:
- "gasté 5000 en nafta"
- "cobré 80000 de sueldo"
- "pagué 3200 de streaming"

También puedo corregir o borrar algo que ya anotaste, manejar tus ahorros
("guardé 5000 más para el auto", "quiero ahorrar para un celu, ya tengo 20000")
y contarte tu balance o cómo van tus ahorros.`;

function formatMonto(monto: number): string {
  return monto.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function haceTiempo(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

async function cargarContexto(userId: string): Promise<ContextoBot> {
  const [{ data: movimientosRaw }, { data: ahorrosRaw }] = await Promise.all([
    supabaseAdmin
      .from("movimientos")
      .select("id, tipo, monto, categoria, descripcion, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabaseAdmin.from("ahorros").select("id, nombre, monto_actual, meta").eq("user_id", userId),
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

  return { movimientos, ahorros };
}

async function calcularBalance(userId: string): Promise<{ ingresos: number; gastos: number }> {
  const { data } = await supabaseAdmin.from("movimientos").select("tipo, monto").eq("user_id", userId);
  let ingresos = 0;
  let gastos = 0;
  for (const m of data ?? []) {
    if (m.tipo === "ingreso") ingresos += m.monto;
    else gastos += m.monto;
  }
  return { ingresos, gastos };
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
  const message = update.message;

  // Ack rápido para updates que no nos interesan (ediciones, callbacks, etc.)
  if (!message?.text) {
    res.status(200).send("OK");
    return;
  }

  const chatId = message.chat.id;
  const texto = message.text.trim();

  // Bot privado: solo procesamos mensajes del chat_id configurado. Cualquier
  // otro chat recibe su propio chat_id para que, si sos vos, lo puedas
  // cargar en TELEGRAM_ALLOWED_CHAT_ID.
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (allowedChatId && String(chatId) !== allowedChatId) {
    await sendMessage(chatId, `Este bot es privado.\n\nTu chat id es: ${chatId}`).catch(() => {});
    res.status(200).send("OK");
    return;
  }

  try {
    if (texto.startsWith("/start")) {
      await sendMessage(chatId, `${WELCOME}\n\nTu chat id es: ${chatId}`);
      res.status(200).send("OK");
      return;
    }

    const targetUserId = process.env.TELEGRAM_USER_ID;
    if (!targetUserId) {
      await sendMessage(chatId, "Falta configurar TELEGRAM_USER_ID en el servidor para poder guardar movimientos.");
      res.status(200).send("OK");
      return;
    }

    const contexto = await cargarContexto(targetUserId);
    const accion = await interpretarMensaje(texto, contexto);

    switch (accion.accion) {
      case "no_entendido": {
        await sendMessage(
          chatId,
          "No entendí bien eso. Puedo anotar, corregir o borrar movimientos, manejar tus ahorros, o contarte tu balance.",
        );
        break;
      }

      case "crear_movimiento": {
        const { error } = await supabaseAdmin.from("movimientos").insert({
          user_id: targetUserId,
          tipo: accion.tipo,
          monto: accion.monto,
          categoria: accion.categoria,
          descripcion: accion.descripcion,
          mensaje_original: texto,
        });
        if (error) {
          console.error("Insert movimiento error", error);
          await sendMessage(chatId, "Hubo un problema guardando el movimiento, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Anotado: $${formatMonto(accion.monto)} - ${capitalize(accion.descripcion)} (${capitalize(accion.categoria)})`,
        );
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
        const { ingresos, gastos } = await calcularBalance(targetUserId);
        const balance = ingresos - gastos;
        await sendMessage(
          chatId,
          `Ingresos: $${formatMonto(ingresos)}\nGastos: $${formatMonto(gastos)}\nBalance: ${
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
        const filtrados = accion.tipo
          ? contexto.movimientos.filter((m) => m.tipo === accion.tipo)
          : contexto.movimientos;
        if (filtrados.length === 0) {
          await sendMessage(chatId, "No encontré movimientos recientes para mostrarte.");
          break;
        }
        const detalle = filtrados
          .slice(0, 10)
          .map(
            (m) =>
              `- $${formatMonto(m.monto)} - ${capitalize(m.descripcion ?? m.categoria)} (${capitalize(m.categoria)}) - ${m.hace}`,
          )
          .join("\n");
        await sendMessage(chatId, detalle);
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
