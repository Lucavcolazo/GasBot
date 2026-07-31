import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
// Acepta tanto el nombre nuevo de Supabase (secret key) como el legacy
// (service role key), segun que tipo de API keys tenga el proyecto.
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secretKey) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY");
}

// Cliente con la secret/service-role key: corre solo en el backend (api/),
// nunca en el frontend. Bypassea RLS a propósito para poder insertar
// movimientos del bot de Telegram sin necesitar auth de usuario.
export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false },
});
