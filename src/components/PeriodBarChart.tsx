import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { groupByPeriod, formatCurrency, formatCompactCurrency, type Periodo } from "../lib/aggregate.ts";
import type { Movimiento } from "../../shared/types.ts";

interface Props {
  movimientos: Movimiento[];
  periodo: Periodo;
}

const MONO = "JetBrains Mono, monospace";

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
            <rect width="6" height="6" fill="#000000" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="2" />
          </pattern>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="#ffffff26" />
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
          cursor={{ fill: "#ffffff0d" }}
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            background: "#000000",
            border: "1px solid #ffffff",
            borderRadius: 0,
            fontFamily: MONO,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontFamily: MONO, fontSize: 11, textTransform: "uppercase" }} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#ffffff" />
        <Bar dataKey="gastos" name="Gastos" fill="url(#gastos-hatch)" stroke="#ffffff" strokeWidth={1} />
      </BarChart>
    </ResponsiveContainer>
  );
}
