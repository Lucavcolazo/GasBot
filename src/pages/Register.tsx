import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";

interface Props {
  onSwitchToLogin: () => void;
}

export function Register({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setRegistered(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold uppercase tracking-widest">GasBot</h1>
          <p className="label-mono mt-2">Crear cuenta</p>
        </div>

        {registered ? (
          <div className="panel space-y-4 text-center">
            <p className="font-mono text-sm text-white/80">
              Cuenta creada. Si tu proyecto de Supabase pide confirmacion de email, revisa tu correo antes de
              iniciar sesion.
            </p>
            <button type="button" onClick={onSwitchToLogin} className="btn-outline w-full">
              Ir a iniciar sesion
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="panel space-y-4">
              <div>
                <label className="field-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="password">
                  Contrasena
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  autoComplete="new-password"
                />
              </div>

              {error && <p className="border border-white/30 px-3 py-2 font-mono text-xs text-white/80">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

            <button
              type="button"
              onClick={onSwitchToLogin}
              className="mt-6 w-full font-mono text-xs uppercase tracking-widest text-white/50 hover:text-white"
            >
              Ya tenes cuenta? Inicia sesion
            </button>
          </>
        )}
      </div>
    </div>
  );
}
