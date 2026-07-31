import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import type { TelegramLink } from "../../shared/types.ts";

interface LinkInfo {
  code: string;
  expiresAt: string;
  botUsername: string;
  deepLink: string;
}

interface UseTelegramLinkResult {
  loading: boolean;
  linked: boolean;
  linkedAt: string | null;
  linkInfo: LinkInfo | null;
  error: string | null;
  generating: boolean;
  generateLink: () => Promise<void>;
  unlink: () => Promise<void>;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60_000;

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No hay sesión activa.");
  return { Authorization: `Bearer ${token}` };
}

export function useTelegramLink(): UseTelegramLinkResult {
  const [row, setRow] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRow = useCallback(async (): Promise<TelegramLink | null> => {
    const { data, error: dbError } = await supabase.from("telegram_links").select("*").maybeSingle();
    if (dbError) throw new Error(dbError.message);
    return (data as TelegramLink | null) ?? null;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRow()
      .then((data) => {
        if (cancelled) return;
        setRow(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error desconocido.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchRow]);

  useEffect(() => stopPolling, [stopPolling]);

  async function generateLink() {
    setGenerating(true);
    setError(null);
    stopPolling();
    try {
      const headers = await authHeader();
      const res = await fetch("/api/telegram/link", { method: "POST", headers });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo generar el código.");
      setLinkInfo(body as LinkInfo);

      const startedAt = Date.now();
      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
          return;
        }
        try {
          const data = await fetchRow();
          if (data?.chat_id) {
            setRow(data);
            setLinkInfo(null);
            stopPolling();
          }
        } catch {
          // silencioso: reintenta en el proximo tick
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setGenerating(false);
    }
  }

  async function unlink() {
    setError(null);
    stopPolling();
    try {
      const headers = await authHeader();
      const res = await fetch("/api/telegram/unlink", { method: "POST", headers });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo desconectar.");
      setLinkInfo(null);
      setRow((prev) => (prev ? { ...prev, chat_id: null, linked_at: null } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    }
  }

  return {
    loading,
    linked: !!row?.chat_id,
    linkedAt: row?.linked_at ?? null,
    linkInfo,
    error,
    generating,
    generateLink,
    unlink,
  };
}
