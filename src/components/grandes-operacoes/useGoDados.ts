import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/implantationScheduling";
import { fetchGoDados, fetchPodeEditar, type GoDados } from "@/lib/grandesOperacoes/dados";

// o Hub e o painel usam os mesmos dados: ao trocar de tela, mostra o que já tem e relê por trás
let cache: GoDados | null = null;
let cachePode = false;

/**
 * Dados do Hub de Grandes Operações (null enquanto carrega pela primeira vez) e se quem abriu
 * pode gravar. `atualizar` muda os dados na tela (ex.: o status trocado antes de o banco responder).
 */
export function useGoDados() {
  const [dados, setDados] = useState<GoDados | null>(cache);
  const [podeEditar, setPodeEditar] = useState(cachePode);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    setErro(null);
    Promise.all([fetchGoDados(), fetchPodeEditar().catch(() => false)])
      .then(([d, pode]) => { cache = d; cachePode = pode; setDados(d); setPodeEditar(pode); })
      .catch(e => setErro(errorMessage(e)));
  }, []);
  useEffect(recarregar, [recarregar]);
  const atualizar = useCallback((f: (d: GoDados) => GoDados) => setDados(d => {
    if (!d) return d;
    cache = f(d);
    return cache;
  }), []);
  return { dados, erro, recarregar, podeEditar, atualizar };
}
