import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendMessage } from "../_lib/telegram.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { capitalize, formatMonto } from "../_lib/format.js";
import { diaVencimientoEfectivo, estadoParaPeriodo, hoyArgentina, periodoKey } from "../../shared/recordatorios.js";

// Corre una vez por día (ver vercel.json) y avisa por Telegram los
// recordatorios de gastos fijos que vencen en 3 días o que vencen hoy.
// El estado de pagado/notificado de cada recordatorio se resetea solo cuando
// cambia el periodo (mes) actual respecto al guardado en la fila.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).send("Unauthorized");
      return;
    }
  }

  const targetUserId = process.env.TELEGRAM_USER_ID;
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (!targetUserId || !chatId) {
    res.status(200).send("Falta configurar TELEGRAM_USER_ID o TELEGRAM_ALLOWED_CHAT_ID");
    return;
  }

  const { year, month, day } = hoyArgentina();
  const periodoActual = periodoKey(year, month);

  const { data: recordatorios, error } = await supabaseAdmin
    .from("recordatorios")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("activo", true);

  if (error) {
    console.error("Error leyendo recordatorios", error);
    res.status(500).send("Error leyendo recordatorios");
    return;
  }

  for (const r of recordatorios ?? []) {
    const estado = estadoParaPeriodo(r, periodoActual);
    if (estado.pagado) {
      if (r.periodo_actual !== periodoActual) {
        await supabaseAdmin
          .from("recordatorios")
          .update({ periodo_actual: periodoActual, pagado: false, notificado_3dias: false, notificado_vencimiento: false })
          .eq("id", r.id);
      }
      continue;
    }

    const diaVenc = diaVencimientoEfectivo(r.dia_vencimiento, year, month);
    const diasRestantes = diaVenc - day;

    let notificado3dias = estado.notificado_3dias;
    let notificadoVencimiento = estado.notificado_vencimiento;

    if (diasRestantes === 3 && !notificado3dias) {
      await sendMessage(
        chatId,
        `En 3 días vence el pago de ${capitalize(r.nombre)} ($${formatMonto(r.monto)}).`,
      ).catch((err) => console.error("Error enviando aviso 3 días", err));
      notificado3dias = true;
    }

    if (diasRestantes === 0 && !notificadoVencimiento) {
      await sendMessage(
        chatId,
        `Hoy vence el pago de ${capitalize(r.nombre)} ($${formatMonto(r.monto)}).`,
      ).catch((err) => console.error("Error enviando aviso de vencimiento", err));
      notificadoVencimiento = true;
    }

    if (
      r.periodo_actual !== periodoActual ||
      notificado3dias !== r.notificado_3dias ||
      notificadoVencimiento !== r.notificado_vencimiento
    ) {
      await supabaseAdmin
        .from("recordatorios")
        .update({
          periodo_actual: periodoActual,
          pagado: false,
          notificado_3dias: notificado3dias,
          notificado_vencimiento: notificadoVencimiento,
        })
        .eq("id", r.id);
    }
  }

  res.status(200).send("OK");
}
