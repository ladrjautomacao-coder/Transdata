import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PendingAccess } from "@/components/PendingAccess";
import { SemAcessoSistema } from "@/components/SemAcessoSistema";
import { irParaLogin } from "@/lib/portalAcesso";

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, accessPending, profile } = useAuth();

  // sem sessão: tela de acesso do portal, que traz de volta para o endereço pedido (ex.: link de e-mail)
  useEffect(() => {
    if (!loading && !session) irParaLogin();
  }, [loading, session]);

  if (loading || !session) return <Carregando />;
  if (accessPending) return <PendingAccess />;
  // conta do login único sem perfil no CS Flow (ex.: só do Transmobile)
  if (!profile) return <SemAcessoSistema />;
  return <>{children}</>;
}
