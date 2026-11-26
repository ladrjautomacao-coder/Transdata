import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { irParaLogin } from "@/lib/portalAcesso";

/**
 * Endereços antigos de login, cadastro e senha (/login, /cadastro, /forgot-password,
 * /reset-password): isso tudo agora fica na tela de acesso do portal. Quem já está conectado
 * vai direto para o início do CS Flow.
 */
export function IrParaAcesso({ acesso }: { acesso?: "cadastro" | "senha" }) {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) irParaLogin({ acesso, voltar: false });
  }, [loading, session, acesso]);

  if (!loading && session) return <Navigate to="/" replace />;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
