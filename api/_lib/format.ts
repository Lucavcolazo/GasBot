export function formatMonto(monto: number): string {
  return monto.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
