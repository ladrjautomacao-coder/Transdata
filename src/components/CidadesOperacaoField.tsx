import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Constants } from "@/integrations/supabase/types";
import { municipiosDaUf, normalizarMunicipio } from "@/lib/coberturaOperadoras";
import { cidadeOperacaoTexto, incluirCidade, type CidadeOperacao } from "@/lib/cidadesOperacao";
import { cn } from "@/lib/utils";

type Municipio = { codIbge: number; nome: string };
// municípios por UF: a lista não muda durante o uso da tela
const cache = new Map<string, Promise<Municipio[]>>();
const municipios = (uf: string) => {
  if (!cache.has(uf)) cache.set(uf, municipiosDaUf(uf).catch(e => { cache.delete(uf); throw e; }));
  return cache.get(uf)!;
};

/**
 * Cidades da operação do projeto: UF e município da lista do IBGE (a mesma da cobertura da Anatel),
 * uma ou mais. Vazio: vale a cidade do contrato.
 */
export function CidadesOperacaoField({ value, onChange, cidadeContrato, ufContrato, compacto, disabled }: {
  value: CidadeOperacao[];
  onChange: (cidades: CidadeOperacao[]) => void;
  /** Cidade e UF do contrato, para o atalho "usar a cidade do contrato". */
  cidadeContrato?: string;
  ufContrato?: string | null;
  /** Rótulo pequeno (tela de detalhe do projeto). */
  compacto?: boolean;
  disabled?: boolean;
}) {
  const [uf, setUf] = useState<string>(ufContrato ?? "");
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Municipio[] | null>(null);
  const [erro, setErro] = useState(false);
  const [sugestao, setSugestao] = useState<CidadeOperacao | null>(null);

  useEffect(() => {
    if (!uf) { setLista(null); return; }
    let vivo = true;
    setLista(null); setErro(false);
    municipios(uf).then(l => { if (vivo) setLista(l); }).catch(() => { if (vivo) { setErro(true); setLista([]); } });
    return () => { vivo = false; };
  }, [uf]);

  // atalho: a cidade do contrato, se estiver na lista do IBGE
  useEffect(() => {
    setSugestao(null);
    if (!ufContrato || !cidadeContrato?.trim()) return;
    let vivo = true;
    const alvo = normalizarMunicipio(cidadeContrato);
    municipios(ufContrato).then(l => {
      const m = l.find(x => normalizarMunicipio(x.nome) === alvo);
      if (vivo && m) setSugestao({ cod_ibge: m.codIbge, municipio: m.nome, uf: ufContrato });
    }).catch(() => { /* sem atalho */ });
    return () => { vivo = false; };
  }, [cidadeContrato, ufContrato]);

  const adicionar = (c: CidadeOperacao) => { onChange(incluirCidade(value, c)); setAberto(false); };
  const remover = (cod: number) => onChange(value.filter(c => c.cod_ibge !== cod));
  const mostrarSugestao = sugestao && !value.some(c => c.cod_ibge === sugestao.cod_ibge);

  return (
    <div className="space-y-2">
      <Label htmlFor="op-cidades-uf" className={cn(compacto && "text-xs text-muted-foreground")}>Cidades da operação</Label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Cidades da operação escolhidas">
          {value.map(c => (
            <li key={c.cod_ibge} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.07] py-0.5 pl-2.5 pr-1 text-[13px] font-medium">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />{cidadeOperacaoTexto(c)}
              <button type="button" disabled={disabled} onClick={() => remover(c.cod_ibge)} aria-label={`Remover ${cidadeOperacaoTexto(c)}`}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={uf || undefined} onValueChange={setUf} disabled={disabled}>
          <SelectTrigger id="op-cidades-uf" className="h-9 w-24" aria-label="UF da cidade da operação"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            {Constants.public.Enums.brazilian_state.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9" disabled={disabled || !uf}>
              <Plus className="mr-1.5 h-4 w-4" />Adicionar cidade
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder={`Buscar município de ${uf}...`} />
              <CommandList>
                {lista === null ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando os municípios…</div>
                ) : (
                  <>
                    <CommandEmpty className="px-3 py-3 text-sm text-muted-foreground">{erro ? "Não foi possível carregar a lista. Feche e abra de novo." : "Nenhum município com esse nome."}</CommandEmpty>
                    <CommandGroup>
                      {lista.map(m => (
                        <CommandItem key={m.codIbge} value={m.nome} disabled={value.some(c => c.cod_ibge === m.codIbge)}
                          onSelect={() => adicionar({ cod_ibge: m.codIbge, municipio: m.nome, uf })}>
                          {m.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {mostrarSugestao && (
          <Button type="button" variant="ghost" className="h-9 px-2.5 text-[13px] text-primary" disabled={disabled} onClick={() => adicionar(sugestao)}>
            <Plus className="mr-1 h-3.5 w-3.5" />{cidadeOperacaoTexto(sugestao)} (cidade do contrato)
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Onde a operação roda, uma ou mais cidades. O mapa de calor das operadoras analisa cada uma. Se ficar vazio, vale a cidade do contrato.</p>
    </div>
  );
}
