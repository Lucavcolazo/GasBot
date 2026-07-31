export const CATEGORIAS = [
  "comida",
  "transporte",
  "servicios",
  "entretenimiento",
  "salud",
  "indumentaria",
  "hogar",
  "sueldo",
  "otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const TIPOS = ["gasto", "ingreso"] as const;

export type Tipo = (typeof TIPOS)[number];

export const MONEDAS = ["ARS", "USD"] as const;

export type Moneda = (typeof MONEDAS)[number];

export function isCategoria(value: unknown): value is Categoria {
  return typeof value === "string" && (CATEGORIAS as readonly string[]).includes(value);
}

export function isTipo(value: unknown): value is Tipo {
  return typeof value === "string" && (TIPOS as readonly string[]).includes(value);
}

export function isMoneda(value: unknown): value is Moneda {
  return typeof value === "string" && (MONEDAS as readonly string[]).includes(value);
}
