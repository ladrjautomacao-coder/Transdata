import { useEffect, useState } from "react";
import { Download, PlusSquare, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// O evento pode chegar antes de qualquer tela montar: guardamos em nível de módulo.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach(l => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach(l => l());
  });
}

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Estado da instalação: Android/computador usam o convite do navegador; iPhone precisa do passo a passo. */
export function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const installed = typeof window !== "undefined" && isStandalone();
  return {
    canInstall: !installed && (!!deferred || isIos()),
    ios: isIos(),
    install: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") deferred = null;
      return outcome === "accepted";
    },
  };
}

/** Botão "Instalar app" — some quando o portal já está instalado. */
export function InstallAppButton({ variant = "header" }: { variant?: "header" | "inline" }) {
  const { canInstall, ios, install } = useInstallApp();
  const [iosHelp, setIosHelp] = useState(false);
  if (!canInstall) return null;

  const onClick = () => { if (ios) setIosHelp(true); else void install(); };

  return (
    <>
      {variant === "header" ? (
        <Button variant="ghost" size="sm" onClick={onClick} title="Instalar o portal como aplicativo"
          className="h-8 gap-1.5 px-2 text-white hover:bg-white/15 hover:text-white">
          <Download className="h-4 w-4" /><span className="hidden text-xs sm:inline">Instalar app</span>
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onClick}><Download className="mr-1.5 h-4 w-4" />Instalar aplicativo</Button>
      )}
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar no iPhone</DialogTitle>
            <DialogDescription>Em 3 passos, pelo Safari:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Share className="h-4 w-4" /></span>
              Toque em <b>Compartilhar</b> (o quadrado com a seta, na barra do Safari).</li>
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PlusSquare className="h-4 w-4" /></span>
              Escolha <b>Adicionar à Tela de Início</b>.</li>
            <li className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Download className="h-4 w-4" /></span>
              Toque em <b>Adicionar</b>. O ícone da Transdata aparece na tela inicial — entre por ele.</li>
          </ol>
          <p className="text-[11px] text-muted-foreground">No app instalado o login é separado do Safari: entre uma vez com seu usuário.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
