import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { PasswordField } from "../components/PasswordField.tsx";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  return (
    <div>
      <p className="label-mono mb-6">Iniciar sesion</p>

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
          <PasswordField id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>

        {error && (
          <p className="border border-white/20 bg-white/5 px-3 py-2 font-mono text-xs text-white/80">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
