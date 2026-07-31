import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import type { Ahorro } from "../../shared/types.ts";

interface Props {
  userId: string;
  editing: Ahorro | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AhorroForm({ userId, editing, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(editing?.nombre ?? "");
  const [montoActual, setMontoActual] = useState(editing ? String(editing.monto_actual) : "");
  const [meta, setMeta] = useState(editing?.meta != null ? String(editing.meta) : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const montoNum = Number(montoActual);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      setError("El monto tiene que ser un numero mayor o igual a 0.");
      return;
    }

    let metaNum: number | null = null;
    if (meta.trim() !== "") {
      metaNum = Number(meta);
      if (!Number.isFinite(metaNum) || metaNum <= 0) {
        setError("La meta tiene que ser un numero mayor a 0, o dejarla vacia.");
        return;
      }
    }

    if (!nombre.trim()) {
      setError("Poné un nombre para el ahorro.");
      return;
    }

    setLoading(true);
    const payload = { nombre: nombre.trim(), monto_actual: montoNum, meta: metaNum };

    const { error: dbError } = editing
      ? await supabase.from("ahorros").update(payload).eq("id", editing.id)
      : await supabase.from("ahorros").insert({ ...payload, user_id: userId });

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
            {editing ? "Editar ahorro" : "Nuevo ahorro"}
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
            <label className="field-label" htmlFor="nombre">
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="field-input"
              placeholder="Auto, celu nuevo, vacaciones..."
            />
          </div>

          <div>
            <label className="field-label" htmlFor="monto_actual">
              Monto ahorrado
            </label>
            <input
              id="monto_actual"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={montoActual}
              onChange={(e) => setMontoActual(e.target.value)}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="meta">
              Meta
            </label>
            <input
              id="meta"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
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
