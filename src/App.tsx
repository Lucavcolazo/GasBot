import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import { AuthPage } from "./pages/AuthPage.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="font-mono text-sm text-white/50">Cargando...</p>
      </div>
    );
  }

  return session ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
