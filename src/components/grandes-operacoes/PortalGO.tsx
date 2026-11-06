import { useEffect, useState } from "react";
import { Info, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { definirGerente, fetchGerentesProjetos, mensagemGo, type GoDados } from "@/lib/grandesOperacoes/dados";

const NENHUM = "nenhum";

/**
 * Qual Gerente de Projetos traz os projetos do portal para o Hub: todo projeto do cadastro de
 * projetos em que ele é o GP aparece aqui (o cliente é a razão social).
 */
export function PortalGO({ dados, podeEditar, onMudou }: { dados: GoDados; podeEditar: boolean; onMudou: () => Promise<unknown> }) {
  const [gps, setGps] = useState<{ id: string; full_name: string }[] | null>(null);
  const [gravando, setGravando] = useState(false);
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    // o nome do gerente atual aparece no botão, então a lista vem já ao abrir o Hub
    fetchGerentesProjetos().then(setGps).catch(() => setGps([]));
  }, []);
  const atual = gps?.find(g => g.id === dados.gerenteId);
  const doPortal = dados.projetos.filter(p => p.project_id).length;

  const escolher = async (v: string) => {
    setGravando(true);
    try {
      const n = await definirGerente(v === NENHUM ? null : v);
      await onMudou();
      const nome = gps?.find(g => g.id === v)?.full_name;
      toast.success(nome ? `Projetos de ${nome} no Hub` : "Nenhum GP traz projetos do portal agora", {
        description: `${n} ${n === 1 ? "projeto do portal está" : "projetos do portal estão"} no Hub.`,
      });
    } catch (err) {
      toast.error("Não foi possível mudar o GP de Grandes Operações.", { description: mensagemGo(err) });
    } finally {
      setGravando(false);
    }
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Link2 className="mr-1.5 h-4 w-4" />
          {atual ? <>Projetos do portal: <b className="ml-1 font-semibold">{atual.full_name.split(" ")[0]}</b></> : "Projetos do portal"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <p className="font-semibold">Projetos do cadastro do portal</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Todo projeto cadastrado em Projetos com este GP aparece aqui sozinho, com o cliente pela razão social. Hoje: {doPortal} {doPortal === 1 ? "projeto" : "projetos"}.
        </p>
        {podeEditar ? (
          <div className="mt-3">
            <Label className="text-xs" id="go-portal-gp">GP de Grandes Operações</Label>
            <Select value={dados.gerenteId ?? NENHUM} onValueChange={v => void escolher(v)} disabled={gravando || !gps}>
              <SelectTrigger className="mt-1.5" aria-labelledby="go-portal-gp">
                {gravando ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Sincronizando…</span> : <SelectValue placeholder="Carregando…" />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Nenhum</SelectItem>
                {/* gerente escolhido que saiu da Equipe continua na lista para aparecer o nome */}
                {dados.gerenteId && gps && !atual && <SelectItem value={dados.gerenteId}>GP fora da Equipe</SelectItem>}
                {gps?.map(g => <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-2 flex gap-1.5 text-[11.5px] text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              A lista mostra os Gerentes de Projetos ativos na Equipe. Quem não aparece precisa ser incluído em Equipe com essa função.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[12.5px]">GP de Grandes Operações: <b>{atual?.full_name ?? "nenhum"}</b></p>
        )}
      </PopoverContent>
    </Popover>
  );
}
