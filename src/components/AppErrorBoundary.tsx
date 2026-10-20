import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Arquivo de uma versão anterior do portal que não existe mais (aplicativo com cache antigo). */
const CHUNK_RE = /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Loading chunk \S+ failed/i;

/** Grava o erro de tela em client_error_logs. Melhor esforço: nunca lança, nunca bloqueia. */
export async function reportClientError(error: Error, componentStack?: string | null) {
  try {
    const key = `erro-tela:${window.location.pathname}:${error?.message ?? ""}`.slice(0, 200);
    if (sessionStorage.getItem(key)) return; // o mesmo erro na mesma tela, uma vez por sessão
    sessionStorage.setItem(key, "1");
  } catch { /* sem sessionStorage: segue */ }
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const build = Array.from(document.scripts).map(s => s.src).find(s => /\/assets\/index-/.test(s)) ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("client_error_logs").insert({
      user_id: data.user.id,
      user_email: data.user.email ?? null,
      path: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      message: String(error?.message ?? error).slice(0, 2000),
      stack: (error?.stack ?? "").slice(0, 8000),
      component_stack: (componentStack ?? "").slice(0, 8000),
      user_agent: navigator.userAgent.slice(0, 500),
      app_build: build ? build.slice(0, 300) : null,
    });
  } catch { /* o registro nunca pode atrapalhar o usuário */ }
}

interface Props {
  children: ReactNode;
  /** Muda ao trocar de tela: limpa o erro para a próxima tela abrir normalmente. */
  resetKey?: string;
  /** Ocupa a página inteira (proteção geral do portal). */
  fullPage?: boolean;
}

/** Em vez de página em branco, mostra o erro com opções de recuperar e registra para o suporte. */
export class AppErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro de tela:", error, info.componentStack);
    // versão antiga em cache pedindo um arquivo que não existe mais: recarrega uma vez
    if (CHUNK_RE.test(error?.message ?? "")) {
      try {
        if (!sessionStorage.getItem("recarregou-versao")) {
          sessionStorage.setItem("recarregou-versao", "1");
          window.location.reload();
          return;
        }
      } catch { /* segue para o aviso */ }
    }
    void reportClientError(error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={`flex items-center justify-center px-4 ${this.props.fullPage ? "min-h-screen bg-background" : "py-16"}`}>
        <div role="alert" className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold">Esta tela encontrou um erro</h2>
          <p className="mt-1 text-sm text-muted-foreground">O problema foi registrado para o suporte. Tente de novo ou recarregue o portal.</p>
          <p className="mt-3 break-words rounded-lg bg-muted px-3 py-2 text-left font-mono text-[11px] text-muted-foreground">{error.message || String(error)}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>
              <RotateCcw className="mr-1.5 h-4 w-4" />Tentar novamente
            </Button>
            <Button variant="outline" size="sm" onClick={() => { window.location.href = "/"; }}>
              <Home className="mr-1.5 h-4 w-4" />Ir para o início
            </Button>
            <Button size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Recarregar o portal
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
