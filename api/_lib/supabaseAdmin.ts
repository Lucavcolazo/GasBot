import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

// Cliente con service role: corre solo en el backend (api/), nunca en el
// frontend. Bypassea RLS a propósito para poder insertar movimientos de
// cualquier chat_id de Telegram sin necesitar auth de usuario.
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
