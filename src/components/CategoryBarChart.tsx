import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { groupByCategoria, formatCurrency, formatCompactCurrency } from "../lib/aggregate.ts";
import { CHART_ACCENT, CHART_MONO_FONT, CHART_TOOLTIP_STYLE } from "../lib/chartTheme.ts";
import type { Movimiento } from "../../shared/types.ts";

interface Props {
  movimientos: Movimiento[];
}

export function CategoryBarChart({ movimientos }: Props) {
  const data = groupByCategoria(movimientos, "gasto");

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center font-mono text-sm text-white/50">
        Sin gastos en este periodo todavia.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(288, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#ffffff33" horizontal={false} />
        <XAxis
          type="number"
          stroke="#ffffff80"
          fontSize={11}
          fontFamily={CHART_MONO_FONT}
          tickCount={4}
          tickFormatter={(v: number) => formatCompactCurrency(v)}
        />
        <YAxis
          type="category"
          dataKey="categoria"
          stroke="#ffffff80"
          fontSize={11}
          fontFamily={CHART_MONO_FONT}
          width={80}
          tickFormatter={(v: string) => v.toUpperCase()}
        />
        <Tooltip
          cursor={{ fill: "#ffffff14" }}
          formatter={(value) => formatCurrency(Number(value))}
          labelFormatter={(label) => String(label).toUpperCase()}
          contentStyle={CHART_TOOLTIP_STYLE}
        />
        <Bar dataKey="total" fill={CHART_ACCENT} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
