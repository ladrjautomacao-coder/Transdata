import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { Mail, Lock } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import LogoAnimation from "@/components/LogoAnimation";
import { InstallAppButton } from "@/pwa/InstallAppButton";
// Vídeo da entrada gerado na Runway (ver runway/LEIA-ME.md); a imagem é o primeiro quadro, usada enquanto carrega
import videoEntrada from "@/assets/entrada/entrada-login.mp4";
import posterEntrada from "@/assets/entrada/entrada-login.jpg";

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
      <div className="mt-2 flex justify-start">
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
    </section>
  );
}

function economizaDados() {
  try {
    return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  } catch {
    return false;
  }
}

/**
 * Fundo da entrada: vídeo em loop gerado na Runway (runway/), por trás de um véu escuro na cor da marca.
 * Quem pede menos animação no sistema ou economia de dados vê só a imagem parada; o vídeo pode ser pausado.
 */
function FundoEntrada() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [falhou, setFalhou] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const comVideo = !reduceMotion && !falhou && !economizaDados();

  useEffect(() => {
    const video = videoRef.current;
    if (!comVideo || !video) return;
    // o React não grava "muted" como atributo, e sem ele o Safari não toca sozinho
    video.muted = true;
    video.play().catch(() => setPausado(true));
  }, [comVideo]);

  const alternar = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPausado(false)).catch(() => setFalhou(true));
    } else {
      video.pause();
      setPausado(true);
    }
  };

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <img src={posterEntrada} alt="" className="h-full w-full object-cover" />
        {comVideo && (
          <video
            ref={videoRef}
            src={videoEntrada}
            poster={posterEntrada}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onPlaying={() => setRodando(true)}
            onError={() => setFalhou(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${rodando ? "opacity-100" : "opacity-0"}`}
          />
        )}
        <div className="absolute inset-0 bg-primary/30 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/80 lg:bg-gradient-to-r lg:from-black/85 lg:via-black/50 lg:to-black/25" />
      </div>
      {comVideo && (rodando || pausado) && (
        <button
          type="button"
          onClick={alternar}
          aria-label={pausado ? "Reproduzir o vídeo de fundo" : "Pausar o vídeo de fundo"}
          aria-pressed={pausado}
          title={pausado ? "Reproduzir o vídeo de fundo" : "Pausar o vídeo de fundo"}
          className="absolute bottom-4 left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white/80 transition-colors hover:bg-black/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      )}
    </>
  );
}

// Tela de acesso da Transdata: vídeo de fundo, apresentação à esquerda e o acesso à direita (textos do acesso originais).
function TransdataLogin({ branding, email, setEmail, password, setPassword, submitting, onSubmit }: LoginFormProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-black">
      <FundoEntrada />
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16 lg:py-12">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mx-auto w-full max-w-md text-white lg:mx-0 lg:max-w-xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">{branding.portalName}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Gestão de Projetos</h1>
          <div className="mt-5 lg:mt-8">
            <CorporateStatementCarousel tone="dark" />
          </div>
        </motion.section>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative z-10 mx-auto w-full max-w-md"
        >
          <Card className="w-full max-w-md border-primary/20 shadow-2xl">
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
                <p className="text-muted-foreground">
                  Ainda não tem acesso?{" "}
                  <Link to="/cadastro" className="font-semibold text-primary hover:underline">Criar conta</Link>
                </p>
              </div>
            </CardContent>
          </Card>
          {/* Instalar o portal como aplicativo — só aparece quando ainda não está instalado */}
          <div className="mt-4 w-full max-w-md">
            <InstallAppButton variant="login" />
          </div>
        </motion.div>
      </main>
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
  const location = useLocation();
  // volta para a página que pediu o login (ex.: link de um e-mail de alerta)
  const from = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
  const redirectTo = from?.pathname?.startsWith("/") && !from.pathname.startsWith("/login")
    ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`
    : "/";

  if (loading) return null;
  if (session) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === "Email not confirmed") {
          toast({ title: "Confirme seu e-mail", description: "Abra o link que enviamos para o seu e-mail para confirmar o cadastro (veja também o spam).", variant: "destructive" });
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
