import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { Mail, Lock, Signal, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import LogoAnimation from "@/components/LogoAnimation";

type Branding = ReturnType<typeof useTenantBranding>;

interface LoginFormProps {
  branding: Branding;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Animated grid lines */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: 'linear-gradient(hsl(28 90% 52%) 1px, transparent 1px), linear-gradient(90deg, hsl(28 90% 52%) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      {/* Horizontal scan line */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        animate={{ top: ["-5%", "105%"] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Vertical scan line */}
      <motion.div
        className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent"
        animate={{ left: ["-5%", "105%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary/30"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.4,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Glowing orbs */}
      <motion.div
        className="absolute w-64 h-64 rounded-full blur-3xl bottom-[10%] right-[5%]"
        style={{ background: "hsl(28 90% 52% / 0.08)" }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-48 h-48 rounded-full blur-3xl top-[15%] left-[10%]"
        style={{ background: "hsl(28 90% 52% / 0.05)" }}
        animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <motion.line
          x1="10%" y1="20%" x2="40%" y2="60%"
          stroke="hsl(28 90% 52%)" strokeWidth="1"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.line
          x1="60%" y1="10%" x2="85%" y2="70%"
          stroke="hsl(28 90% 52%)" strokeWidth="1"
          animate={{ opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <motion.line
          x1="30%" y1="80%" x2="70%" y2="30%"
          stroke="hsl(28 90% 52%)" strokeWidth="1"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </svg>
    </div>
  );
}

// Tela de acesso da Transdata (cliente fundador) — layout e texto originais, intocados.
function TransdataLogin({ branding, email, setEmail, password, setPassword, submitting, onSubmit }: LoginFormProps) {
  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Left panel - branding with animated background */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground relative items-center justify-center">
        <AnimatedGrid />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative z-10 text-center space-y-8 px-12"
        >
          <LogoAnimation />
          <div>
            <h2 className="text-3xl font-bold text-background mb-3">Sistema de Gestão</h2>
            <p className="text-background/50 text-lg">Plataforma de gerenciamento de projetos de bilhetagem</p>
          </div>
          <motion.div
            className="flex items-center justify-center gap-2 text-primary max-w-xs mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Signal className="h-4 w-4 animate-pulse shrink-0" />
            <span className="text-sm font-medium tracking-wide">Conectado à performance que impulsiona o sucesso e acelera o crescimento</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="w-full max-w-md shadow-lg border-primary/20 glow-orange">
            <CardHeader className="text-center space-y-3">
              <div className="lg:hidden flex justify-center mb-2">
                <LogoAnimation />
              </div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{branding.portalName}</p>
              <CardTitle className="text-2xl font-bold">Acessar Sistema</CardTitle>
              <CardDescription>Entre com suas credenciais</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} />
                </div>
                <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                  {submitting ? "Aguarde..." : "Entrar"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm space-y-2">
                <Link to="/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">Esqueci minha senha</Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// Tela de acesso padrão HopeXT — todo cliente novo entra com a marca da
// HopeXT (logo/cores padrão vindos do branding context), no mesmo padrão
// visual do site público e do Portal HopeXT. Só passa a ficar diferente
// quando o cliente personaliza a própria marca (depois de fechar negócio).
function HopeXTLogin({ branding, email, setEmail, password, setPassword, submitting, onSubmit }: LoginFormProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hopeDark px-4 font-['Plus_Jakarta_Sans',sans-serif] text-gray-100">
      {/* Iluminação ambiente — mesmo padrão do site público e do Portal HopeXT */}
      <div className="pointer-events-none absolute -left-[10%] -top-[10%] h-[500px] w-[500px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(157,78,221,0.20) 0%, rgba(0,0,0,0) 70%)" }} />
      <div className="pointer-events-none absolute -right-[10%] bottom-[-10%] h-[500px] w-[500px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(0,229,255,0.16) 0%, rgba(0,0,0,0) 70%)" }} />
      <div className="pointer-events-none absolute inset-0"
        style={{
          backgroundSize: "40px 40px",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
        }} />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-hopeCard p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        <div className="mb-6 flex flex-col items-center text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.portalName} className="mb-3 h-16 w-16 rounded-full object-cover"
              style={{ filter: "drop-shadow(0 0 25px rgba(0,229,255,0.28)) drop-shadow(0 0 40px rgba(157,78,221,0.22))" }} />
          ) : (
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-cyan-300">
              <Building2 className="h-8 w-8" />
            </div>
          )}
          <span className="font-brand text-2xl font-black tracking-tight"
            style={{ background: "linear-gradient(135deg,#00E5FF 0%,#a855f7 50%,#ec4899 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {branding.portalName}
          </span>
          <p className="mt-1 text-sm text-gray-400">Acessar Sistema</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300">E-mail</label>
            <input
              id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0d0d1a]/80 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-gray-300">Senha</label>
              <Link to="/forgot-password" className="text-xs text-cyan-400 transition-colors hover:text-cyan-300">Esqueceu?</Link>
            </div>
            <input
              id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0d0d1a]/80 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-purple-600/30 transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: "linear-gradient(90deg,#00b4d8 0%,#8338ec 50%,#d946ef 100%)" }}>
            {submitting ? "Aguarde..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Login() {
  const { session, loading } = useAuth();
  const branding = useTenantBranding();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === "Email not confirmed") {
          toast({ title: "Acesso pendente", description: "Seu cadastro ainda não foi aprovado por um administrador. Aguarde a liberação do acesso.", variant: "destructive" });
          return;
        }
        throw error;
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formProps: LoginFormProps = { branding, email, setEmail, password, setPassword, submitting, onSubmit: handleSubmit };

  if (branding.slug === "transdata") {
    return <TransdataLogin {...formProps} />;
  }
  return <HopeXTLogin {...formProps} />;
}
