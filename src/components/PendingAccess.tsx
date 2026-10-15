import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Hourglass, LogOut } from "lucide-react";

/** Conta criada pelo autocadastro que ainda não foi liberada por um administrador. */
export function PendingAccess() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center space-y-3">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <Hourglass className="h-7 w-7" />
          </span>
          <CardTitle className="text-xl">Aguardando liberação</CardTitle>
          <CardDescription>
            Seu cadastro (<b className="text-foreground">{user?.email}</b>) foi recebido. Um administrador vai liberar o
            acesso e definir o seu perfil no portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            Assim que o acesso for liberado, é só entrar novamente. Se for urgente, fale com o administrador do portal.
          </p>
          <Button variant="outline" className="w-full" onClick={() => { void signOut(); }}>
            <LogOut className="mr-2 h-4 w-4" />Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
