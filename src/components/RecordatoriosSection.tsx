import type { CSSProperties } from "react";
import { formatCurrency } from "../lib/aggregate.ts";

type StaggerStyle = CSSProperties & { "--stagger-index"?: number };
import { hoyArgentina, estadoParaPeriodo, periodoKey } from "../../shared/recordatorios.ts";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "./icons.tsx";
import type { Recordatorio } from "../../shared/types.ts";

interface Props {
  recordatorios: Recordatorio[];
  onAdd: () => void;
  onEdit: (r: Recordatorio) => void;
  onDelete: (r: Recordatorio) => void;
  onMarcarPagado: (r: Recordatorio) => void;
}

export function RecordatoriosSection({ recordatorios, onAdd, onEdit, onDelete, onMarcarPagado }: Props) {
  const { year, month } = hoyArgentina();
  const periodoActual = periodoKey(year, month);

  return (
    <section className="panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="label-mono">Gastos fijos</h2>
        </div>
        <button type="button" onClick={onAdd} className="btn-primary" aria-label="Nuevo recordatorio">
          <PlusIcon className="h-4 w-4 sm:hidden" />
          <span className="hidden sm:inline">Nuevo recordatorio</span>
        </button>
      </div>

      <div className="scroll-thin h-96 overflow-y-auto pr-1">
        {recordatorios.length === 0 ? (
          <p className="font-mono text-sm text-white/50">Todavia no cargaste ningun gasto fijo.</p>
        ) : (
          <div className="space-y-2">
            {recordatorios.map((r, i) => {
              const pagado = estadoParaPeriodo(r, periodoActual).pagado;
              return (
                <div
                  key={r.id}
                  className="glass-inset stagger-item p-3"
                  style={{ "--stagger-index": Math.min(i, 6) } as StaggerStyle}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{r.nombre}</p>
                      <p className="value-mono mt-1 text-base">
                        {formatCurrency(r.monto)}
                        <span className="text-white/50"> · dia {r.dia_vencimiento}</span>
                      </p>
                      <p className={`label-mono mt-1 ${pagado ? "text-white/50" : "text-white"}`}>
                        {pagado ? "pagado este mes" : "pendiente"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!pagado && (
                        <button
                          type="button"
                          onClick={() => onMarcarPagado(r)}
                          aria-label="Marcar pagado"
                          className="p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <CheckIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(r)}
                        aria-label="Editar"
                        className="p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r)}
                        aria-label="Borrar"
                        className="p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
