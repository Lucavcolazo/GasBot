import { useState } from "react";
import { Login } from "./Login.tsx";
import { Register } from "./Register.tsx";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return mode === "login" ? (
    <Login onSwitchToRegister={() => setMode("register")} />
  ) : (
    <Register onSwitchToLogin={() => setMode("login")} />
  );
}
