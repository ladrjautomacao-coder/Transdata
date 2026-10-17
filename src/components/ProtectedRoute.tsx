import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { PendingAccess } from "@/components/PendingAccess";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, accessPending } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // guarda o endereço pedido (ex.: link de um e-mail) para voltar a ele depois do login
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (accessPending) return <PendingAccess />;
  return <>{children}</>;
}
