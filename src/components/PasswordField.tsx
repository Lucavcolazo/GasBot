import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons.tsx";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
}

export function PasswordField({ id, value, onChange, autoComplete, minLength }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input pr-10"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 transition-colors hover:text-white"
      >
        {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
