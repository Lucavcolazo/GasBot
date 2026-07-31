import { useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useAuth } from "../contexts/AuthContext.tsx";
import { PersonIcon } from "./icons.tsx";
import { FlyingBillIcon } from "./FlyingBillIcon.tsx";
import { SettingsModal } from "./SettingsModal.tsx";

export function Navbar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="fixed top-0 z-40 w-full bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/85 to-transparent px-4 pb-6 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 lg:max-w-7xl">
        <div className="flex items-center gap-2">
          <FlyingBillIcon className="h-6 w-9 text-white" />
          <h1 className="font-mono text-lg font-bold uppercase tracking-[-0.02em]">GasBot</h1>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Cuenta"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center text-white/70 transition-colors hover:text-white"
          >
            <PersonIcon className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="glass-pop-enter absolute right-0 top-full z-50 mt-2 w-56 origin-top-right border border-white/15 bg-black/95 shadow-lg shadow-black/50 backdrop-blur-xl">
                <p className="truncate border-b border-white/10 px-4 py-3 font-mono text-xs text-white/60">
                  {user?.email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-white/70 transition-colors hover:bg-white hover:text-black"
                >
                  Configuracion
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    supabase.auth.signOut();
                  }}
                  className="w-full border-t border-white/10 px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-white/70 transition-colors hover:bg-white hover:text-black"
                >
                  Cerrar sesion
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
