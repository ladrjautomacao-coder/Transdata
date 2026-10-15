import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    // Aplicativo instalável (PWA). O worker se chama service-worker.js para não
    // colidir com o antigo /sw.js (que só se autolimpa nas instalações legadas).
    // Atualização com aviso ("Nova versão disponível") — nunca prende tela antiga.
    VitePWA({
      strategies: "generateSW",
      filename: "service-worker.js",
      registerType: "prompt",
      injectRegister: false,
      manifest: false, // usa public/manifest.webmanifest
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        globIgnores: ["sw.js"],
        navigateFallback: "/index.html",
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
