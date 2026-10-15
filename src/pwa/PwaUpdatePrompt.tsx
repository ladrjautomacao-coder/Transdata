import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Registra o service worker do aplicativo e avisa quando há versão nova publicada.
 * Nada é trocado sozinho: a pessoa toca em "Atualizar" (assim não perde o que estiver
 * preenchendo) — e a cada 30 min, ou ao voltar para o app, conferimos se há versão nova.
 */
export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => { void registration.update(); }, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast("Nova versão do portal disponível", {
      id: "pwa-update",
      description: "Atualize para ver as últimas melhorias.",
      duration: Infinity,
      action: { label: "Atualizar", onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
