import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { irParaPortal } from "@/lib/portalAcesso";
import { LayoutGrid, LogOut, ShieldOff } from "lucide-react";

/** Conta do login único que ainda não tem acesso ao CS Flow (não tem perfil aqui). */
export function SemAcessoSistema() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-3">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldOff className="h-7 w-7" />
          </span>
          <CardTitle className="text-xl">Sem acesso ao CS Flow</CardTitle>
          <CardDescription>
            Sua conta (<b className="text-foreground">{user?.email}</b>) ainda não tem acesso a este sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Se você precisa usar o CS Flow, peça a liberação ao administrador do portal.
          </p>
          <Button className="w-full" onClick={irParaPortal}>
            <LayoutGrid className="mr-2 h-4 w-4" />Voltar ao portal
          </Button>
          <Button variant="outline" className="w-full" onClick={() => { void signOut(); }}>
            <LogOut className="mr-2 h-4 w-4" />Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
