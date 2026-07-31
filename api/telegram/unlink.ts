import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { getUserIdFromRequest } from "../_lib/auth.js";

// POST /api/telegram/unlink — desconecta el Telegram vinculado a la cuenta
// logueada. No borra la fila (para no perder el historial de vinculacion),
// solo limpia chat_id/linked_at y cualquier codigo pendiente.
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

  const { error } = await supabaseAdmin
    .from("telegram_links")
    .update({ chat_id: null, linked_at: null, link_code: null, link_code_expires_at: null })
    .eq("user_id", userId);

  if (error) {
    console.error("Error desvinculando telegram", error);
    res.status(500).json({ error: "No se pudo desconectar, probá de nuevo." });
    return;
  }

  res.status(200).json({ ok: true });
}
