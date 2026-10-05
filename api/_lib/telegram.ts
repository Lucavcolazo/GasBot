const TELEGRAM_API = "https://api.telegram.org";

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  return token;
}

async function llamarTelegram(metodo: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/${metodo}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Telegram ${metodo} failed`, res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { result?: unknown };
  return json.result ?? null;
}

export interface BotonInline {
  text: string;
  callback_data: string;
}

export async function sendMessage(chatId: number | string, text: string, botones?: BotonInline[][]): Promise<void> {
  await llamarTelegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}),
  });
}

// Reemplaza el texto de un mensaje del bot. Sin "botones" se van los que tenía.
export async function editMessageText(chatId: number | string, messageId: number, text: string): Promise<void> {
  await llamarTelegram("editMessageText", { chat_id: chatId, message_id: messageId, text });
}

// Hay que responder siempre a un callback_query, si no el botón queda con el
// relojito girando en Telegram.
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await llamarTelegram("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

// Baja un archivo que mandaron al chat (foto o documento). La Bot API solo
// deja bajar archivos de hasta 20 MB.
export async function descargarArchivo(fileId: string): Promise<Buffer | null> {
  const archivo = (await llamarTelegram("getFile", { file_id: fileId })) as { file_path?: string } | null;
  if (!archivo?.file_path) return null;

  const res = await fetch(`${TELEGRAM_API}/file/bot${botToken()}/${archivo.file_path}`);
  if (!res.ok) {
    console.error("Telegram file download failed", res.status);
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

export interface TelegramPhotoSize {
  file_id: string;
  file_size?: number;
  width: number;
  height: number;
}

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
    document?: TelegramDocument;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number }; text?: string };
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
