import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Copy, Download, ExternalLink, Globe2, Mail, RadioTower, RefreshCw } from "lucide-react";
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
import {
  NOME_OPERADORA, assuntoCobertura, buscarCobertura, buscarSetores, dadosAtrasados, emailHtmlCobertura, emailTextoCobertura, enviarMapa,
  mailtoCobertura, municipiosDaUf, outlookWebCobertura, pctTexto, periodoTexto, recomendada,
  type EmailCobertura, type OperadoraCobertura, type ResultadoCobertura, type SetoresMunicipio,
} from "@/lib/coberturaOperadoras";
import { Fixo, Grupo } from "./DataCenterEmailDialog";
import { MapaCoberturaSvg } from "./MapaCoberturaSvg";

type EstadoCarrier = Modulo01Estado["carrier"];

/** Aviso no lugar do conteúdo (fora do Brasil, sem carga, erro). */
function Aviso({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-[13px] text-amber-900 dark:text-amber-100">
      <span className="mt-0.5 shrink-0">{icone}</span>
      <div className="min-w-0 space-y-2"><p className="font-semibold">{titulo}</p>{children}</div>
    </div>
  );
}

/**
 * E-mail ao cliente com a cobertura Claro × Vivo da cidade do cadastro (dados da Anatel) e o
 * mapa de calor por setor censitário. O GP confere e abre no Outlook; copiar conclui a atividade.
 */
export function CoberturaEmailDialog({ open, onOpenChange, project, estado, onEstado, remetente, onCopiado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: GerProject;
  estado: EstadoCarrier;
  onEstado: (patch: Partial<EstadoCarrier>) => void;
  remetente: string;
  /** Copiou o e-mail: a atividade fica feita, com a operadora recomendada. */
  onCopiado: (recomendada: OperadoraCobertura | null) => void;
}) {
  const [res, setRes] = useState<ResultadoCobertura | null>(null); // null: carregando
  const [erro, setErro] = useState<string | null>(null);
  const [setores, setSetores] = useState<SetoresMunicipio | null | undefined>(undefined); // undefined: carregando; null: sem mapa
  const [municipios, setMunicipios] = useState<{ codIbge: number; nome: string }[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pngRef = useRef<Blob | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [mapaPublico, setMapaPublico] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [falhaMapa, setFalhaMapa] = useState(false);
  const [conferido, setConferido] = useState(false);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setRes(null); setErro(null); setSetores(undefined); setMunicipios(null);
    setMapaPublico(null); setFalhaMapa(false); setConferido(false); setAberto(false);
    try {
      const r = await buscarCobertura(project, estado.codIbge);
      setRes(r);
      if (r.status === "ok") buscarSetores(r.dados.codIbge).then(setSetores).catch(() => setSetores(null));
      if (r.status === "nao_encontrado") municipiosDaUf(r.uf).then(setMunicipios).catch(() => setMunicipios([]));
    } catch (err) {
      setErro(errorMessage(err));
    }
  }, [project, estado.codIbge]);
  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  // depois de desenhar o mapa, gera o PNG da prévia (e do download)
  useEffect(() => {
    if (!setores || !svgRef.current) return;
    let url: string | null = null, vivo = true;
    svgParaPng(svgRef.current).then(png => {
      if (!vivo) return;
      pngRef.current = png;
      url = URL.createObjectURL(png);
      setPrevia(url);
    }).catch(() => { if (vivo) setFalhaMapa(true); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); setPrevia(null); pngRef.current = null; };
  }, [setores]);

  const dados = res?.status === "ok" ? res.dados : null;
  const rec = dados ? recomendada(dados.resumo) : null;
  const base: EmailCobertura | null = dados ? { project, dados, recomendada: rec, remetente, mapaUrl: null } : null;
  const assunto = base ? assuntoCobertura(base) : "";
  const htmlPrevia = base ? emailHtmlCobertura({ ...base, mapaUrl: mapaPublico ?? previa }) : "";
  const mapaPronto = setores === null || falhaMapa || !!mapaPublico;
  const pronto = !!base && conferido && mapaPronto && !preparando;

  // conferido e com a imagem pronta, sobe o mapa: assim copiar é imediato e o Outlook acha a imagem
  const periodoDados = dados?.periodo;
  useEffect(() => {
    if (!conferido || !periodoDados || !previa || mapaPublico || falhaMapa || !pngRef.current) return;
    let vivo = true;
    setPreparando(true);
    enviarMapa(project.id, periodoDados, pngRef.current)
      .then(url => { if (vivo) { setMapaPublico(url); setPreparando(false); } })
      .catch(() => { if (vivo) { setFalhaMapa(true); setPreparando(false); } });
    return () => { vivo = false; setPreparando(false); };
  }, [conferido, periodoDados, previa, mapaPublico, falhaMapa, project.id]);

  const copiar = async () => {
    if (!base) return false;
    const e = { ...base, mapaUrl: mapaPublico };
    if (!(await copiarEmail(emailHtmlCobertura(e), emailTextoCobertura(e)))) {
      toast.error("Não foi possível copiar. Tente de novo ou selecione a prévia e copie.");
      return false;
    }
    onCopiado(rec);
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

  const nomeArquivo = dados ? `mapa-cobertura-${dados.municipio.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dados.uf.toLowerCase()}.png` : "mapa.png";

  let corpo: ReactNode;
  if (erro) {
    corpo = (
      <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo="Não foi possível carregar a cobertura.">
        <p>{erro}</p>
        <Button variant="outline" size="sm" className="h-8 bg-background" onClick={carregar}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Tentar novamente</Button>
      </Aviso>
    );
  } else if (!res) {
    corpo = <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div>;
  } else if (res.status === "fora") {
    corpo = <Aviso icone={<Globe2 className="h-4 w-4" />} titulo="Projeto fora do Brasil."><p>Os dados de cobertura são da Anatel e valem só para municípios brasileiros.</p></Aviso>;
  } else if (res.status === "sem_dados") {
    corpo = (
      <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo="Os dados de cobertura ainda não foram carregados no portal.">
        <p>A carga da Anatel roda toda segunda-feira, pelo GitHub (workflow "Cobertura das operadoras"). Depois da primeira carga, o e-mail fica disponível para todos os projetos com Carrier, ITS ou Gestão de Frota.</p>
      </Aviso>
    );
  } else if (res.status === "nao_encontrado") {
    corpo = (
      <Aviso icone={<AlertTriangle className="h-4 w-4" />} titulo={`"${project.city}/${project.state ?? ""}" não está na lista de municípios da Anatel.`}>
        <p>Pode ser o nome escrito de outro jeito no cadastro. Escolha o município:</p>
        {municipios === null ? <Skeleton className="h-9 w-72" /> : (
          <Select onValueChange={v => onEstado({ codIbge: Number(v) })}>
            <SelectTrigger className="h-9 w-72 max-w-full bg-background text-foreground" aria-label="Município"><SelectValue placeholder={`Municípios de ${res.uf}`} /></SelectTrigger>
            <SelectContent>{municipios.map(m => <SelectItem key={m.codIbge} value={String(m.codIbge)}>{m.nome}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Aviso>
    );
  } else {
    const d = res.dados;
    corpo = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6 lg:pr-5">
          <Grupo titulo="Cidade">
            <Fixo label="Município" valor={`${d.municipio}/${d.uf}`} origem={estado.codIbge ? "escolhido" : "do cadastro"} />
            <Fixo label="Dados da Anatel" valor={`período ${periodoTexto(d.periodo)}`} origem="oficial" />
            {dadosAtrasados(d.periodo) && (
              <p className="flex items-start gap-1.5 text-[12px] text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Dados de mais de dois trimestres atrás. A atualização automática pode ter parado: confira o GitHub Actions ("Cobertura das operadoras").</span>
              </p>
            )}
            {estado.codIbge && <button type="button" className="text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => onEstado({ codIbge: null })}>Voltar à cidade do cadastro</button>}
          </Grupo>

          <Grupo titulo="Comparativo">
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
            <p className="text-[11px] text-muted-foreground">Recomendada: a de maior % da área do município com 4G (desempate pelos moradores).</p>
          </Grupo>

          <Grupo titulo="Mapa de calor 4G">
            {setores === undefined ? <Skeleton className="aspect-[2/1] w-full rounded-lg" />
              : setores === null ? <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-muted-foreground">O mapa deste município ainda não foi gerado pela carga. O e-mail vai sem o mapa.</p>
              : (
                <>
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-white">
                    <MapaCoberturaSvg ref={svgRef} setores={setores} resumo={d.resumo} recomendada={rec} className="block h-auto w-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8" disabled={!previa} asChild={!!previa}>
                      {previa ? <a href={previa} download={nomeArquivo}><Download className="mr-1.5 h-3.5 w-3.5" />Baixar mapa (PNG)</a> : <span><Download className="mr-1.5 h-3.5 w-3.5" />Baixar mapa (PNG)</span>}
                    </Button>
                    <span className="text-[11px] text-muted-foreground">Para anexar, se preferir.</span>
                  </div>
                </>
              )}
          </Grupo>

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
          <DialogDescription>Comparativo Claro × Vivo da cidade do cadastro, com o mapa de calor, pelos dados oficiais da Anatel. Confira a prévia e abra no Outlook.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{corpo}</div>

        {base && (
          <div className="border-t bg-card px-5 py-3.5">
            {aberto ? (
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="min-w-0 flex-1 basis-72 text-[13px]"><b>E-mail copiado e Outlook aberto</b> com o assunto{estado.para.trim() ? " e o destinatário" : ""}. Clique no corpo do e-mail, cole (Ctrl+V) e envie. A atividade já ficou como feita.</p>
                <Button variant="ghost" size="sm" className="h-9" asChild><a href={outlookWebCobertura(estado.para, assunto)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Outlook na web</a></Button>
                <Button variant="outline" size="sm" className="h-9" onClick={copiarSo}><Copy className="mr-1.5 h-4 w-4" />Copiar de novo</Button>
                <Button size="sm" className="h-9" onClick={() => onOpenChange(false)}><Check className="mr-1.5 h-4 w-4" />Fechar</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-72 space-y-1">
                  <label htmlFor="cob-conferi" className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <Checkbox id="cob-conferi" checked={conferido} onCheckedChange={v => setConferido(v === true)} />
                    {preparando ? "Preparando o mapa para o e-mail…" : "Conferi as informações da prévia"}
                  </label>
                  {conferido && falhaMapa && setores && (
                    <p className="text-[12px] text-amber-800 dark:text-amber-200">O mapa não vai no corpo do e-mail. Use "Baixar mapa" e anexe a imagem no Outlook.</p>
                  )}
                </div>
                <Button variant="outline" className="h-9" disabled={!pronto} onClick={copiarSo}><Copy className="mr-1.5 h-4 w-4" />Copiar e-mail</Button>
                <Button className="h-9" disabled={!pronto} onClick={abrirOutlook}><Mail className="mr-1.5 h-4 w-4" />Copiar e abrir no Outlook</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
