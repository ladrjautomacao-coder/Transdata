import { useEffect, useState } from "react";

/** Tema claro/escuro do portal, guardado neste navegador (chave "theme"). */
export function useTema() {
  const [escuro, setEscuro] = useState(() => {
    try { return localStorage.getItem("theme") === "dark"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    try { localStorage.setItem("theme", escuro ? "dark" : "light"); } catch { /* sem armazenamento: vale só nesta visita */ }
  }, [escuro]);

  return { escuro, alternar: () => setEscuro(e => !e) };
}
