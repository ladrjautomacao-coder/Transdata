import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// O portal abre dentro do endereço do Gerenciador Transdata (portal principal), em /transdata/,
// e divide com ele o mesmo login. O Gerenciador repassa /transdata/* para este projeto da Vercel,
// que por isso publica tudo dentro de dist/transdata.
const BASE = "/transdata/";
const PORTAL = "https://gerenciador-transdata.vercel.app";
const ENDERECO_ANTIGO = "projetostransdata.vercel.app";

/**
 * Endereço antigo (projetostransdata.vercel.app):
 * - qualquer página manda para o mesmo caminho no portal, com o "#" (links de redefinir senha);
 * - quem tem o app instalado recebe um service worker que apaga a cópia guardada, se desliga e
 *   recarrega a página, que então segue para o portal;
 * - quem abrir /transdata/ direto no endereço antigo também é levado ao portal.
 */
function enderecoAntigo(): Plugin {
  const redirecionar = `${PORTAL}${BASE.slice(0, -1)}`;
  const pagina = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CS Flow mudou de endereço</title>
<script>location.replace(${JSON.stringify(redirecionar)} + location.pathname + location.search + location.hash);</script>
</head><body style="font-family:system-ui,sans-serif;padding:24px">
<p>O CS Flow agora abre pelo portal da Transdata: <a href="${PORTAL}${BASE}">${PORTAL}${BASE}</a></p>
</body></html>
`;
  const desligar = `// Endereço antigo do CS Flow: desliga a versão instalada e recarrega (a página segue para o portal).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) await caches.delete(nome);
    await self.registration.unregister();
    await self.clients.claim().catch(() => {});
    for (const cliente of await self.clients.matchAll({ type: "window" })) cliente.navigate(cliente.url);
  })());
});
`;
  return {
    name: "endereco-antigo",
    apply: "build",
    transformIndexHtml() {
      return [{
        tag: "script",
        injectTo: "head-prepend",
        children: `if (location.hostname === ${JSON.stringify(ENDERECO_ANTIGO)}) location.replace(${JSON.stringify(PORTAL)} + location.pathname + location.search + location.hash);`,
      }];
    },
    writeBundle() {
      const raiz = path.resolve(__dirname, "dist");
      fs.mkdirSync(raiz, { recursive: true });
      fs.writeFileSync(path.join(raiz, "endereco-antigo.html"), pagina);
      // /service-worker.js é o worker atual do endereço antigo; /sw.js, o das instalações mais velhas
      for (const nome of ["service-worker.js", "sw.js"]) fs.writeFileSync(path.join(raiz, nome), desligar);
      // o logo dos e-mails já enviados aponta para o endereço antigo (/email/...)
      fs.cpSync(path.resolve(__dirname, "public/email"), path.join(raiz, "email"), { recursive: true });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: BASE,
  build: {
    outDir: `dist${BASE.slice(0, -1)}`,
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    enderecoAntigo(),
    // Aplicativo instalável (PWA). O worker se chama service-worker.js e vale só para /transdata/.
    // Atualização com aviso ("Nova versão disponível") — nunca prende tela antiga.
    VitePWA({
      strategies: "generateSW",
      filename: "service-worker.js",
      registerType: "prompt",
      injectRegister: false,
      manifest: false, // usa public/manifest.webmanifest
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query", "recharts"],
  },
}));
