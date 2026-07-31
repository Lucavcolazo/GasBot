import { useEffect, useState } from "react";
import { formatSignedCurrency } from "../lib/aggregate.ts";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, TrashIcon } from "./icons.tsx";
import type { Movimiento } from "../../shared/types.ts";

interface Props {
  movimientos: Movimiento[];
  onEdit: (m: Movimiento) => void;
  onDelete: (m: Movimiento) => void;
  resetKey?: string;
}

const PAGE_SIZES = [10, 25, 50, 100];

export function MovimientosTable({ movimientos, onEdit, onDelete, resetKey }: Props) {
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(movimientos.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const rows = movimientos.slice(start, start + pageSize);

  if (movimientos.length === 0) {
    return <p className="font-mono text-sm text-white/50">Todavia no hay movimientos cargados.</p>;
  }

  return (
    <div>
      {/* Mobile: tarjetas apiladas con acciones como iconos */}
      <div className="space-y-2 sm:hidden">
        {rows.map((m) => (
          <div key={m.id} className="border border-white/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-white">{m.descripcion ?? "-"}</p>
                <p className="label-mono mt-1">
                  {m.categoria} ·{" "}
                  {new Date(m.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                </p>
              </div>
              <p className={`value-mono shrink-0 text-sm ${m.tipo === "gasto" ? "text-white/60" : "text-white"}`}>
                {formatSignedCurrency(m.monto, m.tipo === "gasto" ? "-" : "+")}
              </p>
            </div>
            <div className="mt-2 flex justify-end gap-1 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => onEdit(m)}
                aria-label="Editar"
                className="p-2 text-white/60 hover:text-white"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={() => onDelete(m)}
                aria-label="Borrar"
                className="p-2 text-white/60 hover:text-white"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet / desktop: tabla completa */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left font-mono text-sm">
          <thead>
            <tr className="border-b border-white/15 text-white/50">
              <th className="label-mono py-2 pr-4 font-medium">Fecha</th>
              <th className="label-mono py-2 pr-4 font-medium">Descripcion</th>
              <th className="label-mono py-2 pr-4 font-medium">Categoria</th>
              <th className="label-mono py-2 pr-4 text-right font-medium">Monto</th>
              <th className="label-mono py-2 pl-4 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-white/10">
                <td className="py-2 pr-4 text-white/50">
                  {new Date(m.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                </td>
                <td className="py-2 pr-4 text-white">{m.descripcion ?? "-"}</td>
                <td className="py-2 pr-4 text-white/60 uppercase">{m.categoria}</td>
                <td className={`value-mono py-2 pr-4 text-right ${m.tipo === "gasto" ? "text-white/60" : "text-white"}`}>
                  {formatSignedCurrency(m.monto, m.tipo === "gasto" ? "-" : "+")}
                </td>
                <td className="py-2 pl-4 text-right">
                  <button type="button" onClick={() => onEdit(m)} className="mr-3 text-white/50 hover:text-white">
                    [ editar ]
                  </button>
                  <button type="button" onClick={() => onDelete(m)} className="text-white/50 hover:text-white">
                    [ borrar ]
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
        <div className="flex items-center gap-2">
          <span className="label-mono">Ver</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="field-select w-auto py-1"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="label-mono">por pagina</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-white/50">
            Pagina {safePage + 1} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Pagina anterior"
              className="btn-ghost px-3 py-1.5"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5 sm:hidden" />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Pagina siguiente"
              className="btn-ghost px-3 py-1.5"
            >
              <ChevronRightIcon className="h-3.5 w-3.5 sm:hidden" />
              <span className="hidden sm:inline">Siguiente</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
