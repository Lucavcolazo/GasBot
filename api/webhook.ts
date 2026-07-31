import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendMessage, type TelegramUpdate } from "./_lib/telegram.js";
import { interpretarMensaje } from "./_lib/claudeParser.js";
import { supabaseAdmin } from "./_lib/supabaseAdmin.js";
import { CATEGORIAS } from "../shared/categories.js";
import type { ContextoAhorro, ContextoBot, ContextoMovimiento, ContextoRecordatorio } from "../shared/types.js";
import { estadoParaPeriodo, hoyArgentina, periodoKey } from "../shared/recordatorios.js";
import { capitalize, formatMonto } from "./_lib/format.js";

const WELCOME = `Hola. Soy GasBot.

Contame tus gastos e ingresos como si se lo dijeras a un amigo, por ejemplo:
- "gasté 5000 en nafta"
- "cobré 80000 de sueldo"
- "pagué 3200 de streaming"

También puedo corregir o borrar algo que ya anotaste, manejar tus ahorros
("guardé 5000 más para el auto", "quiero ahorrar para un celu, ya tengo 20000"),
tus gastos fijos ("recordame el alquiler el día 10, son 150000", "ya pagué el alquiler")
y contarte tu balance o cómo van tus ahorros.`;

function haceTiempo(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
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
  const chatIdStr = String(chatId);
  const texto = message.text.trim();

  try {
    // "/start" o "/start <codigo>" — el deep link de vinculacion desde
    // Configuracion en la app manda "/start <codigo>" como texto del mensaje.
    const startMatch = texto.match(/^\/start(?:@\S+)?(?:\s+(\S+))?/);
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

    const { data: vinculo } = await supabaseAdmin
      .from("telegram_links")
      .select("user_id")
      .eq("chat_id", chatIdStr)
      .maybeSingle();

    if (!vinculo) {
      await sendMessage(
        chatId,
        "Todavía no conectaste este Telegram con tu cuenta de GasBot. Entrá a la app, tocá tu perfil y en Configuración conectá tu Telegram.",
      );
      res.status(200).send("OK");
      return;
    }

    const targetUserId = vinculo.user_id;
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
        const { year, month } = hoyArgentina();
        const periodoActual = periodoKey(year, month);
        const [{ error: updateError }, { error: insertError }] = await Promise.all([
          supabaseAdmin
            .from("recordatorios")
            .update({
              periodo_actual: periodoActual,
              pagado: true,
              notificado_3dias: false,
              notificado_vencimiento: false,
            })
            .eq("id", accion.id)
            .eq("user_id", targetUserId),
          supabaseAdmin.from("movimientos").insert({
            user_id: targetUserId,
            tipo: "gasto",
            monto: recordatorio.monto,
            categoria: recordatorio.categoria,
            descripcion: recordatorio.nombre,
            mensaje_original: texto,
          }),
        ]);
        if (updateError || insertError) {
          console.error("Marcar pagado recordatorio error", updateError ?? insertError);
          await sendMessage(chatId, "Hubo un problema marcando el recordatorio como pagado, probá de nuevo.");
          break;
        }
        await sendMessage(
          chatId,
          `Marcado como pagado: ${capitalize(recordatorio.nombre)} - $${formatMonto(recordatorio.monto)}. También lo anoté como gasto.`,
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
