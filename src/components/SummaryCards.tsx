import { formatSignedCurrency } from "../lib/aggregate.ts";
import { useCountUp } from "../hooks/useCountUp.ts";
import type { Movimiento } from "../../shared/types.ts";

interface Props {
  movimientos: Movimiento[];
}

interface AmountProps {
  value: number;
  signed?: boolean;
}

function AnimatedAmount({ value, signed }: AmountProps) {
  const animated = useCountUp(value);
  const sign = signed ? (value >= 0 ? "+" : "-") : "";
  return <p className="value-mono mt-1 text-2xl font-semibold">{formatSignedCurrency(Math.round(animated), sign)}</p>;
}

export function SummaryCards({ movimientos }: Props) {
  const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((sum, m) => sum + m.monto, 0);
  const gastos = movimientos.filter((m) => m.tipo === "gasto").reduce((sum, m) => sum + m.monto, 0);
  const balance = ingresos - gastos;

  const cards = [
    { label: "Ingresos", value: ingresos, signed: false },
    { label: "Gastos", value: gastos, signed: false },
    { label: "Balance", value: balance, signed: true },
  ];

  return (
    <div className="grid grid-cols-1 divide-y divide-white/10 border border-white/15 bg-white/10 shadow-lg shadow-black/20 backdrop-blur-xl sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
      {cards.map((card) => (
        <div key={card.label} className="bg-transparent p-5">
          <p className="label-mono">{card.label}</p>
          <AnimatedAmount value={card.value} signed={card.signed} />
        </div>
      ))}
    </div>
  );
}
