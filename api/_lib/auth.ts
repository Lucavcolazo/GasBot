import type { VercelRequest } from "@vercel/node";
import { supabaseAdmin } from "./supabaseAdmin.js";

// Valida el JWT que manda el frontend en "Authorization: Bearer <token>"
// (la sesion de Supabase Auth del usuario logueado) y devuelve su user id.
// Se usa en los endpoints de vinculacion de Telegram (api/telegram/*), donde
// necesitamos saber a que cuenta pertenece el pedido sin confiar en nada que
// mande el cliente aparte del token.
export async function getUserIdFromRequest(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user.id;
}
