import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import type { Ahorro } from "../../shared/types.ts";

interface UseAhorrosResult {
  ahorros: Ahorro[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAhorros(): UseAhorrosResult {
  const [ahorros, setAhorros] = useState<Ahorro[]>([]);
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
        .from("ahorros")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (dbError) {
        setError(dbError.message);
      } else {
        setError(null);
        setAhorros((data ?? []) as Ahorro[]);
      }
      hasLoadedOnce.current = true;
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { ahorros, loading, error, refresh };
}
