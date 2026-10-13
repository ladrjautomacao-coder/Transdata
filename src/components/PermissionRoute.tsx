import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermAction, PermModule } from "@/lib/permissions";

/** Libera a rota conforme o painel de Permissões (admin e super_admin sempre passam). */
export function PermissionRoute({ module, action = "view", children }: { module: PermModule; action?: PermAction; children: React.ReactNode }) {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!can(module, action)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
