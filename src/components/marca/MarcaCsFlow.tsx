import { useId } from "react";
import marcaT from "@/assets/logo-transdata-t.png";
import { cn } from "@/lib/utils";

/**
 * O "T" do logo Transdata inteiro (com o traço de cima completo) num quadrado no roxo do fundo do
 * logo. O arquivo é só o "T", recortado do logo sem as letras do nome.
 */
export function MarcaT({ tamanho = "md" }: { tamanho?: "md" | "lg" }) {
  return (
    <span aria-hidden className={cn(
      "flex shrink-0 items-center justify-center overflow-hidden bg-marca-logo ring-1 ring-marca-lilas/30",
      tamanho === "lg" ? "h-12 w-12 rounded-[13px] sm:h-14 sm:w-14 sm:rounded-2xl" : "h-9 w-9 rounded-[10px]",
    )}>
      <img src={marcaT} alt="" className={tamanho === "lg" ? "w-9 sm:w-11" : "w-7"} />
    </span>
  );
}

/**
 * Logotipo "CSflow": "CS" forte, "flow" em lilás e uma onda de fluxo no laranja-rosa do logo embaixo.
 * O tamanho vem do font-size (`className`, ex.: text-[22px]); a onda acompanha. Feito para fundo escuro.
 */
export function LogotipoCsFlow({ className }: { className?: string }) {
  const id = useId();
  return (
    <span aria-hidden className={cn("relative whitespace-nowrap pb-[0.27em] font-bold leading-[1.05] tracking-[-0.03em] text-white", className)}>
      CS<span className="relative font-medium text-marca-lilas-claro">flow
        <svg viewBox="0 0 44 7" fill="none" className="absolute" style={{ width: "2.32em", height: "0.37em", bottom: "-0.32em", left: "-0.23em" }}>
          <defs>
            <linearGradient id={id} x1="0" x2="1">
              <stop offset="0" stopColor="hsl(var(--marca-laranja))" />
              <stop offset="1" stopColor="hsl(var(--marca-rosa))" />
            </linearGradient>
          </defs>
          <path d="M1 4.5 C 8 0.5, 13 0.5, 20 3.5 S 33 6.5, 43 1.5" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}
