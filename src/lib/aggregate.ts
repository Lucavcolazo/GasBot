import type { Movimiento } from "../../shared/types.ts";

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

export function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10); // "YYYY-MM-DD"
}

// Lunes de la semana que contiene la fecha, como clave "YYYY-MM-DD".
export function weekKey(isoDate: string): string {
  const d = new Date(isoDate);
  const diffToMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMonday);
  return monday.toISOString().slice(0, 10);
}

export const PERIODOS = ["dia", "semana", "mes"] as const;
export type Periodo = (typeof PERIODOS)[number];

export function periodKey(isoDate: string, periodo: Periodo): string {
  if (periodo === "dia") return dayKey(isoDate);
  if (periodo === "semana") return weekKey(isoDate);
  return monthKey(isoDate);
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

// "$+225.000" / "$-140.000": el signo va pegado despues del simbolo de moneda,
// no antes (a diferencia del formato negativo por defecto de Intl).
export function formatSignedCurrency(n: number, sign: "+" | "-" | "" = ""): string {
  const amount = Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  return `$${sign}${amount}`;
}

// Version corta para ejes de graficos (ej. "$95k" en vez de "$ 95.000"),
// asi las marcas entran en una sola linea en pantallas angostas.
export function formatCompactCurrency(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs >= 1_000_000) {
    const millones = abs / 1_000_000;
    return `${sign}$${millones % 1 === 0 ? millones : millones.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${Math.round(abs / 1000)}k`;
  }
  return `${sign}$${abs}`;
}

export function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
  });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export function formatPeriodShortLabel(key: string, periodo: Periodo): string {
  if (periodo === "mes") return formatMonthLabel(key);
  const [year, month, day] = key.split("-").map(Number);
  return formatShortDate(new Date(year, month - 1, day));
}

export interface CategoriaTotal {
  categoria: string;
  total: number;
}

export function groupByCategoria(movimientos: Movimiento[], tipo: "gasto" | "ingreso"): CategoriaTotal[] {
  const totals = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== tipo) continue;
    totals.set(m.categoria, (totals.get(m.categoria) ?? 0) + m.monto);
  }
  return [...totals.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

export interface PeriodTotal {
  key: string;
  label: string;
  ingresos: number;
  gastos: number;
}

export function groupByPeriod(movimientos: Movimiento[], periodo: Periodo, count = 6): PeriodTotal[] {
  const totals = new Map<string, { ingresos: number; gastos: number }>();
  for (const m of movimientos) {
    const key = periodKey(m.created_at, periodo);
    const entry = totals.get(key) ?? { ingresos: 0, gastos: 0 };
    if (m.tipo === "ingreso") entry.ingresos += m.monto;
    else entry.gastos += m.monto;
    totals.set(key, entry);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-count)
    .map(([key, { ingresos, gastos }]) => ({
      key,
      label: formatPeriodShortLabel(key, periodo),
      ingresos,
      gastos,
    }));
}
