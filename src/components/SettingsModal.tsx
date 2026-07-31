import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext.tsx";
import { useTelegramLink } from "../hooks/useTelegramLink.ts";
import { CheckIcon } from "./icons.tsx";

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const { user } = useAuth();
  const { loading, linked, linkedAt, linkInfo, error, generating, generateLink, unlink } = useTelegramLink();

  // Portal a document.body: el Navbar tiene un drop-shadow (filter) en el
  // <header>, y cualquier filter en un ancestro crea un containing block
  // para position:fixed — sin el portal, este modal quedaba encerrado
  // dentro del header en vez de cubrir toda la pantalla.
  return createPortal(
    <div className="glass-scrim-enter fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
      <div className="glass-pop-enter w-full max-w-sm border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">Configuración</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 font-mono text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            [ cerrar ]
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="field-label">Cuenta</p>
            <p className="truncate font-mono text-sm text-white">{user?.email}</p>
          </div>

          <div className="border-t border-white/10 pt-5">
            <p className="field-label mb-2">Telegram</p>

            {loading ? (
              <p className="font-mono text-sm text-white/50">Revisando estado...</p>
            ) : linked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-mono text-sm text-white">
                  <CheckIcon className="h-4 w-4 text-white" />
                  <span>Conectado</span>
                </div>
                {linkedAt && (
                  <p className="font-mono text-xs text-white/50">
                    Desde el {new Date(linkedAt).toLocaleDateString("es-AR")}
                  </p>
                )}
                <button type="button" onClick={unlink} className="btn-ghost w-full">
                  Desconectar
                </button>
              </div>
            ) : linkInfo ? (
              <div className="space-y-3">
                <p className="font-mono text-sm text-white/80">
                  Tocá el botón para abrir Telegram y confirmar la conexión.
                </p>
                <a href={linkInfo.deepLink} target="_blank" rel="noreferrer" className="btn-primary block w-full text-center">
                  Abrir Telegram
                </a>
                <p className="font-mono text-xs text-white/50">
                  O escribile al bot: <span className="text-white">/start {linkInfo.code}</span>
                </p>
                <p className="font-mono text-xs text-white/50">Esperando confirmación...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-mono text-sm text-white/50">No conectado.</p>
                <button type="button" onClick={generateLink} disabled={generating} className="btn-primary w-full">
                  {generating ? "Generando..." : "Conectar Telegram"}
                </button>
              </div>
            )}

            {error && (
              <p className="mt-3 border border-white/20 bg-white/5 px-3 py-2 font-mono text-xs text-white/80">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
