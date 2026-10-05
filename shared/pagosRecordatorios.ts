// Marcar y desmarcar un gasto fijo como pagado en el mes actual. Lo usan el
// dashboard (con el cliente del usuario, bajo RLS) y el bot de Telegram (con
// la service role key), por eso reciben el cliente de Supabase por parámetro.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria } from "./categories.js";
import { hoyArgentina, inicioDiaArgentina, periodoKey } from "./recordatorios.js";

export interface RecordatorioPagable {
  id: string;
  nombre: string;
  monto: number;
  categoria: Categoria;
}

function periodoActual(): string {
  const { year, month } = hoyArgentina();
  return periodoKey(year, month);
}

// Marca el recordatorio como pagado este mes y anota el gasto como movimiento,
// vinculado con recordatorio_id para poder deshacerlo después.
export async function marcarPagado(
  db: SupabaseClient,
  userId: string,
  r: RecordatorioPagable,
  mensajeOriginal?: string,
): Promise<boolean> {
  const [{ error: updateError }, { error: insertError }] = await Promise.all([
    db
      .from("recordatorios")
      .update({
        periodo_actual: periodoActual(),
        pagado: true,
        notificado_3dias: false,
        notificado_vencimiento: false,
      })
      .eq("id", r.id)
      .eq("user_id", userId),
    db.from("movimientos").insert({
      user_id: userId,
      tipo: "gasto",
      monto: r.monto,
      categoria: r.categoria,
      descripcion: r.nombre,
      recordatorio_id: r.id,
      ...(mensajeOriginal ? { mensaje_original: mensajeOriginal } : {}),
    }),
  ]);
  if (updateError || insertError) console.error("Marcar pagado recordatorio error", updateError ?? insertError);
  return !updateError && !insertError;
}

// Deshace marcarPagado: vuelve el recordatorio a pendiente y borra el gasto que
// se anotó este mes al marcarlo. Los avisos del cron se rearman solos porque
// marcarPagado ya los había dejado en false.
export async function desmarcarPagado(db: SupabaseClient, userId: string, r: RecordatorioPagable): Promise<boolean> {
  const inicioMes = inicioDiaArgentina(`${periodoActual()}-01`);

  const { data: borrados, error: deleteError } = await db
    .from("movimientos")
    .delete()
    .eq("user_id", userId)
    .eq("recordatorio_id", r.id)
    .gte("created_at", inicioMes)
    .select("id");
  if (deleteError) {
    console.error("Desmarcar pagado: error borrando el gasto", deleteError);
    return false;
  }

  // Pagos marcados antes de que existiera recordatorio_id: el gasto se busca
  // por nombre y monto, y se borra solo el más reciente del mes.
  if (!borrados?.length) {
    const { data: anterior } = await db
      .from("movimientos")
      .select("id")
      .eq("user_id", userId)
      .is("recordatorio_id", null)
      .eq("tipo", "gasto")
      .eq("descripcion", r.nombre)
      .eq("monto", r.monto)
      .gte("created_at", inicioMes)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anterior) await db.from("movimientos").delete().eq("id", anterior.id);
  }

  const { error: updateError } = await db
    .from("recordatorios")
    .update({ pagado: false })
    .eq("id", r.id)
    .eq("user_id", userId);
  if (updateError) console.error("Desmarcar pagado recordatorio error", updateError);
  return !updateError;
}
