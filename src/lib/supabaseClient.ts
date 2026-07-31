import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !anonKey) {
  throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY (ver .env)");
}

export const supabase = createClient(url, anonKey);
