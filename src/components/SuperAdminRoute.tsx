import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

/** Igual ao AdminRoute, mas só libera super_admin (módulos em desenvolvimento). */
export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
