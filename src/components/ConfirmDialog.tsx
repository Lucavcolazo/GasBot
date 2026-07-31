interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="glass-scrim-enter fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="glass-pop-enter w-full max-w-sm border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest">{title}</h2>
        <p className="mt-3 font-mono text-sm text-white/70">{message}</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="btn-ghost flex-1">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary flex-1">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
