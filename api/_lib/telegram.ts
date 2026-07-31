const TELEGRAM_API = "https://api.telegram.org";

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  return token;
}

export async function sendMessage(chatId: number | string, text: string): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Telegram sendMessage failed", res.status, body);
  }
}

export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

let cachedBotUsername: string | null = null;

// Username del bot (sin el @), para armar el deep link de vinculacion
// (t.me/<username>?start=<codigo>). Se pide una sola vez a la API de
// Telegram y se cachea en memoria mientras la funcion serverless siga
// "caliente".
export async function getBotUsername(): Promise<string> {
  if (cachedBotUsername) return cachedBotUsername;

  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/getMe`);
  const body = (await res.json()) as { ok: boolean; result?: { username?: string } };

  if (!res.ok || !body.ok || !body.result?.username) {
    throw new Error("No se pudo obtener el username del bot de Telegram (getMe)");
  }

  cachedBotUsername = body.result.username;
  return cachedBotUsername;
}
