import type { CSSProperties } from "react";
import { formatCurrency } from "../lib/aggregate.ts";

type StaggerStyle = CSSProperties & { "--stagger-index"?: number };
import { useCountUp } from "../hooks/useCountUp.ts";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons.tsx";
import type { Ahorro } from "../../shared/types.ts";

interface Props {
  ahorros: Ahorro[];
  onAdd: () => void;
  onEdit: (a: Ahorro) => void;
  onDelete: (a: Ahorro) => void;
}

function TotalAhorrado({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <p className="value-mono mt-1 text-2xl font-semibold">{formatCurrency(Math.round(animated))}</p>;
}

export function AhorrosSection({ ahorros, onAdd, onEdit, onDelete }: Props) {
  const total = ahorros.reduce((sum, a) => sum + a.monto_actual, 0);

  return (
    <section className="panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="label-mono">Ahorros</h2>
          <TotalAhorrado value={total} />
        </div>
        <button type="button" onClick={onAdd} className="btn-primary" aria-label="Nuevo ahorro">
          <PlusIcon className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Nuevo ahorro</span>
        </button>
      </div>

      {ahorros.length === 0 ? (
        <p className="font-mono text-sm text-white/50">Todavia no cargaste ningun ahorro.</p>
      ) : (
        <div className="scroll-thin max-h-96 space-y-2 overflow-y-auto pr-1">
          {ahorros.map((a, i) => {
            const pct = a.meta ? Math.min(100, (a.monto_actual / a.meta) * 100) : null;
            return (
              <div
                key={a.id}
                className="glass-inset stagger-item p-3"
                style={{ "--stagger-index": Math.min(i, 6) } as StaggerStyle}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{a.nombre}</p>
                    <p className="value-mono mt-1 text-base">
                      {formatCurrency(a.monto_actual)}
                      {a.meta != null && <span className="text-white/50"> / {formatCurrency(a.meta)}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(a)}
                      aria-label="Editar"
                      className="p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(a)}
                      aria-label="Borrar"
                      className="p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                {pct != null && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-white/10">
                      <div className="h-full bg-white transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="label-mono mt-1">{Math.round(pct)}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
