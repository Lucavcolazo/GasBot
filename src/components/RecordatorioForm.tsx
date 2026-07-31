import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { CATEGORIAS } from "../../shared/categories.ts";
import type { Recordatorio } from "../../shared/types.ts";

interface Props {
  userId: string;
  editing: Recordatorio | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RecordatorioForm({ userId, editing, onClose, onSaved }: Props) {
  const [nombre, setNombre] = useState(editing?.nombre ?? "");
  const [monto, setMonto] = useState(editing ? String(editing.monto) : "");
  const [categoria, setCategoria] = useState(editing?.categoria ?? CATEGORIAS[0]);
  const [diaVencimiento, setDiaVencimiento] = useState(editing ? String(editing.dia_vencimiento) : "");
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

    const diaNum = Number(diaVencimiento);
    if (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31) {
      setError("El dia de vencimiento tiene que ser un numero entre 1 y 31.");
      return;
    }

    if (!nombre.trim()) {
      setError("Poné un nombre para el recordatorio.");
      return;
    }

    setLoading(true);
    const payload = { nombre: nombre.trim(), monto: montoNum, categoria, dia_vencimiento: diaNum };

    const { error: dbError } = editing
      ? await supabase.from("recordatorios").update(payload).eq("id", editing.id)
      : await supabase.from("recordatorios").insert({ ...payload, user_id: userId });

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
            {editing ? "Editar recordatorio" : "Nuevo recordatorio"}
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
              placeholder="Alquiler, internet, gimnasio..."
            />
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
            <label className="field-label" htmlFor="dia_vencimiento">
              Dia de vencimiento
            </label>
            <input
              id="dia_vencimiento"
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              step="1"
              required
              value={diaVencimiento}
              onChange={(e) => setDiaVencimiento(e.target.value)}
              className="field-input"
              placeholder="1-31"
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
