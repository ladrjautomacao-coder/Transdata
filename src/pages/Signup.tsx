import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { ArrowLeft, Lock, Mail, MailCheck, User } from "lucide-react";
import LogoAnimation from "@/components/LogoAnimation";

/** Domínios aceitos no autocadastro — a mesma regra é aplicada no banco. */
export const SIGNUP_DOMAINS = ["itstransdata.com", "mobilecomm.com"];

const isAllowedEmail = (email: string) =>
  SIGNUP_DOMAINS.includes(email.trim().toLowerCase().split("@")[1] ?? "");

export default function Signup() {
  const { session, loading } = useAuth();
  const branding = useTenantBranding();
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const emailTyped = email.includes("@");
  const domainError = emailTyped && !isAllowedEmail(email)
    ? `Use seu e-mail corporativo (@${SIGNUP_DOMAINS.join(" ou @")}).`
    : null;
  const confirmError = confirm && confirm !== password ? "As senhas não conferem." : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowedEmail(email) || password !== confirm) return;
    setSubmitting(true);
    const normalized = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Não foi possível criar a conta", description: error.message, variant: "destructive" });
      return;
    }
    setSentTo(normalized);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        {sentTo ? (
          <>
            <CardHeader className="text-center space-y-3">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-7 w-7" />
              </span>
              <CardTitle className="text-xl">Confirme seu e-mail</CardTitle>
              <CardDescription>
                Enviamos um link para <b className="text-foreground">{sentTo}</b>. Abra o e-mail e clique no link para confirmar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                <li><b className="text-foreground">1.</b> Confirme o e-mail pelo link recebido.</li>
                <li><b className="text-foreground">2.</b> Um administrador libera o seu acesso e define o seu perfil.</li>
                <li><b className="text-foreground">3.</b> Pronto: entre com seu e-mail e senha.</li>
              </ol>
              <p className="text-xs text-muted-foreground">Não chegou? Confira a caixa de spam ou lixo eletrônico.</p>
              <Button asChild className="w-full"><Link to="/login">Ir para o login</Link></Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center space-y-3">
              <LogoAnimation tone="light" />
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{branding.portalName}</p>
              <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
              <CardDescription>Exclusivo para e-mails @{SIGNUP_DOMAINS.join(" e @")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nome completo" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" required maxLength={120} autoComplete="name" />
                </div>
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="E-mail corporativo" value={email} onChange={e => setEmail(e.target.value)}
                      className="pl-10" required autoComplete="email" aria-invalid={!!domainError} />
                  </div>
                  {domainError && <p className="mt-1.5 text-xs text-destructive">{domainError}</p>}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Senha (mínimo 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)}
                    className="pl-10" required minLength={6} autoComplete="new-password" />
                </div>
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input type="password" placeholder="Confirmar senha" value={confirm} onChange={e => setConfirm(e.target.value)}
                      className="pl-10" required minLength={6} autoComplete="new-password" aria-invalid={!!confirmError} />
                  </div>
                  {confirmError && <p className="mt-1.5 text-xs text-destructive">{confirmError}</p>}
                </div>
                <Button type="submit" className="w-full font-semibold"
                  disabled={submitting || !fullName.trim() || !isAllowedEmail(email) || password.length < 6 || password !== confirm}>
                  {submitting ? "Criando conta..." : "Criar conta"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Depois de confirmar o e-mail, o acesso é liberado por um administrador.
                </p>
              </form>
              <div className="mt-4 text-center">
                <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Já tenho conta
                </Link>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
