import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { CATEGORIAS } from "../../shared/categories.ts";
import type { Movimiento } from "../../shared/types.ts";

interface Props {
  userId: string;
  editing: Movimiento | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MovimientoForm({ userId, editing, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<"gasto" | "ingreso">(editing?.tipo ?? "gasto");
  const [monto, setMonto] = useState(editing ? String(editing.monto) : "");
  const [categoria, setCategoria] = useState(editing?.categoria ?? CATEGORIAS[0]);
  const [descripcion, setDescripcion] = useState(editing?.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError("El monto tiene que ser un numero mayor a 0.");
      return;
    }

    setLoading(true);
    const payload = { tipo, monto: montoNum, categoria, descripcion: descripcion.trim() || null };

    const { error: dbError } = editing
      ? await supabase.from("movimientos").update(payload).eq("id", editing.id)
      : await supabase.from("movimientos").insert({ ...payload, user_id: userId });

    setLoading(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="glass-scrim-enter fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="glass-pop-enter w-full max-w-sm border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">
            {editing ? "Editar movimiento" : "Nuevo movimiento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 font-mono text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            [ cerrar ]
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "gasto" | "ingreso")}
              className="field-select"
            >
              <option value="gasto">Gasto</option>
              <option value="ingreso">Ingreso</option>
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="monto">
              Monto
            </label>
            <input
              id="monto"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)} className="field-select">
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="descripcion">
              Descripcion
            </label>
            <input
              id="descripcion"
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="field-input"
              placeholder="opcional"
            />
          </div>

          {error && (
            <p className="border border-white/20 bg-white/5 px-3 py-2 font-mono text-xs text-white/80">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
