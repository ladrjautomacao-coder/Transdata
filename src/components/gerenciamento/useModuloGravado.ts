import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/implantationScheduling";

export type Gravacao = { status: "ok" | "salvando" | "erro"; em: string | null };

/**
 * Estado de um módulo do Gerenciamento gravado sozinho no banco: cada mudança vai ~0,6 s depois,
 * uma gravação por vez. Nada é gravado antes de `carregar` (evita gravar um módulo vazio por cima
 * do que está no banco).
 */
export function useModuloGravado<T>(gravar: (estado: T) => Promise<string>, vazio: () => T) {
  const [estado, setEstado] = useState<T>(vazio);
  const [gravacao, setGravacao] = useState<Gravacao>({ status: "ok", em: null });
  const gravado = useRef<string | null>(null); // JSON do que está no banco (null: ainda carregando)
  const atual = useRef(estado);
  atual.current = estado;
  const gravarRef = useRef(gravar);
  gravarRef.current = gravar;
  const agendada = useRef<number | null>(null);
  const emAndamento = useRef(false);
  const deNovo = useRef(false);
  const salvar = useRef(async () => { /* definida abaixo */ });
  salvar.current = async () => {
    if (agendada.current) { clearTimeout(agendada.current); agendada.current = null; }
    if (emAndamento.current) { deNovo.current = true; return; }
    const snapshot = atual.current, json = JSON.stringify(snapshot);
    if (gravado.current === null || json === gravado.current) return;
    emAndamento.current = true;
    setGravacao(g => ({ ...g, status: "salvando" }));
    try {
      const em = await gravarRef.current(snapshot);
      gravado.current = json;
      setGravacao({ status: "ok", em });
    } catch (err) {
      setGravacao(g => ({ ...g, status: "erro" }));
      toast.error("Não foi possível salvar o módulo.", { description: errorMessage(err) });
    } finally {
      emAndamento.current = false;
      // mudou de novo enquanto gravava: grava a versão mais nova
      if (deNovo.current) { deNovo.current = false; void salvar.current(); }
    }
  };
  useEffect(() => {
    if (gravado.current === null || JSON.stringify(estado) === gravado.current) return;
    if (agendada.current) clearTimeout(agendada.current);
    agendada.current = window.setTimeout(() => { void salvar.current(); }, 600);
  }, [estado]);
  useEffect(() => {
    // fechar a aba com marcação ainda não gravada: o navegador pede confirmação
    const aviso = (e: BeforeUnloadEvent) => {
      if (gravado.current !== null && JSON.stringify(atual.current) !== gravado.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", aviso);
    return () => {
      window.removeEventListener("beforeunload", aviso);
      // "Trocar projeto" logo depois de marcar: grava o que estava esperando
      void salvar.current();
    };
  }, []);

  /** O que veio do banco: passa a ser a base das próximas gravações. */
  const carregar = useCallback((e: T, salvoEm: string | null) => {
    gravado.current = JSON.stringify(e);
    setEstado(e);
    setGravacao({ status: "ok", em: salvoEm });
  }, []);
  /** Recarregando do banco: nada é gravado até o próximo `carregar`. */
  const descarregar = useCallback(() => { gravado.current = null; }, []);
  const salvarAgora = useCallback(() => { void salvar.current(); }, []);

  return { estado, setEstado, gravacao, carregar, descarregar, salvarAgora };
}

/** Situação das gravações de vários módulos juntas (erro e "salvando" aparecem primeiro). */
export function juntarGravacoes(gs: Gravacao[]): Gravacao {
  const em = gs.map(g => g.em).filter((v): v is string => !!v).sort().pop() ?? null;
  const status = gs.some(g => g.status === "erro") ? "erro" : gs.some(g => g.status === "salvando") ? "salvando" : "ok";
  return { status, em };
}
