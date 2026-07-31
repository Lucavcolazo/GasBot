// Helpers de fecha/periodo compartidos entre el webhook (para mostrar el
// estado de los recordatorios y marcarlos pagados) y el cron de notificaciones
// (api/cron/recordatorios.ts). Todo se calcula en huso horario de Argentina,
// ya que las funciones serverless corren en UTC.

const TIMEZONE = "America/Argentina/Buenos_Aires";

export interface FechaArgentina {
  year: number;
  month: number; // 1-12
  day: number;
}

export function hoyArgentina(): FechaArgentina {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export function periodoKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function ultimoDiaDelMes(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// Si el dia de vencimiento configurado no existe en el mes actual (ej. 31 en
// febrero), usamos el ultimo dia del mes.
export function diaVencimientoEfectivo(diaVencimiento: number, year: number, month: number): number {
  return Math.min(diaVencimiento, ultimoDiaDelMes(year, month));
}

export interface EstadoRecordatorio {
  periodo_actual: string | null;
  pagado: boolean;
  notificado_3dias: boolean;
  notificado_vencimiento: boolean;
}

// El estado de pagado/notificado guardado en la fila corresponde a
// "periodo_actual". Si ese periodo no es el mes actual, todavia no se
// persistio el reset del nuevo mes, pero el estado real ya es "sin pagar/sin
// notificar" para este periodo.
export function estadoParaPeriodo(
  r: EstadoRecordatorio,
  periodoActual: string,
): { pagado: boolean; notificado_3dias: boolean; notificado_vencimiento: boolean } {
  if (r.periodo_actual === periodoActual) {
    return { pagado: r.pagado, notificado_3dias: r.notificado_3dias, notificado_vencimiento: r.notificado_vencimiento };
  }
  return { pagado: false, notificado_3dias: false, notificado_vencimiento: false };
}
