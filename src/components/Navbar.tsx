import { useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useAuth } from "../contexts/AuthContext.tsx";
import { PersonIcon } from "./icons.tsx";
import { FlyingBillIcon } from "./FlyingBillIcon.tsx";

export function Navbar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/15 bg-black/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <FlyingBillIcon className="h-6 w-9 text-white" />
          <h1 className="font-mono text-lg font-bold uppercase tracking-widest">GasBot</h1>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Cuenta"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center border border-white/30 text-white/70 transition-colors hover:border-white hover:text-white"
          >
            <PersonIcon className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 border border-white/20 bg-black/90 backdrop-blur-md">
                <p className="truncate border-b border-white/10 px-4 py-3 font-mono text-xs text-white/60">
                  {user?.email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    supabase.auth.signOut();
                  }}
                  className="w-full px-4 py-3 text-left font-mono text-xs uppercase tracking-widest text-white/70 transition-colors hover:bg-white hover:text-black"
                >
                  Cerrar sesion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
