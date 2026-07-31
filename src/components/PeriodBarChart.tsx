import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { groupByPeriod, formatCurrency, formatCompactCurrency, type Periodo } from "../lib/aggregate.ts";
import { CHART_ACCENT, CHART_MONO_FONT, CHART_TOOLTIP_STYLE } from "../lib/chartTheme.ts";
import type { Movimiento } from "../../shared/types.ts";

interface Props {
  movimientos: Movimiento[];
  periodo: Periodo;
}

const MONO = CHART_MONO_FONT;

export function PeriodBarChart({ movimientos, periodo }: Props) {
  const data = groupByPeriod(movimientos, periodo, 6);

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center font-mono text-sm text-white/50">
        Todavia no hay movimientos cargados.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={288}>
      <BarChart data={data}>
        <defs>
          <pattern id="gastos-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(10,10,12,0.35)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="2" />
          </pattern>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="#ffffff33" />
        <XAxis dataKey="label" stroke="#ffffff80" fontSize={11} fontFamily={MONO} />
        <YAxis
          stroke="#ffffff80"
          fontSize={11}
          fontFamily={MONO}
          tickCount={5}
          tickFormatter={(v: number) => formatCompactCurrency(v)}
          width={60}
        />
        <Tooltip
          cursor={{ fill: "#ffffff14" }}
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase" }} />
        <Bar dataKey="ingresos" name="Ingresos" fill={CHART_ACCENT} />
        <Bar dataKey="gastos" name="Gastos" fill="url(#gastos-hatch)" stroke="#ffffff" strokeWidth={1} />
      </BarChart>
    </ResponsiveContainer>
  );
}
