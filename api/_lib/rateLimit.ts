import { supabaseAdmin } from "./supabaseAdmin.js";

// Ventana de rate limit: 60 segundos, 20 mensajes por ventana.
const WINDOW_SECONDS = 60;
const MAX_MESSAGES = 20;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number | null;
}

/**
 * Verifica y registra un mensaje para rate limiting.
 * Usa la función SQL `check_rate_limit` que hace el check + insert
 * de forma atómica en una sola query.
 */
export async function checkRateLimit(chatId: string): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_chat_id: chatId,
    p_window_seconds: WINDOW_SECONDS,
    p_max_messages: MAX_MESSAGES,
  });

  if (error) {
    // Si la función no existe o hay error, dejamos pasar para no bloquear
    // al usuario por un problema nuestro.
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: MAX_MESSAGES, retryAfterSeconds: null };
  }

  const result = data as { allowed: boolean; current_count: number; retry_after_seconds: number | null };

  return {
    allowed: result.allowed,
    remaining: Math.max(0, MAX_MESSAGES - result.current_count),
    retryAfterSeconds: result.retry_after_seconds,
  };
}
