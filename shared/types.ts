import type { Categoria, Moneda, Tipo } from "./categories.js";

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

export interface Recordatorio {
  id: string;
  user_id: string;
  nombre: string;
  monto: number;
  categoria: Categoria;
  dia_vencimiento: number;
  activo: boolean;
  periodo_actual: string | null;
  pagado: boolean;
  notificado_3dias: boolean;
  notificado_vencimiento: boolean;
  created_at: string;
}

// Acciones que el bot de Telegram puede reconocer en un mensaje de texto.
// Para editar/eliminar/agregar_ahorro, el "id" tiene que ser uno de los que
// se le pasaron en el contexto (movimientos/ahorros recientes) — nunca se
// confia en un id inventado por el modelo.
export type AccionBot =
  | { accion: "crear_movimiento"; tipo: Tipo; monto: number; categoria: Categoria; descripcion: string }
  | { accion: "editar_movimiento"; id: string; tipo: Tipo; monto: number; categoria: Categoria; descripcion: string }
  | { accion: "eliminar_movimiento"; id: string }
  | { accion: "crear_ahorro"; nombre: string; monto: number; meta?: number }
  | { accion: "agregar_ahorro"; id: string; monto: number }
  | { accion: "restar_ahorro"; id: string; monto: number }
  | { accion: "eliminar_ahorro"; id: string }
  | { accion: "consultar_balance" }
  | { accion: "consultar_ahorros" }
  | { accion: "consultar_categorias" }
  | { accion: "listar_movimientos"; tipo?: Tipo }
  | { accion: "crear_recordatorio"; nombre: string; monto: number; categoria: Categoria; dia_vencimiento: number }
  | { accion: "eliminar_recordatorio"; id: string }
  | { accion: "marcar_pagado_recordatorio"; id: string }
  | { accion: "listar_recordatorios" }
  | { accion: "no_entendido" };

export interface ContextoMovimiento {
  id: string;
  tipo: Tipo;
  monto: number;
  categoria: Categoria;
  descripcion: string | null;
  hace: string;
}

export interface ContextoAhorro {
  id: string;
  nombre: string;
  monto_actual: number;
  meta: number | null;
}

export interface ContextoRecordatorio {
  id: string;
  nombre: string;
  monto: number;
  categoria: Categoria;
  dia_vencimiento: number;
  pagado: boolean;
}

export interface ContextoBot {
  movimientos: ContextoMovimiento[];
  ahorros: ContextoAhorro[];
  recordatorios: ContextoRecordatorio[];
}
