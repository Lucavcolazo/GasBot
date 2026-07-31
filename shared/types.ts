import type { Categoria, Moneda, Tipo } from "./categories.ts";

export interface Movimiento {
  id: string;
  user_id: string;
  tipo: Tipo;
  monto: number;
  moneda: Moneda;
  categoria: Categoria;
  descripcion: string | null;
  mensaje_original: string | null;
  created_at: string;
}

export interface Ahorro {
  id: string;
  user_id: string;
  nombre: string;
  monto_actual: number;
  meta: number | null;
  created_at: string;
}

export type ParsedMovimiento =
  | {
      tipo: Tipo;
      monto: number;
      categoria: Categoria;
      descripcion: string;
    }
  | { error: "no_parseable" };
