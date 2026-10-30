import { useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_ORDEM, rotuloMes, temFiltro, type ChaveFiltro, type FiltrosDash } from "@/lib/dashboard";
import { statusLabels } from "@/lib/statusLabels";
import { teamRoleLabels } from "@/lib/teamRoleLabels";
import { cn } from "@/lib/utils";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lerIso = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : undefined);
const mesAno = (s: string) => rotuloMes(s.slice(0, 7)).replace("/", "/20");

/** Atalhos do período (pela data de contrato). */
function atalhos(): { rotulo: string; de: string | null; ate: string | null }[] {
  const hoje = new Date(), ano = hoje.getFullYear();
  const umAno = new Date(hoje); umAno.setFullYear(ano - 1);
  return [
    { rotulo: "Últimos 12 meses", de: iso(umAno), ate: iso(hoje) },
    { rotulo: "Este ano", de: `${ano}-01-01`, ate: `${ano}-12-31` },
    { rotulo: "Ano passado", de: `${ano - 1}-01-01`, ate: `${ano - 1}-12-31` },
    { rotulo: "Todo o período", de: null, ate: null },
  ];
}

function Campo({ id, rotulo, className, children }: { id: string; rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">{rotulo}</Label>
      {children}
    </div>
  );
}

function Escolha({ id, valor, onChange, todos, opcoes }: { id: string; valor: string; onChange: (v: string) => void; todos: string; opcoes: { v: string; l: string }[] }) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn("h-10", valor !== "all" && "border-primary/50 bg-primary/[0.04] font-medium")}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{todos}</SelectItem>
        {opcoes.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/**
 * Filtros do Dashboard: período (data de contrato), status, solução, estado, cidade, gerente e a
 * busca por nome ou código. Valem para todos os blocos.
 */
export function FiltrosDashboard({ f, mudar, limpar, opcoes, periodoTotal }: {
  f: FiltrosDash;
  mudar: (k: ChaveFiltro, v: string | null) => void;
  limpar: () => void;
  opcoes: { solucoes: string[]; estados: string[]; cidades: string[]; gerentes: string[] };
  /** Primeiro e último contrato (AAAA-MM-DD), para mostrar o período quando não há filtro. */
  periodoTotal: { de: string; ate: string } | null;
}) {
  const [aberto, setAberto] = useState(false);
  const faixa: DateRange | undefined = f.de || f.ate ? { from: lerIso(f.de), to: lerIso(f.ate) } : undefined;
  const textoPeriodo = f.de || f.ate
    ? `${f.de ? f.de.split("-").reverse().join("/") : "início"} – ${f.ate ? f.ate.split("-").reverse().join("/") : "hoje"}`
    : periodoTotal ? `${mesAno(periodoTotal.de)} – ${mesAno(periodoTotal.ate)}` : "Todo o período";

  return (
    <section aria-label="Filtros" className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Campo id="dash-periodo" rotulo="Período (data de contrato)" className="sm:col-span-2">
          <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
              <Button id="dash-periodo" variant="outline" className={cn("h-10 justify-start font-normal", (f.de || f.ate) && "border-primary/50 bg-primary/[0.04] font-medium")}>
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />{textoPeriodo}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex flex-col sm:flex-row">
                <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:flex-col sm:border-b-0 sm:border-r">
                  {atalhos().map(a => (
                    <Button key={a.rotulo} variant="ghost" size="sm" className="h-8 justify-start text-[13px]"
                      onClick={() => { mudar("de", a.de); mudar("ate", a.ate); setAberto(false); }}>{a.rotulo}</Button>
                  ))}
                </div>
                <Calendar mode="range" locale={ptBR} numberOfMonths={2} selected={faixa} defaultMonth={faixa?.from}
                  onSelect={r => { mudar("de", r?.from ? iso(r.from) : null); mudar("ate", r?.to ? iso(r.to) : null); }} />
              </div>
            </PopoverContent>
          </Popover>
        </Campo>
        <Campo id="dash-status" rotulo="Status">
          <Escolha id="dash-status" valor={f.status} onChange={v => mudar("status", v)} todos="Todos" opcoes={STATUS_ORDEM.map(s => ({ v: s, l: statusLabels[s] }))} />
        </Campo>
        <Campo id="dash-solucao" rotulo="Solução">
          <Escolha id="dash-solucao" valor={f.solucao} onChange={v => mudar("solucao", v)} todos="Todas" opcoes={opcoes.solucoes.map(s => ({ v: s, l: s }))} />
        </Campo>
        <Campo id="dash-estado" rotulo="Estado">
          <Escolha id="dash-estado" valor={f.estado} onChange={v => { mudar("estado", v); mudar("cidade", "all"); }} todos="Todos" opcoes={opcoes.estados.map(s => ({ v: s, l: s }))} />
        </Campo>
        <Campo id="dash-cidade" rotulo="Cidade">
          <Escolha id="dash-cidade" valor={f.cidade} onChange={v => mudar("cidade", v)} todos="Todas" opcoes={opcoes.cidades.map(s => ({ v: s, l: s }))} />
        </Campo>
        <Campo id="dash-gerente" rotulo={teamRoleLabels.manager ?? "Gerente"} className="lg:col-span-2">
          <Escolha id="dash-gerente" valor={f.gerente} onChange={v => mudar("gerente", v)} todos="Todos" opcoes={opcoes.gerentes.map(s => ({ v: s, l: s }))} />
        </Campo>
        <Campo id="dash-busca" rotulo="Projeto" className="sm:col-span-2 lg:col-span-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="dash-busca" type="search" className={cn("h-10 pl-9", f.busca && "border-primary/50 bg-primary/[0.04]")} placeholder="Buscar por nome ou código"
              value={f.busca} onChange={e => mudar("busca", e.target.value)} />
          </div>
        </Campo>
        <div className="flex items-end">
          {temFiltro(f) && (
            <Button variant="ghost" className="h-10 text-primary" onClick={limpar}><X className="mr-1.5 h-4 w-4" />Limpar filtros</Button>
          )}
        </div>
      </div>
    </section>
  );
}
