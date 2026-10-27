import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Copy, Download, ExternalLink, Globe2, Mail, MapPin, RadioTower, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { GerProject, Modulo01Estado } from "@/lib/gerenciamento";
import { errorMessage } from "@/lib/implantationScheduling";
import { copiarEmail } from "@/lib/emailOutlook";
import { svgParaPng } from "@/lib/svgParaPng";
import { cidadeOperacaoTexto, lerCidadesOperacao } from "@/lib/cidadesOperacao";
import {
  NOME_OPERADORA, assuntoCobertura, buscarCobertura, buscarSetores, dadosAtrasados, emailHtmlCobertura, emailTextoCobertura, enviarMapa,
  mailtoCobertura, municipiosDaUf, outlookWebCobertura, pctTexto, periodoTexto, recomendada,
  type BlocoCobertura, type CoberturaMunicipio, type OperadoraCobertura, type ResultadoCobertura, type SetoresMunicipio,
} from "@/lib/coberturaOperadoras";
import { Fixo, Grupo, PassoColar } from "./DataCenterEmailDialog";
import { MapaCoberturaSvg } from "./MapaCoberturaSvg";

type EstadoCarrier = Modulo01Estado["carrier"];
/** Mapa de uma cidade: a imagem gerada (ou por que não há imagem). */
type MapaInfo = { png: Blob | null; previa: string | null; semMapa: boolean; falha: boolean };

/** Aviso no lugar do conteúdo (fora do Brasil, sem carga, erro). */
function Aviso({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-[13px] text-amber-900 dark:text-amber-100">
      <span className="mt-0.5 shrink-0">{icone}</span>
      <div className="min-w-0 space-y-2"><p className="font-semibold">{titulo}</p>{children}</div>
    </div>
  );
}

const nomeArquivo = (d: CoberturaMunicipio) =>
  `mapa-cobertura-${d.municipio.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${d.uf.toLowerCase()}.png`;

/** Tabela Claro × Vivo de uma cidade, com a recomendada em destaque. */
function Comparativo({ d, rec }: { d: CoberturaMunicipio; rec: OperadoraCobertura | null }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[420px] text-[13px] tabular-nums">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-3 py-2 text-left font-semibold">Operadora</th><th className="px-3 py-2 text-right font-semibold">4G · área</th><th className="px-3 py-2 text-right font-semibold">4G · moradores</th><th className="px-3 py-2 text-right font-semibold">5G · área</th><th className="px-3 py-2 text-right font-semibold">5G · moradores</th></tr>
        </thead>
        <tbody className="divide-y">
          {d.resumo.map(r => (
            <tr key={r.operadora} className={r.operadora === rec ? "bg-emerald-500/[0.08]" : ""}>
              <td className="px-3 py-2 font-semibold">
                <span className="inline-flex flex-wrap items-center gap-1.5">{NOME_OPERADORA[r.operadora]}
                  {r.operadora === rec && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">Recomendada</span>}
                </span>
              </td>
              <td className={`px-3 py-2 text-right ${r.operadora === rec ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""}`}>{pctTexto(r.area4g)}</td>
              <td className="px-3 py-2 text-right">{pctTexto(r.moradores4g)}</td>
              <td className="px-3 py-2 text-right">{pctTexto(r.area5g)}</td>
              <td className="px-3 py-2 text-right">{pctTexto(r.moradores5g)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mapa de calor de uma cidade: carrega os setores, desenha e gera o PNG (avisa o pai). */
function MapaCidade({ d, rec, onMapa }: { d: CoberturaMunicipio; rec: OperadoraCobertura | null; onMapa: (cod: number, m: MapaInfo) => void }) {
  const [setores, setSetores] = useState<SetoresMunicipio | null | undefined>(undefined); // undefined: carregando; null: sem mapa
  const [previa, setPrevia] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let vivo = true;
    buscarSetores(d.codIbge).then(s => { if (vivo) setSetores(s); }).catch(() => { if (vivo) setSetores(null); });
    return () => { vivo = false; };
  }, [d.codIbge]);
  useEffect(() => { if (setores === null) onMapa(d.codIbge, { png: null, previa: null, semMapa: true, falha: false }); }, [setores, d.codIbge, onMapa]);
  // depois de desenhar o mapa, gera o PNG da prévia (e do download)
  useEffect(() => {
    if (!setores || !svgRef.current) return;
    let url: string | null = null, vivo = true;
    svgParaPng(svgRef.current).then(png => {
      if (!vivo) return;
      url = URL.createObjectURL(png);
      setPrevia(url);
      onMapa(d.codIbge, { png, previa: url, semMapa: false, falha: false });
    }).catch(() => { if (vivo) onMapa(d.codIbge, { png: null, previa: null, semMapa: false, falha: true }); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); setPrevia(null); };
  }, [setores, d.codIbge, onMapa]);

  if (setores === undefined) return <Skeleton className="aspect-[2/1] w-full rounded-lg" />;
  if (setores === null) return <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-muted-foreground">O mapa deste município ainda não foi gerado pela carga. O e-mail vai sem o mapa desta cidade.</p>;
  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border/70 bg-white">
        <MapaCoberturaSvg ref={svgRef} setores={setores} resumo={d.resumo} recomendada={rec} className="block h-auto w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="h-8" disabled={!previa} asChild={!!previa}>
          {previa ? <a href={previa} download={nomeArquivo(d)}><Download className="mr-1.5 h-3.5 w-3.5" />Baixar mapa (PNG)</a> : <span><Download className="mr-1.5 h-3.5 w-3.5" />Baixar mapa (PNG)</span>}
        </Button>
        <span className="text-[11px] text-muted-foreground">Para anexar, se preferir.</span>
      </div>
    </>
  );
}

/**
 * E-mail ao cliente com a cobertura Claro × Vivo de cada cidade da operação (dados da Anatel) e o
 * mapa de calor por setor censitário. Sem cidades da operação, vale a cidade do contrato.
 * O GP confere e abre no Outlook; copiar conclui a atividade.
 */
export function CoberturaEmailDialog({ open, onOpenChange, project, estado, onEstado, remetente, onCopiado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  estado: EstadoCarrier;
  onEstado: (patch: Partial<EstadoCarrier>) => void;
  remetente: string;
  /** Copiou o e-mail: a atividade fica feita, com a operadora recomendada de cada cidade. */
  onCopiado: (recomendadas: { cidade: string; operadora: OperadoraCobertura | null }[]) => void;
}) {
  const operacao = useMemo(() => lerCidadesOperacao(project.operation_cities), [project.operation_cities]);
  const [resultados, setResultados] = useState<ResultadoCobertura[] | null>(null); // null: carregando
  const [erro, setErro] = useState<string | null>(null);
  const [municipios, setMunicipios] = useState<{ codIbge: number; nome: string }[] | null>(null);
  const [geracao, setGeracao] = useState(0);
  const [mapas, setMapas] = useState<Record<number, MapaInfo>>({});
  const [publicos, setPublicos] = useState<Record<number, string>>({});
  const [falhaEnvio, setFalhaEnvio] = useState<Record<number, boolean>>({});
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setResultados(null); setErro(null); setMunicipios(null); setGeracao(g => g + 1);
    setMapas({}); setPublicos({}); setFalhaEnvio({}); setConferido(false); setAberto(false);
    try {
      const rs = operacao.length
        ? await Promise.all(operacao.map(c => buscarCobertura(project, c.cod_ibge)))
        : [await buscarCobertura(project, estado.codIbge)];
      setResultados(rs);
      const nf = !operacao.length && rs[0]?.status === "nao_encontrado" ? rs[0] : null;
      if (nf) municipiosDaUf(nf.uf).then(setMunicipios).catch(() => setMunicipios([]));
    } catch (err) {
      setErro(errorMessage(err));
    }
  }, [project, estado.codIbge, operacao]);
  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  const onMapa = useCallback((cod: number, m: MapaInfo) => setMapas(atual => ({ ...atual, [cod]: m })), []);

  const ok = (resultados ?? []).flatMap(r => (r.status === "ok" ? [r.dados] : []));
  // cidades da operação sem dados da Anatel ficam fora do e-mail (com aviso)
  const semDados = operacao.filter((_, i) => resultados?.[i] && resultados[i].status !== "ok");
  const blocos = (preview: boolean): BlocoCobertura[] => ok.map(d => ({
    dados: d, recomendada: recomendada(d.resumo), mapaUrl: publicos[d.codIbge] ?? (preview ? mapas[d.codIbge]?.previa ?? null : null),
  }));
  const temEmail = ok.length > 0;
  const base = temEmail ? { project, cidades: blocos(true), remetente } : null;
  const assunto = base ? assuntoCobertura(base) : "";
  const htmlPrevia = base ? emailHtmlCobertura(base) : "";
  const pendentesEnvio = ok.filter(d => mapas[d.codIbge]?.png && !publicos[d.codIbge] && !falhaEnvio[d.codIbge]);
  const mapaPronto = (d: CoberturaMunicipio) => { const m = mapas[d.codIbge]; return !!m && (m.semMapa || m.falha || !!publicos[d.codIbge] || !!falhaEnvio[d.codIbge]); };
  const preparando = conferido && pendentesEnvio.length > 0;
  const pronto = temEmail && conferido && ok.every(mapaPronto) && !preparando;
  const semImagem = ok.filter(d => mapas[d.codIbge]?.falha || falhaEnvio[d.codIbge]);

  // conferido e com as imagens prontas, sobe os mapas: assim copiar é imediato e o Outlook acha as imagens
  const chavesEnvio = pendentesEnvio.map(d => d.codIbge).join(",");
  useEffect(() => {
    if (!conferido || !chavesEnvio) return;
    let vivo = true;
    for (const d of ok.filter(x => chavesEnvio.split(",").includes(String(x.codIbge)))) {
      enviarMapa(project.id, d.periodo, d.codIbge, mapas[d.codIbge].png!)
        .then(url => { if (vivo) setPublicos(p => ({ ...p, [d.codIbge]: url })); })
        .catch(() => { if (vivo) setFalhaEnvio(f => ({ ...f, [d.codIbge]: true })); });
    }
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara pelo conjunto de cidades a enviar
  }, [conferido, chavesEnvio, project.id]);

  const copiar = async () => {
    if (!temEmail) return false;
    const e = { project, cidades: blocos(false), remetente };
    if (!(await copiarEmail(emailHtmlCobertura(e), emailTextoCobertura(e)))) {
      toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie.");
      return false;
    }
    onCopiado(ok.map(d => ({ cidade: `${d.municipio}/${d.uf}`, operadora: recomendada(d.resumo) })));
    return true;
  };
  const copiarSo = async () => {
    if (await copiar()) toast.success("E-mail copiado e atividade marcada como feita. No Outlook, clique no corpo e cole (Ctrl+V).");
  };
  const abrirOutlook = async () => {
    if (!(await copiar())) return;
    window.location.href = mailtoCobertura(estado.para, assunto);
    setAberto(true);
  };

  const r0 = resultados?.[0];
  let corpo: ReactNode;
  if (erro) {
    corpo = (
      <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo="Não foi possível carregar a cobertura.">
        <p>{erro}</p>
        <Button variant="outline" size="sm" className="h-8 bg-background" onClick={carregar}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
      </Aviso>
    );
  } else if (!resultados) {
    corpo = <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div>;
  } else if (r0?.status === "fora") {
    corpo = <Aviso icone={<Globe2 className="h-4 w-4" />} titulo="Projeto fora do Brasil."><p>Os dados de cobertura são da Anatel e valem só para municípios brasileiros.</p></Aviso>;
  } else if (!temEmail && resultados.every(r => r.status === "sem_dados")) {
    corpo = (
      <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo="Os dados de cobertura ainda não foram carregados no portal.">
        <p>A carga da Anatel roda toda segunda-feira, pelo GitHub (workflow "Cobertura das operadoras"). Depois da primeira carga, o e-mail fica disponível para todos os projetos com Carrier, ITS ou Gestão de Frota.</p>
      </Aviso>
    );
  } else if (!operacao.length && r0?.status === "nao_encontrado") {
    corpo = (
      <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo={`"${project.city}/${project.state ?? ""}" não está na lista de municípios da Anatel.`}>
        <p>Pode ser o nome escrito de outro jeito no cadastro. Escolha o município (ou cadastre as cidades da operação no projeto):</p>
        {municipios === null ? <Skeleton className="h-9 w-72" /> : (
          <Select onValueChange={v => onEstado({ codIbge: Number(v) })}>
            <SelectTrigger className="h-9 w-72 max-w-full bg-background text-foreground" aria-label="Município"><SelectValue placeholder={`Municípios de ${r0.uf}`} /></SelectTrigger>
            <SelectContent>{municipios.map(m => <SelectItem key={m.codIbge} value={String(m.codIbge)}>{m.nome}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Aviso>
    );
  } else if (!temEmail) {
    corpo = <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo="Nenhuma das cidades da operação tem dados da Anatel."><p>Confira as cidades da operação no cadastro do projeto.</p></Aviso>;
  } else {
    const periodo = ok[0].periodo;
    corpo = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6 lg:pr-5">
          <Grupo titulo={ok.length > 1 ? `Cidades da operação (${ok.length})` : "Cidade"}>
            <Fixo label={ok.length > 1 ? "Municípios" : "Município"} valor={ok.map(d => `${d.municipio}/${d.uf}`).join(", ")}
              origem={operacao.length ? "cidades da operação" : estado.codIbge ? "escolhido" : "cidade do contrato"} />
            <Fixo label="Dados da Anatel" valor={`período ${periodoTexto(periodo)}`} origem="oficial" />
            {dadosAtrasados(periodo) && (
              <p className="flex items-start gap-1.5 text-[12px] text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Dados de mais de dois trimestres atrás. A atualização automática pode ter parado: confira o GitHub Actions ("Cobertura das operadoras").</span>
              </p>
            )}
            {semDados.length > 0 && (
              <p className="flex items-start gap-1.5 text-[12px] text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Sem dados da Anatel para {semDados.map(cidadeOperacaoTexto).join(", ")}: {semDados.length > 1 ? "ficam" : "fica"} fora do e-mail.</span>
              </p>
            )}
            {!operacao.length && <p className="text-[11px] text-muted-foreground">Usando a cidade do contrato. Se a operação roda em outras cidades, cadastre as cidades da operação no projeto.</p>}
            {!operacao.length && estado.codIbge && <button type="button" className="text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => onEstado({ codIbge: null })}>Voltar à cidade do cadastro</button>}
          </Grupo>

          {ok.map(d => {
            const rec = recomendada(d.resumo);
            return (
              <section key={`${geracao}-${d.codIbge}`} aria-label={`${d.municipio}/${d.uf}`} className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3.5">
                <p className="flex items-center gap-1.5 text-[15px] font-semibold"><MapPin className="h-4 w-4 text-primary" aria-hidden />{d.municipio}/{d.uf}</p>
                <Comparativo d={d} rec={rec} />
                <MapaCidade d={d} rec={rec} onMapa={onMapa} />
              </section>
            );
          })}
          <p className="text-[11px] text-muted-foreground">Recomendada: a de maior % da área do município com 4G (desempate pelos moradores).</p>

          <Grupo titulo="Destinatário">
            <div>
              <Label className="text-xs" htmlFor="cob-para">Para (opcional)</Label>
              <Input id="cob-para" type="email" inputMode="email" placeholder="contato@cliente.com.br" className="mt-1.5 h-9 sm:w-80"
                value={estado.para} onChange={e => { onEstado({ para: e.target.value }); setAberto(false); }} />
              <p className="mt-1 text-[11px] text-muted-foreground">Se ficar em branco, você escolhe o destinatário no Outlook.</p>
            </div>
          </Grupo>
        </div>

        {/* Prévia */}
        <div className="mt-6 border-t pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Prévia do e-mail</p>
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <dl className="space-y-1 border-b px-4 py-3 text-[13px]">
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Para</dt><dd className="min-w-0 break-words font-medium">{estado.para.trim() || <span className="text-muted-foreground">você escolhe no Outlook</span>}</dd></div>
              <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Assunto</dt><dd className="min-w-0 break-words font-semibold">{assunto}</dd></div>
            </dl>
            {/* o e-mail é branco como no Outlook, também no tema escuro */}
            <div className="overflow-x-auto bg-white p-4" dangerouslySetInnerHTML={{ __html: htmlPrevia }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="space-y-1 border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2"><RadioTower className="h-5 w-5 text-primary" />E-mail de cobertura das operadoras</DialogTitle>
          <DialogDescription>Comparativo Claro × Vivo de cada cidade da operação, com o mapa de calor, pelos dados oficiais da Anatel. Confira a prévia e abra no Outlook.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{corpo}</div>

        {base && (
          <div className="border-t bg-card px-5 py-3.5">
            {aberto ? (
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>Agora cole no Outlook:</b> clique no corpo do e-mail, acima da sua assinatura, e use <b>Ctrl+V</b>. Depois é só enviar. A atividade já ficou como feita.</p>
                <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebCobertura(estado.para, assunto)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
                <Button variant="outline" size="sm" className="h-9" onClick={copiarSo}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
                <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-72 space-y-1">
                  <label htmlFor="cob-conferi" className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <Checkbox id="cob-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
                    {preparando ? `Preparando ${ok.length > 1 ? "os mapas" : "o mapa"} para o e-mail…` : "Conferi as informações da prévia"}
                  </label>
                  {conferido && semImagem.length > 0 && (
                    <p className="text-[12px] text-amber-800 dark:text-amber-200">
                      O mapa de {semImagem.map(d => `${d.municipio}/${d.uf}`).join(", ")} não vai no corpo do e-mail. Use "Baixar mapa" e anexe a imagem no Outlook.
                    </p>
                  )}
                </div>
                <Button variant="outline" className="h-9" disabled={!pronto} onClick={copiarSo}><Copy className="mr-1.5 h-4 w-4" />Copiar e-mail</Button>
                <Button className="h-9" disabled={!pronto} onClick={abrirOutlook}><Mail className="mr-1.5 h-4 w-4" />Copiar e abrir no Outlook</Button>
                {pronto && <PassoColar />}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
