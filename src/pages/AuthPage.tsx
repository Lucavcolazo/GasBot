import { useState } from "react";
import { Login } from "./Login.tsx";
import { Register } from "./Register.tsx";
import { FlyingBillIcon } from "../components/FlyingBillIcon.tsx";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="grid w-full max-w-3xl grid-cols-1 border border-white/15 bg-white/10 shadow-lg shadow-black/20 backdrop-blur-xl md:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-6 border-b border-white/10 p-8 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2">
            <FlyingBillIcon className="h-7 w-11 text-white" />
            <h1 className="font-mono text-xl font-bold uppercase tracking-[-0.02em]">GasBot</h1>
          </div>

          <p className="text-sm text-white/60">
            Contale tus gastos e ingresos como a un amigo. GasBot los anota, corrige y te cuenta el balance.
          </p>

          <div className="flex flex-row gap-2 md:flex-col">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 px-4 py-3 text-left font-mono text-xs uppercase tracking-widest transition-colors md:flex-none ${
                mode === "login"
                  ? "bg-white text-black"
                  : "border border-white/15 text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              Iniciar sesion
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 px-4 py-3 text-left font-mono text-xs uppercase tracking-widest transition-colors md:flex-none ${
                mode === "register"
                  ? "bg-white text-black"
                  : "border border-white/15 text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              Crear cuenta
            </button>
          </div>
        </div>

        <div className="p-8">{mode === "login" ? <Login /> : <Register onSwitchToLogin={() => setMode("login")} />}</div>
      </div>
    </div>
  );
}
