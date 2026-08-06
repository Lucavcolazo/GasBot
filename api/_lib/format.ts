export function formatMonto(monto: number): string {
  return monto.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatFecha(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPeriodoLabel(desde?: string, hasta?: string): string {
  if (desde && hasta) return `Del ${formatFecha(desde)} al ${formatFecha(hasta)}:\n`;
  if (desde) return `Desde el ${formatFecha(desde)}:\n`;
  if (hasta) return `Hasta el ${formatFecha(hasta)}:\n`;
  return "";
}
