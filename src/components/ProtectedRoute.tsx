import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { PendingAccess } from "@/components/PendingAccess";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, accessPending } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (accessPending) return <PendingAccess />;
  return <>{children}</>;
}
