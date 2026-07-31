import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import { AuthPage } from "./pages/AuthPage.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { AppBackground } from "./components/AppBackground.tsx";

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="border border-white/15 bg-white/10 px-4 py-2 font-mono text-sm text-white/50 backdrop-blur-xl">
          Cargando...
        </p>
      </div>
    );
  }

  return session ? <Dashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppBackground />
      <Gate />
    </AuthProvider>
  );
}
