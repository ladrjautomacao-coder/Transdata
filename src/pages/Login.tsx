import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { Mail, Lock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import LogoAnimation from "@/components/LogoAnimation";
import { InstallAppButton } from "@/pwa/InstallAppButton";

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

const CORPORATE_STATEMENTS = [
  { title: "Missão", text: "Fornecer soluções inovadoras de mobilidade urbana." },
  { title: "Visão", text: "Ser referência em sistemas de inteligência para transporte." },
  { title: "Valores", text: "Confiança, respeito, humildade nas relações e integridade nos negócios." },
];

function CorporateStatementCarousel({ tone, compact = false }: { tone: "dark" | "light"; compact?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(!!reduceMotion);
  const isDark = tone === "dark";
  const statement = CORPORATE_STATEMENTS[activeIndex];

  useEffect(() => {
    if (paused || reduceMotion) return;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % CORPORATE_STATEMENTS.length);
    }, 5200);
    return () => window.clearInterval(interval);
  }, [paused, reduceMotion]);

  return (
    <section
      aria-label="Missão, visão e valores da Transdata"
      className={`relative z-10 w-full max-w-lg border-l-2 py-3 pl-4 ${
        isDark ? "border-orange-400/70" : "border-[#4b1768]/50"
      } ${compact ? "max-w-md" : ""}`}
    >
      <div className="mb-2 flex justify-end">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" role="group" aria-label="Selecionar declaração institucional">
            {CORPORATE_STATEMENTS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Mostrar ${item.title}`}
                aria-pressed={activeIndex === index}
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 rounded-full transition-all ${activeIndex === index ? "w-5" : "w-1.5"} ${
                  isDark ? "bg-orange-300/80" : "bg-[#4b1768]/50"
                }`}
              />
            ))}
          </div>
          {!reduceMotion && (
            <button
              type="button"
              aria-label={paused ? "Retomar animação" : "Pausar animação"}
              aria-pressed={paused}
              title={paused ? "Retomar animação" : "Pausar animação"}
              onClick={() => setPaused((value) => !value)}
              className={`rounded-sm p-1 transition-colors ${isDark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-[#4b1768]/70 hover:bg-[#4b1768]/10 hover:text-[#4b1768]"}`}
            >
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
      <div className={`relative flex h-20 items-center overflow-hidden ${compact ? "h-16" : ""}`} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={statement.title}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -18 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
            className="w-full"
          >
            <p className={`mb-1 text-xs font-bold uppercase tracking-[0.2em] ${isDark ? "text-orange-300" : "text-[#4b1768]"}`}>
              {statement.title}
            </p>
            <p className={`text-base font-medium leading-relaxed sm:text-lg ${isDark ? "text-white/90" : "text-slate-700"}`}>
              {statement.text}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// Tela de acesso da Transdata (cliente fundador) — layout e texto originais, intocados.
function TransdataLogin({ branding, email, setEmail, password, setPassword, submitting, onSubmit }: LoginFormProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-auto bg-background px-4 py-8">
      <div className="mb-3 w-full max-w-md">
        <CorporateStatementCarousel tone="light" compact />
      </div>
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card className="w-full max-w-md shadow-lg border-primary/20">
            <CardHeader className="text-center space-y-3">
              <LogoAnimation tone="light" />
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
      {/* Instalar o portal como aplicativo — só aparece quando ainda não está instalado */}
      <div className="mt-4 w-full max-w-md">
        <InstallAppButton variant="login" />
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

  return <TransdataLogin {...formProps} />;
}
