import { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { useMovimientos } from "../hooks/useMovimientos.ts";
import { useAhorros } from "../hooks/useAhorros.ts";
import { PERIODOS, type Periodo, periodKey } from "../lib/aggregate.ts";
import { supabase } from "../lib/supabaseClient.ts";
import { Navbar } from "../components/Navbar.tsx";
import { SummaryCards } from "../components/SummaryCards.tsx";
import { AhorrosSection } from "../components/AhorrosSection.tsx";
import { CategoryBarChart } from "../components/CategoryBarChart.tsx";
import { PeriodBarChart } from "../components/PeriodBarChart.tsx";
import { MovimientosTable } from "../components/MovimientosTable.tsx";
import { MovimientoForm } from "../components/MovimientoForm.tsx";
import { AhorroForm } from "../components/AhorroForm.tsx";
import { ConfirmDialog } from "../components/ConfirmDialog.tsx";
import { DashboardSkeleton } from "../components/DashboardSkeleton.tsx";
import { SegmentedControl } from "../components/SegmentedControl.tsx";
import { PlusIcon } from "../components/icons.tsx";
import type { Ahorro, Movimiento } from "../../shared/types.ts";

const PERIODO_LABELS: Record<Periodo, string> = { dia: "Dia", semana: "Semana", mes: "Mes" };
const PERIODO_TREND_LABEL: Record<Periodo, string> = { dia: "dias", semana: "semanas", mes: "meses" };

export function Dashboard() {
  const { user } = useAuth();
  const { movimientos, loading, error, refresh } = useMovimientos();
  const { ahorros, loading: ahorrosLoading, refresh: refreshAhorros } = useAhorros();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Movimiento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Movimiento | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  const [ahorroFormOpen, setAhorroFormOpen] = useState(false);
  const [editingAhorro, setEditingAhorro] = useState<Ahorro | null>(null);
  const [deleteAhorroTarget, setDeleteAhorroTarget] = useState<Ahorro | null>(null);

  const activePeriodKey = periodKey(new Date().toISOString(), periodo);

  const movimientosDelPeriodo = useMemo(
    () => movimientos.filter((m) => periodKey(m.created_at, periodo) === activePeriodKey),
    [movimientos, periodo, activePeriodKey],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(m: Movimiento) {
    setEditing(m);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await supabase.from("movimientos").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  function openCreateAhorro() {
    setEditingAhorro(null);
    setAhorroFormOpen(true);
  }

  function openEditAhorro(a: Ahorro) {
    setEditingAhorro(a);
    setAhorroFormOpen(true);
  }

  async function confirmDeleteAhorro() {
    if (!deleteAhorroTarget) return;
    await supabase.from("ahorros").delete().eq("id", deleteAhorroTarget.id);
    setDeleteAhorroTarget(null);
    refreshAhorros();
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading || ahorrosLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl options={PERIODOS} value={periodo} onChange={setPeriodo} labels={PERIODO_LABELS} />

              <button type="button" onClick={openCreate} className="btn-primary" aria-label="Nuevo movimiento">
                <PlusIcon className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Nuevo movimiento</span>
              </button>
            </div>

            {error && (
              <div className="mb-6 border border-white px-4 py-3 font-mono text-sm text-white">
                Error cargando movimientos: {error}
              </div>
            )}

            <div className="space-y-6">
              <SummaryCards movimientos={movimientosDelPeriodo} />

              <AhorrosSection
                ahorros={ahorros}
                onAdd={openCreateAhorro}
                onEdit={openEditAhorro}
                onDelete={setDeleteAhorroTarget}
              />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="panel">
                  <h2 className="label-mono mb-4">Gastos por categoria</h2>
                  <CategoryBarChart movimientos={movimientosDelPeriodo} />
                </section>
                <section className="panel">
                  <h2 className="label-mono mb-4">Ultimos 6 {PERIODO_TREND_LABEL[periodo]}</h2>
                  <PeriodBarChart movimientos={movimientos} periodo={periodo} />
                </section>
              </div>

              <section className="panel">
                <h2 className="label-mono mb-4">Movimientos recientes</h2>
                <MovimientosTable movimientos={movimientos} onEdit={openEdit} onDelete={setDeleteTarget} />
              </section>
            </div>
          </>
        )}
      </div>

      {formOpen && (
        <MovimientoForm
          userId={user.id}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={refresh}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Borrar movimiento"
          message={`Vas a borrar "${deleteTarget.descripcion ?? deleteTarget.categoria}". Esta accion no se puede deshacer.`}
          confirmLabel="Borrar"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {ahorroFormOpen && (
        <AhorroForm
          userId={user.id}
          editing={editingAhorro}
          onClose={() => setAhorroFormOpen(false)}
          onSaved={refreshAhorros}
        />
      )}

      {deleteAhorroTarget && (
        <ConfirmDialog
          title="Borrar ahorro"
          message={`Vas a borrar el ahorro "${deleteAhorroTarget.nombre}". Esta accion no se puede deshacer.`}
          confirmLabel="Borrar"
          onConfirm={confirmDeleteAhorro}
          onCancel={() => setDeleteAhorroTarget(null)}
        />
      )}
    </div>
  );
}
