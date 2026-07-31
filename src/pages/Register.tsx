import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { PasswordField } from "../components/PasswordField.tsx";

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

  if (registered) {
    return (
      <div className="space-y-4">
        <p className="label-mono mb-2">Crear cuenta</p>
        <p className="font-mono text-sm text-white/80">
          Cuenta creada. Si tu proyecto de Supabase pide confirmacion de email, revisa tu correo antes de iniciar
          sesion.
        </p>
        <button type="button" onClick={onSwitchToLogin} className="btn-outline w-full">
          Ir a iniciar sesion
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="label-mono mb-6">Crear cuenta</p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <PasswordField id="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />
        </div>

        {error && (
          <p className="border border-white/20 bg-white/5 px-3 py-2 font-mono text-xs text-white/80">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </div>
  );
}
