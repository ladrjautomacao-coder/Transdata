import { createContext, useContext, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { itemDoMenu } from "@/components/sidebar/menu";
import { cn } from "@/lib/utils";

/** A tela pode acrescentar um último trecho ao caminho (ex.: o projeto aberto). */
const MigalhaCtx = createContext<(titulo: string | null) => void>(() => { /* fora do portal */ });
export const MigalhaProvider = MigalhaCtx.Provider;

/** Mostra `titulo` no fim do caminho de navegação do topo enquanto a tela estiver aberta. */
export function useMigalha(titulo: string | null | undefined) {
  const definir = useContext(MigalhaCtx);
  useEffect(() => {
    definir(titulo ?? null);
    return () => definir(null);
  }, [titulo, definir]);
}

/**
 * Caminho de navegação do topo: grupo do menu › tela › (trecho da tela). No celular, só o último.
 */
export function Migalhas({ extra, fallback }: { extra: string | null; fallback: ReactNode }) {
  const { pathname } = useLocation();
  const atual = itemDoMenu(pathname);
  if (!atual) return <span className="truncate text-sm font-semibold">{fallback}</span>;
  const partes: { texto: string; para?: string }[] = [
    { texto: atual.grupo.label },
    { texto: atual.item.title, para: extra ? atual.item.url : undefined },
    ...(extra ? [{ texto: extra }] : []),
  ];
  // o grupo que tem um item só com o mesmo nome (ex.: Gestão de Contratos) não se repete
  const visiveis = partes.filter((p, i) => !(i === 0 && p.texto === partes[1].texto));
  return (
    <nav aria-label="Caminho" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
        {visiveis.map((p, i) => {
          const ultima = i === visiveis.length - 1;
          return (
            <li key={`${p.texto}-${i}`} className={cn("flex min-w-0 items-center gap-1.5", !ultima && "hidden md:flex")}>
              {p.para && !ultima
                ? <Link to={p.para} className="truncate transition-colors hover:text-foreground">{p.texto}</Link>
                : <span className={cn("truncate", ultima && "font-semibold text-foreground")} aria-current={ultima ? "page" : undefined}>{p.texto}</span>}
              {!ultima && <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
