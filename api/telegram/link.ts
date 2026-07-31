import { randomInt } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { getUserIdFromRequest } from "../_lib/auth.js";
import { getBotUsername } from "../_lib/telegram.js";

const CODE_LENGTH = 8;
// Sin 0/O/1/I/L para que no se confundan si alguien lo escribe a mano en vez
// de tocar el deep link.
const CODE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_TTL_MINUTES = 15;

function generarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    codigo += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return codigo;
}

// POST /api/telegram/link — genera (o regenera) un codigo de un solo uso para
// que el usuario logueado vincule su Telegram. El frontend arma con la
// respuesta un deep link t.me/<bot>?start=<codigo> (ver api/webhook.ts, que
// procesa el "/start <codigo>" y hace el vinculo real).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  const codigo = generarCodigo();
  const expiraEn = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  const { error } = await supabaseAdmin.from("telegram_links").upsert(
    {
      user_id: userId,
      link_code: codigo,
      link_code_expires_at: expiraEn,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Error generando codigo de vinculacion", error);
    res.status(500).json({ error: "No se pudo generar el código, probá de nuevo." });
    return;
  }

  let botUsername: string;
  try {
    botUsername = await getBotUsername();
  } catch (err) {
    console.error("Error obteniendo username del bot", err);
    res.status(500).json({ error: "No se pudo contactar a Telegram, probá de nuevo." });
    return;
  }

  res.status(200).json({
    code: codigo,
    expiresAt: expiraEn,
    botUsername,
    deepLink: `https://t.me/${botUsername}?start=${codigo}`,
  });
}
