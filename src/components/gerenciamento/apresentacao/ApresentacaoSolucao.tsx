import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileDown, ImageUp, Info, Loader2, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatLocation } from "@/lib/location";
import { agora, dataBr, equipamentosOf, fetchCoordenadorContato, fetchEmailDaEquipe, solutionsOf, type GerProject } from "@/lib/gerenciamento";
import { enviarLogo } from "@/lib/logoCliente";
import type { CampoApresentacao, Modulo03Estado } from "@/lib/modulo03";
import {
  SECOES, VELOCIDADES, duracaoDoRoteiro, eAtlasBox, eV6, fetchVisitasAgenda, minutos, nomeDeExibicao, nomeNoSlide, slidesDoProjeto, solucoesSemSlide,
  temBiometria, type DadosApresentacao, type SlideId,
} from "@/lib/apresentacao";
import { Registro, Rodape } from "../Etapa";
import { ModoApresentacao, Palco, PalcoFluido, telaCheia, velocidadeSalva } from "./ModoApresentacao";
import { Slide } from "./Slides";

const p2 = (n: number) => String(n).padStart(2, "0");
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

/** Imprime os slides (um por página) para o GP salvar em PDF e mandar ao cliente. */
function ImpressaoSlides({ slides, dados, onFim }: { slides: SlideId[]; dados: DadosApresentacao; onFim: () => void }) {
  const fimRef = useRef(onFim);
  fimRef.current = onFim;
  // imprime uma vez ao montar
  useEffect(() => {
    const titulo = document.title;
    document.title = `Apresentação da solução - ${nomeDeExibicao(dados.cliente)}`;
    document.body.classList.add("imprimindo-slides");
    let vivo = true;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".impressao-slides img"));
    Promise.all(imgs.map(im => (im.complete ? null : new Promise(r => { im.onload = im.onerror = r; }))))
      .then(() => document.fonts?.ready)
      .then(() => { if (vivo) window.print(); })
      .finally(() => {
        document.body.classList.remove("imprimindo-slides");
        document.title = titulo;
        if (vivo) fimRef.current();
      });
    return () => { vivo = false; document.body.classList.remove("imprimindo-slides"); document.title = titulo; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="impressao-slides" aria-hidden>
      {slides.map((id, k) => <Slide key={id} id={id} dados={dados} n={k + 1} total={slides.length} estatico />)}
    </div>,
    document.body,
  );
}

/**
 * Atividade 01 do módulo 03: a apresentação da solução montada pelo portal com o que o projeto
 * contratou (no lugar dos PowerPoints), o roteiro que o GP ajusta por cliente e o registro.
 */
export function ApresentacaoSolucao({ project, estado, reuniaoPe, logoModulo01, userName, onChange }: {
  project: GerProject;
  estado: Modulo03Estado;
  /** Reunião de PE agendada no módulo 02 (AAAA-MM-DDThh:mm). */
  reuniaoPe: string | null;
  /** Logo do cliente enviado no e-mail ao Data Center (módulo 01). */
  logoModulo01: string | null;
  userName: string;
  onChange: (update: (e: Modulo03Estado) => Modulo03Estado) => void;
}) {
  const a = estado.apresentacao;
  const set = (patch: Partial<Modulo03Estado["apresentacao"]>) => onChange(e => ({ ...e, apresentacao: { ...e.apresentacao, ...patch } }));
  const setCampo = (k: CampoApresentacao, v: string) => onChange(e => ({ ...e, apresentacao: { ...e.apresentacao, campos: { ...e.apresentacao.campos, [k]: v } } }));
  const [apresentando, setApresentando] = useState<{ inicio: number; automatico: boolean } | null>(null);
  const [imprimindo, setImprimindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const { data: visitasAgenda = [] } = useQuery({ queryKey: ["apresentacao-agenda", project.id], queryFn: () => fetchVisitasAgenda(project.id), staleTime: 60_000 });
  const { data: gpEmail = null } = useQuery({ queryKey: ["email-equipe", project.manager_id], queryFn: () => fetchEmailDaEquipe(project.manager_id), staleTime: 300_000 });
  // responsável técnico da Transdata: o Coordenador de Implantação da Equipe
  const { data: coordenador = null } = useQuery({ queryKey: ["coordenador-contato"], queryFn: fetchCoordenadorContato, staleTime: 300_000 });

  const solucoes = solutionsOf(project);
  const equipamentos = equipamentosOf(project);
  const campos = a.campos ?? {};
  const biometria = temBiometria(solucoes);
  const tecnico = coordenador ? `${coordenador.nome}, Coordenador de Implantação${coordenador.email ? ` · ${coordenador.email}` : ""}` : "";
  const logo = a.logo?.url ?? logoModulo01;
  const data = a.data || hoje();
  const dados: DadosApresentacao = useMemo(() => ({
    cliente: project.company_name,
    cidade: formatLocation(nomeDeExibicao(project.city), project.state, project.country_code),
    data,
    logoCliente: logo,
    gp: project.manager?.full_name ?? null,
    gpEmail,
    gpTelefone: campos.gpTelefone?.trim() || null,
    tecnico: tecnico || null,
    cameras: (biometria && campos.cameras?.trim()) || null,
    responsavelCliente: project.client_manager_name,
    igreCliente: campos.igre?.trim() || null,
    frota: { total: project.fleet_size, urbano: project.fleet_urbano, seccionado: project.fleet_seccionado },
    equipamentos,
    solucoes,
    reuniaoPe,
    visitasTecnicas: estado.cronograma.visitas.filter(v => v.data).map(v => ({ tipo: v.tipo, local: v.local, data: v.data })),
    visitasAgenda,
  }), [project, data, logo, gpEmail, campos.gpTelefone, tecnico, campos.cameras, campos.igre, reuniaoPe, estado.cronograma.visitas, visitasAgenda]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolhas = a.slides ?? {};
  const slides = slidesDoProjeto(solucoes, escolhas, equipamentos);
  const roteiro = slides.filter(s => s.incluido).map(s => s.modelo.id);
  const semSlide = solucoesSemSlide(solucoes);
  const semEquipamento = /bilhetagem/i.test(solucoes.join(" ")) && !equipamentos.some(e => eAtlasBox(e) || eV6(e));

  const apresentar = (k = 0, automatico = false) => { telaCheia(true); setApresentando({ inicio: k, automatico }); };
  const vel = velocidadeSalva();
  const nomeVel = VELOCIDADES.find(v => v.id === vel)?.nome.toLowerCase();
  const registrar = () => set({ data, participantes: a.participantes.trim(), registradoEm: agora(), por: userName });
  const escolher = (id: SlideId, ligado: boolean) => set({ slides: { ...escolhas, [id]: ligado } });
  const trocarLogo = async (f: File | undefined) => {
    if (!f) return;
    setEnviando(true);
    try { set({ logo: await enviarLogo(project.id, f) }); toast.success("Logo do cliente atualizado na capa."); }
    catch (e) { toast.error("Não foi possível enviar o logo.", { description: e instanceof Error ? e.message : String(e) }); }
    finally { setEnviando(false); if (arquivo.current) arquivo.current.value = ""; }
  };

  const modo = apresentando !== null && (
    <ModoApresentacao slides={roteiro} dados={dados} inicio={apresentando.inicio} automatico={apresentando.automatico} onSair={() => setApresentando(null)}
      onConcluir={a.registradoEm ? undefined : () => { registrar(); setApresentando(null); }} />
  );
  const pdf = imprimindo && <ImpressaoSlides slides={roteiro} dados={dados} onFim={() => setImprimindo(false)} />;

  if (a.registradoEm) {
    return (
      <div className="space-y-2.5">
        <Registro texto={`Apresentação feita em ${dataBr(a.data)} por ${a.por || userName}`} rotulo="Alterar" onDesfazer={() => set({ registradoEm: null })}>
          {a.participantes.trim() && <> · com {a.participantes.trim()}</>}
        </Registro>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-8 text-xs" onClick={() => apresentar(0)}><Play className="mr-1.5 h-3.5 w-3.5" />Abrir a apresentação</Button>
          <Button variant="outline" className="h-8 text-xs" onClick={() => setImprimindo(true)}><FileDown className="mr-1.5 h-3.5 w-3.5" />Salvar em PDF</Button>
        </div>
        {modo}{pdf}
      </div>
    );
  }

  let pos = 0;
  return (
    <div className="space-y-4">
      {/* a apresentação pronta */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center">
        <button type="button" onClick={() => apresentar(0)} aria-label="Apresentar a partir da capa"
          className="group relative w-full shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-[288px]">
          <PalcoFluido className="pointer-events-none"><Slide id="capa" dados={dados} n={1} total={roteiro.length} estatico /></PalcoFluido>
          <span className="absolute inset-0 flex items-end justify-end bg-marca-fundo/0 p-2.5 transition-colors group-hover:bg-marca-fundo/30">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-marca-laranja to-marca-rosa text-white shadow-lg transition-transform group-hover:scale-110">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
            </span>
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Montada para este projeto</p>
          <p className="mt-0.5 font-display text-[22px] font-bold leading-tight">{roteiro.length} slides com a solução contratada</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground" title="No modo automático; a velocidade muda durante a apresentação">
            <Timer className="h-3.5 w-3.5" />Cerca de {minutos(duracaoDoRoteiro(roteiro, vel))} no automático ({nomeVel})
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {solucoes.length > 0 && <>Pelas soluções do projeto: {lista(solucoes.map(nomeNoSlide))}. </>}
            Cliente, cidade, frota, equipamentos, GP, responsável do cliente e as datas da agenda entram sozinhos.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="h-9 bg-gradient-to-r from-marca-laranja to-marca-rosa text-white shadow-sm hover:opacity-95" onClick={() => apresentar(0)}>
              <Play className="mr-1.5 h-4 w-4" fill="currentColor" />Apresentar
            </Button>
            <Button variant="outline" className="h-9" onClick={() => apresentar(0, true)} title="Os slides passam sozinhos; dá para pausar e mudar a velocidade">
              <Timer className="mr-1.5 h-4 w-4" />Apresentar no automático
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setImprimindo(true)} title="Abre a impressão: escolha Salvar como PDF">
              <FileDown className="mr-1.5 h-4 w-4" />Salvar em PDF
            </Button>
          </div>
        </div>
      </div>

      {(semEquipamento || semSlide.length > 0) && (
        <div className="space-y-1.5">
          {semEquipamento && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-900 dark:text-amber-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              O projeto não tem equipamentos no cadastro: os slides do AtlasBox e do V6 entram os dois. Desligue o que não for usado, ou cadastre os equipamentos no projeto para o portal escolher sozinho.
            </p>
          )}
          {semSlide.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-[12.5px] text-sky-800 dark:text-sky-200">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {lista(semSlide.map(nomeNoSlide))} ainda {semSlide.length === 1 ? "não tem slide próprio: aparece" : "não têm slide próprio: aparecem"} como serviço contratado no slide do validador.
            </p>
          )}
        </div>
      )}

      {/* o que o GP completa */}
      <div className="rounded-xl border border-border/60 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-xs font-semibold">Dados dos slides</p>
          <p className="text-[11px] text-muted-foreground">O resto vem do projeto. Complete o que faltar; fica gravado neste projeto.</p>
        </div>
        <div className="mt-2.5 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          <div>
            <Label className="text-xs" htmlFor="m3-apr-tel">Telefone do GP</Label>
            <Input id="m3-apr-tel" className="mt-1.5 h-9" placeholder="(19) 9 0000-0000" value={campos.gpTelefone ?? ""} onChange={ev => setCampo("gpTelefone", ev.target.value)} />
          </div>
          <div>
            <span className="text-xs font-medium">Responsável técnico</span>
            <p className="mt-1.5 flex h-9 items-center truncate rounded-md border border-dashed border-border/80 px-3 text-[13px]"
              title="Vem da Equipe: quem está na função Coordenador de Implantação">
              {coordenador ? coordenador.nome : <span className="text-muted-foreground">Ninguém na função</span>}
              <span className="ml-1.5 truncate text-[11px] text-muted-foreground">Coord. de Implantação</span>
            </p>
          </div>
          <div>
            <Label className="text-xs" htmlFor="m3-apr-igre" title="Quem do cliente abre os chamados no sistema de chamados (IGRE)">Cliente no IGRE</Label>
            <Input id="m3-apr-igre" className="mt-1.5 h-9" placeholder="Quem abre os chamados" value={campos.igre ?? ""} onChange={ev => setCampo("igre", ev.target.value)} />
          </div>
          {biometria && (
            <div>
              <Label className="text-xs" htmlFor="m3-apr-cam" title="Câmeras de reconhecimento facial do projeto: modelo e quantidade">Câmeras da biometria</Label>
              <Input id="m3-apr-cam" className="mt-1.5 h-9" placeholder="Ex.: RF6 · 40" value={campos.cameras ?? ""} onChange={ev => setCampo("cameras", ev.target.value)} />
            </div>
          )}
          <div>
            <span className="text-xs font-medium">Logo do cliente</span>
            <div className="mt-1.5 flex h-9 items-center gap-2">
              {logo
                ? <span className="flex h-9 w-20 items-center justify-center rounded-md border border-border/70 bg-white px-1.5"><img src={logo} alt="Logo do cliente" className="max-h-7 max-w-full object-contain" /></span>
                : <span className="text-[12px] text-muted-foreground">Sem logo</span>}
              <input ref={arquivo} type="file" accept="image/png" className="sr-only" aria-label="Arquivo PNG do logo do cliente" onChange={ev => void trocarLogo(ev.target.files?.[0])} />
              <Button variant="outline" className="h-9 px-3 text-xs" disabled={enviando} onClick={() => arquivo.current?.click()}
                title={!a.logo && logoModulo01 ? "O logo veio do e-mail ao Data Center (módulo 01)" : "PNG até 2 MB"}>
                {enviando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImageUp className="mr-1.5 h-3.5 w-3.5" />}{logo ? "Trocar" : "Enviar PNG"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* roteiro: o GP desliga o que não vai mostrar para este cliente */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-xs font-semibold">Roteiro</p>
          <p className="text-[11px] text-muted-foreground">Desligue o que não vai mostrar para este cliente. Clique no slide para abrir a partir dele.</p>
        </div>
        <div className="mt-2 flex gap-5 overflow-x-auto pb-2.5 [scrollbar-width:thin]">
          {SECOES.map(sec => {
            const doGrupo = slides.filter(s => s.modelo.secao === sec.id);
            if (!doGrupo.length) return null;
            return (
              <div key={sec.id} className="shrink-0">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{sec.nome}</p>
                <div className="flex gap-2.5">
                  {doGrupo.map(s => {
                    const k = s.incluido ? pos++ : -1;
                    const t = s.modelo.titulo;
                    return (
                      <div key={s.modelo.id} className={cn("w-[166px] rounded-lg border p-1.5 transition-colors",
                        s.incluido ? "border-border/70 bg-card" : "border-dashed border-border bg-muted/30")}>
                        <button type="button" disabled={!s.incluido} onClick={() => apresentar(k)} aria-label={`Apresentar a partir de ${t}`}
                          className="block overflow-hidden rounded-md ring-1 ring-border/50 transition hover:ring-2 hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:hover:ring-border/50">
                          <Palco largura={152} className={cn("pointer-events-none transition", !s.incluido && "opacity-35 grayscale")}>
                            <Slide id={s.modelo.id} dados={dados} n={Math.max(k, 0) + 1} total={roteiro.length} estatico />
                          </Palco>
                        </button>
                        <div className="mt-1.5 flex items-start gap-1.5 px-0.5">
                          <span className={cn("min-w-0 flex-1 text-[12px] font-medium leading-tight", !s.incluido && "text-muted-foreground")} lang="pt-BR">
                            <span className="tabular-nums text-muted-foreground">{s.incluido ? p2(k + 1) : "—"}</span> · {t}
                          </span>
                          <Switch checked={s.incluido} onCheckedChange={v => escolher(s.modelo.id, v)} aria-label={`Mostrar o slide ${t}`} className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3" />
                        </div>
                        {s.foraDoContrato && (
                          <span className="mx-0.5 mt-1 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:text-amber-200">Não contratado</span>
                        )}
                        {s.dica && <p className="mt-1 px-0.5 text-[10.5px] leading-snug text-muted-foreground">{s.dica}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* registro */}
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <Label className="text-xs" htmlFor="m3-apr-data">Data da apresentação</Label>
          <Input id="m3-apr-data" type="date" className="mt-1.5 h-9" value={data} onChange={ev => set({ data: ev.target.value })} />
        </div>
        <div>
          <Label className="text-xs" htmlFor="m3-apr-part">Participantes do cliente (opcional)</Label>
          <Input id="m3-apr-part" className="mt-1.5 h-9" placeholder="Ex.: Carla (gerente de operações), equipe da garagem" value={a.participantes} onChange={ev => set({ participantes: ev.target.value })} />
        </div>
      </div>
      <Rodape falta={[]} dica="Depois de apresentar, registre a data e quem participou (ou registre direto no fim da apresentação).">
        <Button className="h-9" onClick={registrar}><Check className="mr-1.5 h-4 w-4" />Registrar apresentação</Button>
      </Rodape>
      {modo}{pdf}
    </div>
  );
}
