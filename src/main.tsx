import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Instalações antigas do PWA (worker /sw.js e caches próprios) podiam restaurar uma tela
// obsoleta. O app atual usa /service-worker.js (Workbox, caches "workbox-*") com aviso de
// atualização; aqui removemos só o que é legado e mantemos o worker novo.
const LEGACY_WORKER_RELOAD_KEY = "transdata:legacy-worker-reloaded";
const CURRENT_WORKER = "/service-worker.js";

const workerUrl = (r: ServiceWorkerRegistration) => (r.active ?? r.waiting ?? r.installing)?.scriptURL ?? "";

async function removeLegacyOfflineState() {
  if (!("serviceWorker" in navigator)) return;

  const controller = navigator.serviceWorker.controller;
  const wasControlled = Boolean(controller && !controller.scriptURL.endsWith(CURRENT_WORKER));
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.filter((r) => workerUrl(r) !== "" && !workerUrl(r).endsWith(CURRENT_WORKER)).map((r) => r.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.allSettled(cacheNames.filter((name) => !name.startsWith("workbox-")).map((name) => caches.delete(name)));
  }

  if (wasControlled && sessionStorage.getItem(LEGACY_WORKER_RELOAD_KEY) !== "true") {
    sessionStorage.setItem(LEGACY_WORKER_RELOAD_KEY, "true");
    window.location.reload();
    return;
  }

  if (!wasControlled) {
    sessionStorage.removeItem(LEGACY_WORKER_RELOAD_KEY);
  }
}

void removeLegacyOfflineState().catch(() => {
  // Cache cleanup must never prevent the application from starting.
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento raiz da aplicação não encontrado.");
}

createRoot(rootElement).render(<App />);
