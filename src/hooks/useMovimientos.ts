import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import type { Movimiento } from "../../shared/types.ts";

interface UseMovimientosResult {
  movimientos: Movimiento[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMovimientos(): UseMovimientosResult {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Solo mostramos el skeleton en la carga inicial: un refresh despues de
      // guardar/borrar un movimiento no debe re-renderizar toda la pantalla,
      // solo los numeros y graficos que cambiaron.
      if (!hasLoadedOnce.current) setLoading(true);

      const { data, error: dbError } = await supabase
        .from("movimientos")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (dbError) {
        setError(dbError.message);
      } else {
        setError(null);
        setMovimientos((data ?? []) as Movimiento[]);
      }
      hasLoadedOnce.current = true;
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return { movimientos, loading, error, refresh };
}
