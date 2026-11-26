import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDomGuard } from "./lib/domGuard";

// antes do primeiro render: tradutor/extensão do navegador não pode derrubar as telas
installDomGuard();

// O CS Flow abre em /transdata/ no endereço do portal, que divide com o Gerenciador, o Transmobile
// e o Roadmap. Por isso nada aqui mexe em service workers ou caches de fora de /transdata/: o
// worker do app (service-worker.js) só vale para /transdata/, e as instalações antigas ficaram no
// endereço anterior, onde um worker próprio as desliga (ver vite.config.ts).

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento raiz da aplicação não encontrado.");
}

createRoot(rootElement).render(<App />);
