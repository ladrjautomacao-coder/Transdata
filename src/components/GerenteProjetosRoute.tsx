import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

/** Igual ao SuperAdminRoute, mas libera também quem está ativo na Equipe como Gerente de Projetos. */
export function GerenteProjetosRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, managerId, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSuperAdmin && !managerId) return <Navigate to="/" replace />;
  return <>{children}</>;
}
