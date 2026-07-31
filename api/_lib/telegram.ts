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
