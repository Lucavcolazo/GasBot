import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import type { Recordatorio } from "../../shared/types.ts";

interface UseRecordatoriosResult {
  recordatorios: Recordatorio[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRecordatorios(): UseRecordatoriosResult {
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasLoadedOnce.current) setLoading(true);

      const { data, error: dbError } = await supabase
        .from("recordatorios")
        .select("*")
        .eq("activo", true)
        .order("dia_vencimiento", { ascending: true });

      if (cancelled) return;

      if (dbError) {
        setError(dbError.message);
      } else {
        setError(null);
        setRecordatorios((data ?? []) as Recordatorio[]);
      }
      hasLoadedOnce.current = true;
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { recordatorios, loading, error, refresh };
}
