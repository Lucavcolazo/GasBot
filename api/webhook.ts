import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendMessage, type TelegramUpdate } from "./_lib/telegram.ts";
import { parseMensaje } from "./_lib/claudeParser.ts";
import { supabaseAdmin } from "./_lib/supabaseAdmin.ts";

const WELCOME = `Hola. Soy GasBot.

Contame tus gastos e ingresos como si se lo dijeras a un amigo, por ejemplo:
- "gasté 5000 en nafta"
- "cobré 80000 de sueldo"
- "pagué 3200 de streaming"

Yo me encargo de categorizarlo y guardarlo.`;

function formatMonto(monto: number): string {
  return monto.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

  try {
    if (texto.startsWith("/start")) {
      await sendMessage(chatId, WELCOME);
      res.status(200).send("OK");
      return;
    }

    const parsed = await parseMensaje(texto);

    if ("error" in parsed) {
      await sendMessage(
        chatId,
        "No entendí eso como gasto o ingreso. Probá algo como \"gasté 5000 en nafta\".",
      );
      res.status(200).send("OK");
      return;
    }

    const { error: dbError } = await supabaseAdmin.from("movimientos").insert({
      user_id: String(chatId),
      tipo: parsed.tipo,
      monto: parsed.monto,
      categoria: parsed.categoria,
      descripcion: parsed.descripcion,
      mensaje_original: texto,
    });

    if (dbError) {
      console.error("Supabase insert error", dbError);
      await sendMessage(chatId, "Hubo un problema guardando el movimiento, probá de nuevo.");
      res.status(200).send("OK");
      return;
    }

    await sendMessage(
      chatId,
      `Anotado: $${formatMonto(parsed.monto)} - ${capitalize(parsed.descripcion)} (${capitalize(parsed.categoria)})`,
    );
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook error", err);
    await sendMessage(chatId, "Algo falló de mi lado, probá de nuevo en un rato.").catch(() => {});
    res.status(200).send("OK");
  }
}
