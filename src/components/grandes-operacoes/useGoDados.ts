import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/implantationScheduling";
import { fetchGoDados, type GoDados } from "@/lib/grandesOperacoes/dados";

// o Hub e o painel usam os mesmos dados: ao trocar de tela, mostra o que já tem e relê por trás
let cache: GoDados | null = null;

/** Dados do Hub de Grandes Operações (null enquanto carrega pela primeira vez). */
export function useGoDados() {
  const [dados, setDados] = useState<GoDados | null>(cache);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setErro(null);
    fetchGoDados()
      .then(d => { cache = d; setDados(d); })
      .catch(e => setErro(errorMessage(e)));
  }, []);
  useEffect(recarregar, [recarregar]);
  return { dados, erro, recarregar };
}
