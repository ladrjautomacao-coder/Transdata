import type { ReactNode } from "react";
import {
  AlertTriangle, BadgeCheck, Ban, CalendarDays, Camera, Check, ClipboardCheck, Clock, CloudCog, CreditCard, Database, DatabaseZap, Facebook,
  FileText, Globe, Headphones, Image as ImageIcon, Lightbulb, LifeBuoy, Mail, MessageCircle, Phone, RefreshCw, ScanFace, SearchCheck,
  Smartphone, Square, UserRound, UsersRound, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  diaMes, eAtlasBox, eV6, nomeDeExibicao, nomeEquipamento, nomeNoSlide, periodoCurto, slideContratado, type DadosApresentacao, type Equipamento, type SlideId,
} from "@/lib/apresentacao";
import logoT from "@/assets/apresentacao/t-laranja.webp";
import videoCidade from "@/assets/entrada/entrada-login.mp4";
import posterCidade from "@/assets/entrada/entrada-login.jpg";
import videoAmbiente from "@/assets/apresentacao/ambiente.mp4";
import posterAmbiente from "@/assets/apresentacao/ambiente.jpg";
import videoAtlasBox from "@/assets/apresentacao/atlasbox.mp4";
import posterAtlasBox from "@/assets/apresentacao/atlasbox.jpg";
import logoClaro from "@/assets/apresentacao/logo-transdata-claro.webp";
import imgV6 from "@/assets/apresentacao/v6.webp";
import imgV6AllInOne from "@/assets/apresentacao/v6-all-in-one.webp";
import imgBiometria from "@/assets/apresentacao/biometria-onibus.webp";
import imgCamera from "@/assets/apresentacao/camera-rfx.webp";
import imgRosto from "@/assets/apresentacao/bio-rosto.webp";
import imgBioIlustracao from "@/assets/apresentacao/bio-ilustracao.webp";
import imgItsTela from "@/assets/apresentacao/its-tela.webp";
import imgFluxo from "@/assets/apresentacao/fluxo-tdmax.webp";
import imgColeta from "@/assets/apresentacao/ponto-coleta.webp";
import imgCadastro from "@/assets/apresentacao/ponto-cadastro.webp";
import imgPos from "@/assets/apresentacao/atlaspos.webp";
import imgAppMao from "@/assets/apresentacao/app-mao-celular.webp";
import imgMigIlustracao from "@/assets/apresentacao/mig-ilustracao.webp";
import imgEncerramento from "@/assets/apresentacao/encerramento.webp";
import matComputador from "@/assets/apresentacao/mat-computador.webp";
import matAntena from "@/assets/apresentacao/mat-antena.webp";
import matLeitora from "@/assets/apresentacao/mat-leitora.webp";
import matImpressora from "@/assets/apresentacao/mat-impressora.webp";
import matWebcam from "@/assets/apresentacao/mat-webcam.webp";
import matCartao from "@/assets/apresentacao/mat-cartao.webp";
import matChicote from "@/assets/apresentacao/mat-chicote.webp";
import matCaboY from "@/assets/apresentacao/mat-cabo-y.webp";
import matPendrive from "@/assets/apresentacao/mat-pendrive.webp";
import matCatraca from "@/assets/apresentacao/mat-catraca.webp";
import matSuporte from "@/assets/apresentacao/mat-suporte.webp";

// Os slides da apresentação da solução: quadro fixo de 1280×720 (quem mostra escala o quadro).
// Textos das apresentações originais (Reunião PE, ChatBot, Biometria Facial e Migração BD).
// Fotos reais dos produtos; o vídeo do Runway só no ambiente, nunca redesenhando produto.

export interface SlideProps {
  dados: DadosApresentacao;
  /** Posição no roteiro e total de slides, para o rodapé. */
  n: number;
  total: number;
  /** Miniatura ou impressão: sem vídeo e sem animação. */
  estatico?: boolean;
}

/* ─── Peças comuns ─── */

/** Vídeo de fundo, mudo e em loop; parado (só o quadro) na miniatura e na impressão. */
function Video({ src, poster, estatico, className }: { src: string; poster: string; estatico?: boolean; className?: string }) {
  if (estatico) return <img src={poster} alt="" aria-hidden className={className} />;
  return (
    <video
      src={src} poster={poster} autoPlay loop playsInline aria-hidden className={className}
      // o React não grava o atributo muted: sem ele o navegador bloqueia o autoplay
      ref={el => { if (el) { el.muted = true; el.play().catch(() => { /* fica no quadro parado */ }); } }}
    />
  );
}

/** Seção do slide, no canto superior esquerdo (a pílula laranja das apresentações originais). */
function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="absolute left-0 top-[34px] rounded-r-full bg-gradient-to-r from-marca-laranja to-marca-rosa py-[7px] pl-[64px] pr-7 text-[13px] font-semibold uppercase tracking-[0.32em] text-white shadow-[0_6px_18px_hsl(var(--marca-rosa)/0.28)]">
      {children}
    </span>
  );
}

/** O "T" da Transdata no canto superior direito. */
const CantoT = () => <img src={logoT} alt="" aria-hidden className="absolute right-[44px] top-[22px] h-[52px]" />;

/** Cliente e número do slide, no rodapé. */
function Rodape({ dados, n, total, claro }: SlideProps & { claro?: boolean }) {
  return (
    <div className={cn("absolute bottom-[26px] left-[64px] right-[52px] flex items-center justify-between text-[13px] font-medium tracking-wide",
      claro ? "text-white/60" : "text-[hsl(var(--sl-suave))]")}>
      <span>{nomeDeExibicao(dados.cliente)} · Apresentação da solução</span>
      <span className="tabular-nums">{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </div>
  );
}

function Titulo({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("sl-titulo text-[66px] text-marca-logo", className)}>{children}</h2>;
}

function Texto({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[21px] leading-[1.55] text-[hsl(var(--sl-suave))]", className)}>{children}</p>;
}

function Topicos({ itens, className }: { itens: ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-2.5 text-[19px] leading-snug text-[hsl(var(--sl-texto))]", className)}>
      {itens.map((i, k) => (
        <li key={k} className="flex gap-3">
          <span aria-hidden className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-marca-laranja to-marca-rosa" />
          <span className="min-w-0">{i}</span>
        </li>
      ))}
    </ul>
  );
}

function Chip({ children, destaque }: { children: ReactNode; destaque?: boolean }) {
  return (
    <span className={cn("rounded-full px-4 py-[7px] text-[16px] font-semibold",
      destaque ? "bg-gradient-to-r from-marca-laranja to-marca-rosa text-white" : "bg-marca-logo text-white")}>
      {children}
    </span>
  );
}

/** Cartão branco com ícone, título e texto (pré-requisitos, requisitos). */
function Cartao({ icone: Icone, titulo, children, className }: { icone: typeof Camera; titulo: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[24px] border border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] p-6 shadow-[0_12px_30px_hsl(var(--marca-fundo)/0.08)]", className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-marca-laranja to-marca-rosa text-white"><Icone className="h-7 w-7" /></span>
      <p className="mt-4 text-[21px] font-semibold leading-tight text-[hsl(var(--sl-texto))]">{titulo}</p>
      {children && <div className="mt-2 text-[16px] leading-snug text-[hsl(var(--sl-suave))]">{children}</div>}
    </div>
  );
}

/** Conteúdo com o rótulo da seção, o "T" e o rodapé. */
function Moldura({ secao, p, children }: { secao: string; p: SlideProps; children: ReactNode }) {
  return (
    <>
      <Rotulo>{secao}</Rotulo>
      <CantoT />
      {children}
      <Rodape {...p} />
    </>
  );
}

/** Painel da direita com o vídeo de ambiente (luzes da cidade vistas do ônibus) sob o véu roxo. */
function PainelAmbiente({ estatico, className, children }: { estatico?: boolean; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("absolute inset-y-0 right-0 overflow-hidden bg-marca-fundo", className)}>
      <Video src={videoAmbiente} poster={posterAmbiente} estatico={estatico} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-marca-logo/55 via-marca-fundo/35 to-marca-fundo/70" />
      {children}
    </div>
  );
}

/** Data de uma etapa no slide: confirmada na Agenda, prevista pelo GP, prazo ou ainda a agendar. */
interface ChipData { texto: string; tipo: "confirmada" | "prevista" | "prazo" | "pendente" }
const CHIP_DATA: Record<ChipData["tipo"], string> = {
  confirmada: "bg-marca-logo text-white",
  prevista: "border-2 border-marca-laranja bg-marca-laranja/10 text-[hsl(var(--sl-texto))]",
  prazo: "bg-marca-lilas/20 text-marca-logo",
  pendente: "border border-dashed border-[hsl(var(--sl-suave))] text-[hsl(var(--sl-suave))]",
};

/** Etapas em linha, ligadas por um traço (marcos, cronogramas). */
function Etapas({ etapas, className }: {
  etapas: { titulo: string; icone?: typeof Camera; tom?: "roxo" | "lilas" | "laranja"; chip?: ChipData; itens?: string[] }[];
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden className="absolute left-[24px] right-[24px] top-[27px] h-[4px] rounded-full bg-gradient-to-r from-marca-logo via-marca-lilas to-marca-laranja" />
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }}>
        {etapas.map((e, i) => (
          <li key={e.titulo} className="pr-4">
            <span className={cn("flex h-[58px] w-[58px] items-center justify-center rounded-full border-[6px] border-[hsl(var(--sl-fundo))] text-white",
              (e.tom ?? (i === 0 ? "roxo" : "laranja")) === "roxo" ? "bg-marca-logo" : e.tom === "lilas" ? "bg-marca-lilas" : "bg-gradient-to-br from-marca-laranja to-marca-rosa")}>
              {e.icone ? <e.icone className="h-6 w-6" /> : <span className="text-[18px] font-bold">{i + 1}</span>}
            </span>
            <p className="mt-3 text-[18.5px] font-semibold leading-tight text-[hsl(var(--sl-texto))]">{e.titulo}</p>
            {e.chip && (
              <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold", CHIP_DATA[e.chip.tipo])}>
                {e.chip.tipo === "confirmada" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <CalendarDays className="h-3.5 w-3.5" />}{e.chip.texto}
              </span>
            )}
            {e.itens && (
              <ul className="mt-2.5 space-y-1 text-[14.5px] leading-snug text-[hsl(var(--sl-suave))]">
                {e.itens.map(x => <li key={x}>{x}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** AAAA-MM-DD → "12 de novembro de 2026" */
const dataExtenso = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}` : v;
};

/* ─── Abertura ─── */

function Capa(p: SlideProps) {
  const { dados } = p;
  return (
    <>
      <Video src={videoCidade} poster={posterCidade} estatico={p.estatico} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-marca-fundo via-marca-fundo/85 to-marca-logo/25" />
      <div className="absolute inset-x-0 bottom-0 h-[6px] bg-gradient-to-r from-marca-laranja to-marca-rosa" />
      <img src={logoClaro} alt="Transdata" className="absolute left-[72px] top-[58px] h-[62px]" />
      <div className="sl-entra absolute left-[72px] top-[200px] w-[860px] text-white">
        <p className="text-[21px] font-semibold uppercase tracking-[0.36em] text-marca-laranja">#SomosTransdata</p>
        <p className="mt-2 text-[24px] text-white/80">Nossa experiência conectada às suas demandas</p>
        <h1 className="sl-titulo mt-12 text-[82px] text-white">{nomeDeExibicao(dados.cliente)}</h1>
        <p className="mt-5 text-[23px] text-marca-lilas-claro">{dados.cidade} · Apresentação da solução · {dataExtenso(dados.data)}</p>
        {dados.gp && <p className="mt-2 text-[18px] text-white/65">Com {dados.gp}, Gerente de Projetos</p>}
      </div>
      <div className="absolute bottom-[54px] left-[72px] flex max-w-[760px] flex-wrap gap-2">
        {dados.solucoes.map(s => (
          <span key={s} className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[15px] font-medium text-white backdrop-blur-sm">{nomeNoSlide(s)}</span>
        ))}
      </div>
      {/* "Projeto: [logo do cliente]", como na capa original */}
      <div className="absolute bottom-[46px] right-[64px] flex items-center overflow-hidden rounded-2xl shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
        <span className="bg-gradient-to-r from-marca-laranja to-marca-rosa px-5 py-[26px] text-[20px] font-semibold text-white">Projeto</span>
        <span className="flex h-[78px] min-w-[180px] items-center justify-center bg-white px-5">
          {dados.logoCliente
            ? <img src={dados.logoCliente} alt={`Logo ${nomeDeExibicao(dados.cliente)}`} className="max-h-[56px] max-w-[220px] object-contain" />
            : <span className="text-[18px] font-semibold text-marca-logo">{nomeDeExibicao(dados.cliente)}</span>}
        </span>
      </div>
    </>
  );
}

/* ─── Serviços contratados ─── */

/** Serviço contratado ("Serviços implantados") ou oportunidade que o GP ligou ("Conheça também"). */
const contratado = (id: SlideId, d: DadosApresentacao) => slideContratado(id, d.solucoes, d.equipamentos);
const rotuloServico = (id: SlideId, d: DadosApresentacao) => (contratado(id, d) ? "Serviços implantados" : "Conheça também");

/** O que vai implantado: equipamentos do cadastro (com a quantidade) e os serviços contratados. */
function ServicosDoProjeto({ dados, filtro, id }: { dados: DadosApresentacao; filtro: (e: Equipamento) => boolean; id: SlideId }) {
  if (!contratado(id, dados)) {
    return <p className="mt-8 inline-flex rounded-full bg-marca-lilas/20 px-4 py-2 text-[16px] font-semibold text-marca-logo">Disponível para a sua operação</p>;
  }
  const equips = dados.equipamentos.filter(filtro);
  const todos = dados.equipamentos;
  const conta = (t: string) => dados.visitasTecnicas.filter(v => v.tipo === t).length;
  const venda = conta("venda"), coleta = conta("coleta");
  const servicos = [
    ...dados.solucoes.filter(s => !/bilhetagem/i.test(s)).map(nomeNoSlide),
    ...(todos.some(e => /\bEMV\b/i.test(e.nome)) ? ["EMV"] : []),
    ...(todos.some(e => /\bQRC\b/i.test(e.nome)) ? ["QrCode"] : []),
  ];
  const f = dados.frota;
  return (
    <>
      <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--sl-suave))]">Neste projeto</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {equips.map(e => <Chip key={e.nome} destaque>{nomeEquipamento(e.nome)} · {e.qtd}</Chip>)}
        {dados.cameras && <Chip destaque>{dados.cameras}</Chip>}
        <Chip>{venda > 1 ? `Pontos de venda · ${venda}` : venda === 1 ? "Ponto de venda · 1" : "Ponto de venda"}</Chip>
        <Chip>{coleta > 1 ? `Pontos de coleta · ${coleta}` : coleta === 1 ? "Ponto de coleta · 1" : "Ponto de coleta"}</Chip>
        {servicos.map(s => <Chip key={s}>{s}</Chip>)}
      </div>
      {f.total != null && (
        <p className="mt-3 text-[16px] text-[hsl(var(--sl-suave))]">
          Frota de {f.total} veículos{(f.urbano || f.seccionado) ? ` · ${f.urbano ?? 0} urbanos e ${f.seccionado ?? 0} seccionados` : ""}
        </p>
      )}
    </>
  );
}

function AtlasBox(p: SlideProps) {
  return (
    <Moldura secao={rotuloServico("atlasbox", p.dados)} p={p}>
      <div className="absolute inset-y-0 right-0 w-[600px] overflow-hidden rounded-l-[48px] bg-marca-fundo">
        <Video src={videoAtlasBox} poster={posterAtlasBox} estatico={p.estatico} className="h-full w-full object-cover object-[94%_50%]" />
      </div>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[560px]">
        <Titulo>AtlasBox</Titulo>
        <Texto className="mt-5 text-[20px]">
          O AtlasBox incorpora tecnologias centradas nos passageiros, oferecendo soluções interoperáveis que incluem pagamento multimeios, fornecimento de dados para controle operacional, funcionalidades de telemetria, sistemas antifurto e diversos outros recursos.
        </Texto>
        <ServicosDoProjeto dados={p.dados} filtro={eAtlasBox} id="atlasbox" />
      </div>
    </Moldura>
  );
}

function V6(p: SlideProps) {
  return (
    <Moldura secao={rotuloServico("v6", p.dados)} p={p}>
      <PainelAmbiente estatico={p.estatico} className="w-[600px] rounded-l-[48px]">
        <img src={imgV6} alt="Validador V6" className="sl-flutua absolute left-[120px] top-[86px] h-[540px] drop-shadow-[0_34px_40px_rgba(0,0,0,0.55)]" />
      </PainelAmbiente>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[560px]">
        <Titulo>V6</Titulo>
        <Texto className="mt-5 text-[20px]">
          A funcionalidade do validador, somada aos benefícios operacionais do computador de bordo, permite reunir todos os serviços em um só equipamento, prontos para serem habilitados conforme a necessidade. Isso é o V6.
        </Texto>
        <ServicosDoProjeto dados={p.dados} filtro={eV6} id="v6" />
      </div>
    </Moldura>
  );
}

function Biometria(p: SlideProps) {
  return (
    <Moldura secao={rotuloServico("biometria", p.dados)} p={p}>
      <div className="absolute right-[64px] top-[96px] h-[560px] w-[440px] overflow-hidden rounded-[36px] bg-marca-fundo shadow-[0_24px_60px_hsl(var(--marca-fundo)/0.35)]">
        <img src={imgBiometria} alt="Câmera de reconhecimento facial sobre o validador, no ônibus" className="sl-aproxima h-full w-full object-cover" />
      </div>
      <div className="absolute right-[430px] top-[452px] flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[hsl(var(--sl-cartao))] shadow-[0_14px_34px_hsl(var(--marca-fundo)/0.25)] ring-[6px] ring-[hsl(var(--sl-fundo))]">
        <img src={imgCamera} alt="Câmera de reconhecimento facial" className="h-[118px] w-[118px] object-contain" />
      </div>
      <div className="sl-entra absolute left-[64px] top-[118px] w-[560px]">
        <Titulo>Biometria facial</Titulo>
        <Texto className="mt-6">
          A câmera de reconhecimento facial (RF5 ou RF6), integrada ao validador, realiza a verificação de cada acesso de forma rápida e automática, comparando as imagens captadas com as registradas no cadastro do passageiro.
        </Texto>
        <Texto className="mt-4">
          Uma lista de acessos suspeitos é gerada e permite bloquear, remotamente, cartões usados de maneira irregular.
        </Texto>
      </div>
    </Moldura>
  );
}

function Its(p: SlideProps) {
  return (
    <Moldura secao={rotuloServico("its", p.dados)} p={p}>
      <PainelAmbiente estatico={p.estatico} className="w-[560px] rounded-l-[48px]" />
      <div className="absolute right-[64px] top-[176px] w-[680px] rounded-[30px] bg-marca-tinta p-[18px] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
        <img src={imgItsTela} alt="Tela do ITS Operacional" className="w-full rounded-[14px]" />
      </div>
      <div className="sl-entra absolute left-[64px] top-[118px] w-[430px]">
        <Titulo>ITS</Titulo>
        <Texto className="mt-6">
          A solução permite o acompanhamento completo da operação por meio de quadro sinóptico, mapa e dashboard de indicadores, além da consulta detalhada de dados através de uma suíte de relatórios.
        </Texto>
        <Topicos className="mt-7" itens={["Melhor desempenho e rentabilidade da operação", "Controle eficaz de linhas, quilometragem, pontualidade, velocidade e demanda"]} />
      </div>
    </Moldura>
  );
}

function Chatbot(p: SlideProps) {
  const cliente = nomeDeExibicao(p.dados.cliente);
  const msgs: { de: "bot" | "eu"; t: ReactNode }[] = [
    { de: "eu", t: "Olá" },
    { de: "bot", t: <>Olá! Seja bem-vindo(a). Sou o assistente virtual da {cliente}.</> },
    { de: "bot", t: "Como posso ajudar?" },
    { de: "bot", t: <>1 · Recarga<br />2 · Consulta de saldo<br />3 · Bloqueio de cartão<br />4 · Falar com um atendente</> },
    { de: "eu", t: "1" },
    { de: "bot", t: "Qual cartão você quer recarregar?" },
  ];
  return (
    <Moldura secao={rotuloServico("chatbot", p.dados)} p={p}>
      <PainelAmbiente estatico={p.estatico} className="w-[520px] rounded-l-[48px]" />
      <div className="absolute right-[150px] top-[64px] h-[600px] w-[300px] rounded-[44px] bg-marca-tinta p-[12px] shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="flex h-full flex-col overflow-hidden rounded-[34px] bg-[hsl(var(--sl-fundo))]">
          <div className="flex items-center gap-2.5 bg-marca-logo px-4 pb-3 pt-6 text-white">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white">
              {p.dados.logoCliente ? <img src={p.dados.logoCliente} alt="" className="h-6 w-6 object-contain" /> : <MessageCircle className="h-4 w-4 text-marca-logo" />}
            </span>
            <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{cliente}</span><span className="block text-[11px] text-white/70">online</span></span>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-2 p-3 text-[12.5px] leading-snug">
            {msgs.map((m, i) => (
              <span key={i} className={cn("max-w-[85%] rounded-2xl px-3 py-2 shadow-sm",
                m.de === "eu" ? "self-end rounded-br-md bg-gradient-to-r from-marca-laranja to-marca-rosa text-white" : "self-start rounded-bl-md bg-[hsl(var(--sl-cartao))]")}>{m.t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[580px]">
        <Titulo>ChatBot</Titulo>
        <Texto className="mt-5 text-[20px]">Um canal de atendimento para parte das funcionalidades do sistema:</Texto>
        <Topicos className="mt-5 text-[18px]" itens={[
          "Recarga (todos os tipos de cartão)",
          "Consulta de saldo",
          "Pendências do cartão de crédito/débito (quando a operação tem o EMV ativo)",
          "Bloqueio (todos os tipos de cartão)",
          "Atendimento humanizado (direciona para outros canais; opcional)",
          "Trocar usuário",
        ]} />
      </div>
    </Moldura>
  );
}

/* ─── Projeto ─── */

function Responsaveis(p: SlideProps) {
  const { dados } = p;
  const gp = dados.gp ? [dados.gp, dados.gpEmail, dados.gpTelefone].filter(Boolean).join(" · ") : "a definir";
  const cartoes = [
    { icone: UserRound, titulo: "Gerente de Projetos", linhas: [["Transdata", gp], ["Cliente", dados.responsavelCliente || "a definir"]] },
    { icone: Wrench, titulo: "Responsáveis técnicos", linhas: [["Transdata", dados.tecnico || "a definir"], ["Cliente", "a definir"]] },
    { icone: LifeBuoy, titulo: "Sistema de chamados (IGRE)", linhas: [["Cliente", dados.igreCliente || "a definir"]] },
  ];
  return (
    <Moldura secao="Responsáveis pelo projeto" p={p}>
      <div className="sl-entra absolute left-[64px] top-[130px] w-[400px]">
        <Titulo className="text-[50px]">Gerente de Projetos e responsáveis técnicos</Titulo>
        <Texto className="mt-6 text-[19px]">
          Responsáveis por garantir o bom andamento e a conclusão do projeto, atuando no acompanhamento, coordenação e execução das atividades previstas, assegurando o cumprimento dos prazos, escopo e qualidade definidos.
        </Texto>
      </div>
      <div className="sl-entra absolute right-[64px] top-[112px] flex w-[680px] flex-col gap-4">
        {cartoes.map(c => (
          <div key={c.titulo} className="flex items-start gap-5 rounded-[26px] bg-gradient-to-r from-marca-logo to-marca-fundo px-7 py-6 text-white shadow-[0_16px_36px_hsl(var(--marca-fundo)/0.3)]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-marca-laranja"><c.icone className="h-7 w-7" /></span>
            <div className="min-w-0">
              <p className="text-[22px] font-semibold">{c.titulo}</p>
              {c.linhas.map(([quem, nome]) => (
                <p key={quem} className="mt-1 text-[16px] text-white/80"><span className="font-semibold text-marca-lilas-claro">{quem}:</span> {nome}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

const REGRAS: { titulo: string; texto: string; cor: string }[] = [
  { titulo: "Sistemas tarifários", texto: "Comum, estudante, gratuidade e quantidade de linhas", cor: "from-marca-rosa to-marca-rosa" },
  { titulo: "Quantidade de usuários", texto: "Quantidade de usuários por tipo", cor: "from-marca-laranja to-marca-laranja" },
  { titulo: "Tipos de produtos", texto: "Estabelecer e entender as regras de concessão de benefícios e de utilização", cor: "from-emerald-500 to-emerald-500" },
  { titulo: "Tipos de cartões", texto: "As definições dos cartões que podem atender às particularidades da operação", cor: "from-cyan-500 to-cyan-500" },
  { titulo: "Integrações", texto: "Regras de integração entre as linhas e integrações de soluções", cor: "from-marca-rosa to-marca-rosa" },
  { titulo: "Regras de acesso", texto: "Débito de acesso no validador (valores em R$, os créditos representados em dinheiro), poder de compra no acesso nas mudanças de tarifa e regras de expiração de créditos", cor: "from-marca-laranja to-marca-laranja" },
  { titulo: "Máscara da linha", texto: "Dígitos para identificação das linhas", cor: "from-emerald-500 to-emerald-500" },
  { titulo: "Prefixo dos carros", texto: "Dígitos para identificação dos veículos", cor: "from-cyan-500 to-cyan-500" },
];

function Regras(p: SlideProps) {
  return (
    <Moldura secao="Operação do cliente" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[56px]">Regras de negócio</Titulo>
        <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-5">
          {REGRAS.map((r, i) => (
            <div key={r.titulo} className="flex items-start gap-4">
              <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[22px] font-bold text-white", r.cor)}>{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[21px] font-semibold text-[hsl(var(--sl-texto))]">{r.titulo}</p>
                <p className="text-[16px] leading-snug text-[hsl(var(--sl-suave))]">{r.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Moldura>
  );
}

/** Passos com seta: rótulo roxo → texto (migração, requisitos). */
function Passos({ passos, largura = 250 }: { passos: { titulo: string; texto: string; icone: typeof Camera }[]; largura?: number }) {
  return (
    <div className="space-y-4">
      {passos.map((x, i) => (
        <div key={x.titulo} className="flex items-center gap-5" style={{ paddingLeft: i * 56 }}>
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-marca-laranja to-marca-rosa text-white"><x.icone className="h-7 w-7" /></span>
          <span className="shrink-0 rounded-2xl bg-marca-logo px-5 py-4 text-center text-[19px] font-semibold leading-tight text-white" style={{ width: largura }}>{x.titulo}</span>
          <span aria-hidden className="h-[3px] w-12 shrink-0 rounded-full bg-gradient-to-r from-marca-laranja to-marca-rosa" />
          <span className="max-w-[560px] text-[18.5px] leading-snug text-[hsl(var(--sl-texto))]">{x.texto}</span>
        </div>
      ))}
    </div>
  );
}

function Migracao(p: SlideProps) {
  return (
    <Moldura secao="Migração" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">Vindo de outro sistema</Titulo>
        <div className="mt-8">
          <Passos passos={[
            { titulo: "Banco de dados", texto: "Acesso ao banco de dados atual.", icone: Database },
            { titulo: "Conversão de cartões", texto: "Não há condições de conversão de cartões.", icone: CreditCard },
            { titulo: "Operação legada", texto: "O validador Transdata aceita o saldo legado do cartão até o fim. Depois que o saldo acaba, o cartão precisa ser trocado para seguir no sistema.", icone: RefreshCw },
            { titulo: "Migração de dados", texto: "Definição de regras.", icone: DatabaseZap },
          ]} />
        </div>
      </div>
    </Moldura>
  );
}

/* ─── Escopo do contrato ─── */

function Fluxo(p: SlideProps) {
  return (
    <Moldura secao="Escopo do contrato" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px]">
        <Titulo className="text-[50px]">Fluxo primário</Titulo>
        <p className="mt-1 text-[21px] text-[hsl(var(--sl-suave))]">Sistema de Bilhetagem Eletrônica</p>
      </div>
      <img src={imgFluxo} alt="Fluxo do Sistema TDMax: autorizador, carga embarcada, pontos de venda, encerrante, coleta e cadastro" className="absolute left-[330px] top-[150px] w-[860px]" />
    </Moldura>
  );
}

function Coleta(p: SlideProps) {
  return (
    <Moldura secao="Escopo do contrato" p={p}>
      <img src={imgColeta} alt="Ponto de coleta: computador, antena e validador" className="absolute right-[56px] top-[110px] w-[700px]" />
      <div className="sl-entra absolute left-[64px] top-[118px] w-[470px]">
        <Titulo className="text-[56px]">Ponto de coleta</Titulo>
        <Texto className="mt-6">
          As informações armazenadas no validador durante a operação vão para o servidor em nuvem pelo processo de coleta, feito nas garagens ou em pontos com infraestrutura apropriada, definidos conforme a escolha do cliente.
        </Texto>
      </div>
      <div className="absolute bottom-[78px] left-[64px] right-[64px] flex items-center gap-4 rounded-2xl border border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] px-6 py-4">
        <Clock className="h-7 w-7 shrink-0 text-marca-laranja" />
        <p className="text-[18px] leading-snug text-[hsl(var(--sl-texto))]">
          A coleta começa quando o validador, com o turno encerrado, entra no alcance do Access Point e fica nele pelo tempo mínimo da transferência: <b>cerca de 30 segundos</b>.
        </p>
      </div>
    </Moldura>
  );
}

function Cadastro(p: SlideProps) {
  return (
    <Moldura secao="Escopo do contrato" p={p}>
      <img src={imgCadastro} alt="Ponto de cadastro: computador, leitora, câmera e impressora de cartões" className="absolute right-[40px] top-[120px] w-[720px]" />
      <div className="sl-entra absolute left-[64px] top-[118px] w-[460px]">
        <Titulo className="text-[56px]">Ponto de cadastro</Titulo>
        <Texto className="mt-6">
          Equipamento do Sistema de Bilhetagem Eletrônica para o cadastro de passageiros e a gravação de dados nos cartões. Registra o tipo de cartão e o produto associado, e permite formatar os cartões para impressão.
        </Texto>
      </div>
    </Moldura>
  );
}

function Venda(p: SlideProps) {
  return (
    <Moldura secao="Escopo do contrato" p={p}>
      <img src={imgPos} alt="AtlasPOS" className="sl-flutua absolute left-[470px] top-[190px] w-[340px] drop-shadow-[0_26px_30px_rgba(0,0,0,0.3)]" />
      <div className="sl-entra absolute left-[64px] top-[118px] w-[380px]">
        <Titulo className="text-[50px]">Ponto de venda</Titulo>
        <Texto className="mt-5 text-[19px]">
          Com o AtlasPOS, plataforma mobile da Transdata, é possível gerir as vendas em pontos terceirizados, como lojas, mercados e outros parceiros, com mais flexibilidade e capilaridade na venda de créditos e serviços.
        </Texto>
        <p className="mt-5 text-[15px] text-[hsl(var(--sl-suave))]">O cartão MK Transport só é necessário na inicialização do AtlasPOS.</p>
      </div>
      <div className="sl-entra absolute right-[64px] top-[118px] w-[380px]">
        <Titulo className="text-[50px]">Ponto de encerrante</Titulo>
        <Texto className="mt-5 text-[19px]">
          Ao término da jornada ou do turno, o colaborador da tripulação que recebe o valor das passagens faz a prestação de contas, conhecida como encerrante.
        </Texto>
      </div>
    </Moldura>
  );
}

const MATERIAIS: [string[], string][] = [
  [[matComputador], "Computadores (coleta e cadastro)"],
  [[matAntena], "Antena de coleta 2,4 GHz"],
  [[matLeitora], "Leitora ACR38"],
  [[matImpressora], "Impressora de cartões"],
  [[matCartao], "Cartões Mifare 1K e 4K"],
  [[matWebcam], "Webcam Logitech C270"],
  [[imgPos], "POS A910S"],
  [[matChicote, matCaboY], "Chicotes e cabos"],
  [[matCatraca, matSuporte], "Catracas"],
  [[matPendrive], "Pen drive"],
];

function Materiais(p: SlideProps) {
  return (
    <Moldura secao="Lista de materiais" p={p}>
      <div className="sl-entra absolute left-[64px] top-[118px] w-[340px]">
        <Titulo className="text-[46px]">Aquisições necessárias de responsabilidade do cliente</Titulo>
        <Texto className="mt-6 text-[18px]">
          A lista de fornecedores será enviada por e-mail, e as aquisições devem ser feitas de acordo com o escopo estabelecido em contrato.
        </Texto>
      </div>
      <div className="absolute right-[56px] top-[96px] grid w-[800px] grid-cols-4 gap-3">
        {MATERIAIS.map(([imgs, nome], i) => (
          <div key={nome} className={cn("flex h-[166px] flex-col items-center justify-end gap-2 rounded-2xl border border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] p-3", i >= 8 && "col-span-2")}>
            <span className="flex min-h-0 w-full flex-1 items-center justify-center gap-3 overflow-hidden">
              {imgs.map(src => <img key={src} src={src} alt="" className={cn("max-h-[100px] min-w-0 object-contain", imgs.length > 1 ? "max-w-[44%]" : "max-w-[150px]")} />)}
            </span>
            <span className="text-center text-[14px] font-medium leading-tight text-[hsl(var(--sl-texto))]">{nome}</span>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

/* ─── Cronograma ─── */

function Cronograma(p: SlideProps) {
  const c = p.dados.cronograma;
  const its = p.dados.solucoes.some(s => /\bits\b/i.test(s));
  const visita = (n: 1 | 2 | 3): ChipData => {
    const v = c.visitas[n];
    if (!v) return { texto: "a agendar", tipo: "pendente" };
    return v.confirmada ? { texto: periodoCurto(v.periodo), tipo: "confirmada" } : { texto: `prevista ${periodoCurto(v.periodo)}`, tipo: "prevista" };
  };
  const prazo = (d: string | null): ChipData | undefined => (d ? { texto: `até ${diaMes(d)}`, tipo: "prazo" } : undefined);
  const visitas = [1, 2, ...(its ? [3] : [])] as (1 | 2 | 3)[];
  const temConfirmada = visitas.some(n => c.visitas[n]?.confirmada), temPrevista = visitas.some(n => c.visitas[n] && !c.visitas[n]!.confirmada);
  return (
    <Moldura secao="Cronograma" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px]">
        <Titulo className="text-[54px]">Sistema de Bilhetagem Eletrônica</Titulo>
      </div>
      <Etapas className="absolute left-[64px] right-[64px] top-[232px]" etapas={[
        { titulo: "Reunião de PE", tom: "roxo", chip: c.pe ? { texto: diaMes(c.pe), tipo: "confirmada" } : { texto: "a agendar", tipo: "pendente" } },
        { titulo: "Pré-requisitos da 1ª visita", tom: "lilas", chip: prazo(c.pre1), itens: ["Chicotes (AtlasBox com RF6)", "Cartões 4K e 1K", "POS A910S", "Leitora ACR38 (inicializar cartões)", "Computadores (coleta)", "Antena de coleta (WPA 2,4 GHz)"] },
        { titulo: "1ª visita", chip: visita(1) },
        { titulo: "Pré-requisitos da 2ª visita", tom: "lilas", chip: prazo(c.pre2), itens: ["100% da instalação embarcada", "Configurações iniciais do sistema"] },
        { titulo: "2ª visita", chip: visita(2), itens: ["Serviços"] },
        ...(its ? [{ titulo: "3ª visita (ITS)", chip: visita(3) }] : []),
      ]} />
      {(temConfirmada || temPrevista) && (
        <p className="absolute bottom-[64px] left-[64px] flex items-center gap-5 text-[14px] text-[hsl(var(--sl-suave))]">
          {temConfirmada && <span className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-marca-logo text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>Confirmada na Agenda de Implantação</span>}
          {temPrevista && <span className="flex items-center gap-1.5"><span className="h-4 w-7 rounded-full border-2 border-marca-laranja bg-marca-laranja/10" />Prevista: pode mudar até a confirmação</span>}
        </p>
      )}
    </Moldura>
  );
}

function App(p: SlideProps) {
  return (
    <Moldura secao="Cronograma" p={p}>
      <img src={imgAppMao} alt="" aria-hidden className="sl-flutua absolute right-[70px] top-[70px] h-[300px]" />
      <div className="sl-entra absolute left-[64px] top-[112px] w-[760px]">
        <Titulo className="text-[56px]">App Informativo</Titulo>
        <Texto className="mt-3 text-[19px]">Do acerto das regras e das artes até o aplicativo nas lojas.</Texto>
      </div>
      <Etapas className="absolute left-[64px] right-[64px] top-[400px]" etapas={[
        { titulo: "Definição de regras e artes", icone: ClipboardCheck },
        { titulo: "Desenvolvimento", icone: Wrench },
        { titulo: "Aprovação do APK", icone: BadgeCheck },
        { titulo: "Disponibilização nas lojas", icone: Smartphone },
      ]} />
    </Moldura>
  );
}

/* ─── Gravação dos cartões ─── */

function CartaoOp({ nome, chave }: { nome: string; chave?: boolean }) {
  return (
    <div className={cn("flex h-[140px] w-[90px] flex-col items-center justify-between rounded-[12px] border px-2 py-3 shadow-[0_10px_22px_hsl(var(--marca-fundo)/0.16)]",
      chave ? "border-transparent bg-gradient-to-b from-marca-logo to-marca-fundo text-white" : "border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] text-[hsl(var(--sl-texto))]")}>
      <span aria-hidden className="h-[22px] w-[28px] rounded-[5px] bg-gradient-to-br from-amber-300 to-amber-500" />
      <span className="text-[13.5px] font-bold tracking-wide">{nome}</span>
      <img src={logoT} alt="" aria-hidden className="h-[24px]" />
    </div>
  );
}

function Cartoes(p: SlideProps) {
  return (
    <Moldura secao="Gravação dos cartões" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[400px]">
        <Titulo className="text-[50px]">Geração da chave da cidade</Titulo>
        <Texto className="mt-5 text-[19px]">
          Composta por 25 dígitos, divididos em 5 grupos de 5, a numeração é gravada em cartões distintos por gravação remota.
        </Texto>
        <p className="mt-5 text-[19px] font-semibold text-marca-rosa">As senhas permanecem as mesmas.</p>
      </div>
      <div className="absolute left-[476px] top-[150px] flex flex-col items-center gap-5">
        <CartaoOp nome="CHAVE" chave />
        <div className="flex gap-2.5">{[1, 2, 3, 4, 5].map(i => <CartaoOp key={i} nome={`SENHA ${i}`} />)}</div>
      </div>
      <img src={matLeitora} alt="Leitora de cartões" className="absolute left-[640px] top-[470px] h-[110px]" />
      <div className="sl-entra absolute right-[48px] top-[150px] w-[236px]">
        <p className="text-[21px] font-semibold text-[hsl(var(--sl-texto))]">SAM chave</p>
        <Texto className="mt-2 text-[17px]">Autentica todas as movimentações no sistema. Cada procedimento é validado por uma senha, garantindo a segurança de cada ação executada.</Texto>
      </div>
      <div className="absolute bottom-[70px] left-[64px] right-[64px] flex items-center gap-4 rounded-2xl bg-marca-rosa/10 px-6 py-3.5 text-[16.5px] text-[hsl(var(--sl-texto))]">
        <AlertTriangle className="h-6 w-6 shrink-0 text-marca-rosa" />
        <span><b>Atenção:</b> o armazenamento dessas informações deve ser feito com extremo cuidado, pela criticidade e confidencialidade da informação.</span>
      </div>
    </Moldura>
  );
}

/* ─── Biometria facial (apresentação própria) ─── */

function BioAbertura(p: SlideProps) {
  return (
    <>
      <img src={imgRosto} alt="" aria-hidden className="sl-aproxima absolute inset-0 h-full w-full object-cover object-[70%_30%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-marca-fundo/90 via-marca-fundo/50 to-transparent" />
      <img src={logoClaro} alt="Transdata" className="absolute left-[72px] top-[58px] h-[62px]" />
      <div className="sl-entra absolute left-[72px] top-[250px] w-[560px] text-white">
        <p className="text-[18px] font-semibold uppercase tracking-[0.3em] text-emerald-300">Biometria facial</p>
        <h2 className="sl-titulo mt-3 text-[92px]">Uma solução antifraude</h2>
      </div>
      <Rodape {...p} claro />
    </>
  );
}

function BioResultados(p: SlideProps) {
  return (
    <Moldura secao="Biometria facial" p={p}>
      <div className="sl-entra absolute left-[64px] top-[108px] w-[1150px]">
        <Titulo className="text-[46px]">O uso integrado das tecnologias ajuda a reduzir a evasão de receita</Titulo>
      </div>
      <div className="absolute left-[64px] top-[250px] w-[520px]">
        <p className="text-[20px] font-semibold text-[hsl(var(--sl-texto))]">Empresa Via Ágil · Piracicaba | Brasil</p>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 text-[16px] text-[hsl(var(--sl-suave))]">
          <span>397.322 habitantes</span><span>236 veículos</span><span>2.400.000 passageiros/mês</span><span>550.000 gratuidades</span>
        </div>
        <Texto className="mt-4 text-[16.5px]">No período de operação, já foram bloqueados mais de 7 mil cadastros por uso indevido comprovado.</Texto>
        <Texto className="mt-2 text-[16.5px]">A cada 100 acessos, 25,5% eram gratuitos e outros 9% de estudantes. Hoje, a empresa reduziu para 22,5% gratuitos e 7,5% estudantes.</Texto>
        <Texto className="mt-2 text-[16.5px]">Os índices mostram a capacidade da solução de verificar se o cartão com direito ao benefício é usado exatamente pela pessoa cadastrada.</Texto>
      </div>
      <div className="absolute right-[64px] top-[250px] grid w-[560px] grid-cols-2 gap-3">
        {[
          { n: "8%", t: "de redução em acessos gratuitos já no primeiro ano de implantação", largo: true },
          { n: "+7 mil", t: "cadastros bloqueados em 4 anos" },
          { n: "−3%", t: "de acessos gratuitos a cada 100 passageiros" },
          { n: "−1,5%", t: "de uso indevido por estudantes a cada 100 passageiros", largo: true },
        ].map(x => (
          <div key={x.n} className={cn("rounded-2xl border border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] px-5 py-4", x.largo && "col-span-2")}>
            <p className="sl-titulo text-[46px] text-marca-laranja">{x.n}</p>
            <p className="mt-1 text-[15.5px] leading-snug text-[hsl(var(--sl-suave))]">{x.t}</p>
          </div>
        ))}
      </div>
    </Moldura>
  );
}

function BioFunciona(p: SlideProps) {
  return (
    <Moldura secao="Biometria facial" p={p}>
      <div className="absolute right-[64px] top-[110px] flex h-[500px] w-[400px] items-center justify-center rounded-[36px] bg-gradient-to-br from-marca-logo to-marca-fundo">
        <img src={imgCamera} alt="Câmera de reconhecimento facial" className="sl-flutua h-[300px] w-[300px] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.5)]" />
      </div>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[680px]">
        <Titulo className="text-[50px]">Isso é o que a Biometria Facial da Transdata faz</Titulo>
        <Topicos className="mt-7 text-[18px]" itens={[
          "A distância entre os olhos, o comprimento do nariz, o tamanho do queixo e a linha da mandíbula são traços individuais únicos.",
          "Um software de biometria facial lê e calcula essas distâncias e gera uma sequência digital única: um certificado digital diferente para cada pessoa.",
          "Um rigoroso controle antifraude, capaz de limitar o uso de benefícios exclusivos e condições especiais sem documentos físicos.",
          "A solução antifraude ideal para evitar que pessoas não autorizadas usem benefícios exclusivos.",
        ]} />
      </div>
    </Moldura>
  );
}

function BioRequisitos(p: SlideProps) {
  return (
    <Moldura secao="Requisitos de HW e SW" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">O que a biometria precisa</Titulo>
        <div className="mt-8">
          <Passos largura={270} passos={[
            { titulo: "Câmera RF5 ou RF6", texto: "Embarcada (fornecimento Transdata).", icone: Camera },
            { titulo: "Webcam", texto: "Para o ponto de cadastro (Logitech C270).", icone: ScanFace },
            { titulo: "Banco de dados e SaaS", texto: "Fornecimento Transdata.", icone: CloudCog },
            { titulo: "Fotos cadastradas no sistema", texto: "Necessárias no cadastro do passageiro.", icone: ImageIcon },
          ]} />
        </div>
      </div>
    </Moldura>
  );
}

function BioFoto(p: SlideProps) {
  return (
    <Moldura secao="Foto do cadastro" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">Como tirar a foto do passageiro</Titulo>
        <div className="mt-9 grid grid-cols-4 gap-4">
          <Cartao icone={Lightbulb} titulo="Sala bem iluminada">Com no mínimo <b>500 lux</b> de iluminação.</Cartao>
          <Cartao icone={Square} titulo="Parede ou fundo branco">Com largura de no mínimo <b>1,40 m</b>.</Cartao>
          <Cartao icone={UserRound} titulo="Rosto centralizado">Na imagem. A cabeça <b>não pode</b> estar inclinada ou declinada.</Cartao>
          <Cartao icone={Ban} titulo="Nenhuma outra pessoa">Ou qualquer objeto deve aparecer na foto, além da pessoa fotografada.</Cartao>
        </div>
      </div>
    </Moldura>
  );
}

function BioEquipe(p: SlideProps) {
  return (
    <Moldura secao="Biometria facial" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">Requisitos de equipe</Titulo>
        <div className="mt-7 grid grid-cols-2 gap-5">
          <Cartao icone={SearchCheck} titulo="Conferente">
            Valida as fotos em que o sistema não conseguiu identificar o usuário automaticamente. Tem acesso a 5 fotos no sistema WEBPHOTOS e seleciona a que mais se aproxima da foto de cadastro.
          </Cartao>
          <Cartao icone={UsersRound} titulo="Crítico (parametrizado na penalização)">
            Depois da análise do conferente, algumas imagens passam para a validação do crítico, que audita as fotos penalizadas.
          </Cartao>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-5">
          <div className="flex items-center gap-4 rounded-2xl bg-marca-logo px-6 py-4 text-white">
            <span className="rounded-full bg-white/15 px-4 py-1.5 text-[17px] font-semibold">Não confere</span>
            <span className="text-[17px]">A foto entra na fila do crítico para validação.</span>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] px-6 py-4">
            <span className="rounded-full bg-marca-lilas/20 px-4 py-1.5 text-[15px] font-semibold text-marca-logo">Ninguém no foco · Dúvida · Câmera com problema</span>
            <span className="text-[17px] text-[hsl(var(--sl-texto))]">Não entram na fila do crítico.</span>
          </div>
        </div>
      </div>
    </Moldura>
  );
}

function BioInformacoes(p: SlideProps) {
  return (
    <Moldura secao="Biometria facial" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">Informações importantes</Titulo>
        <Topicos className="mt-6 text-[17px]" itens={[
          "As fotos ficam disponíveis no WEBPHOTOS da operadora por 7 dias corridos. Depois, vão para o banco de dados da Transdata como “fotos expiradas”.",
          "As fotos reconhecidas pela solução de reconhecimento facial não entram na fila de conferência: só vão para a conferência as fotos em que o sistema não identificou o portador do benefício.",
          "No acesso do passageiro com benefício, é capturado um lote de 5 fotos, que ficam para o conferente caso o sistema não reconheça o portador automaticamente.",
          "Para a fila do crítico só vão as fotos que o conferente marcar como NÃO CONFERE (N). A opção DÚVIDA não gera ação: sobe direto para o banco de dados.",
          "Se o conferente errar a ação em uma foto, existe a opção VOLTAR: o banco de dados mantém sempre 2 lotes conferidos de reserva, então é possível voltar até a antepenúltima conferência e mudar o status.",
          "No histórico do usuário ficam as últimas 5 transações, tendo havido conferência ou não.",
        ]} />
      </div>
    </Moldura>
  );
}

function BioConvite(p: SlideProps) {
  return (
    <>
      <img src={imgBioIlustracao} alt="" aria-hidden className="absolute bottom-0 right-0 h-[360px] [mask-image:linear-gradient(to_top_left,black_55%,transparent_95%)]" />
      <img src={imgV6AllInOne} alt="V6 all in one" className="sl-flutua absolute left-[64px] top-[230px] h-[400px] drop-shadow-[0_30px_40px_rgba(0,0,0,0.5)]" />
      <div className="sl-entra absolute left-[400px] top-[110px] w-[460px] text-white">
        <h2 className="sl-titulo text-[62px]">Agora que já sabe o que a Biometria Facial faz…</h2>
        <p className="mt-7 text-[22px] leading-relaxed text-white/80">
          Vamos implantar mais esta segurança aos passageiros e ao seu sistema de arrecadação de tarifas e contribuir com a evolução da mobilidade humana?
        </p>
      </div>
      <CantoT />
      <Rodape {...p} claro />
    </>
  );
}

/* ─── ChatBot (apresentação própria) ─── */

function ChatPrereq1(p: SlideProps) {
  return (
    <Moldura secao="Pré-requisitos" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[50px]">Lista de pré-requisitos para a implantação do ChatBot</Titulo>
        <div className="mt-8 grid grid-cols-3 gap-5">
          <Cartao icone={Globe} titulo="Site e e-mail">
            No rodapé do site, a razão social e o CNPJ iguais ao cartão da Receita Federal. O e-mail de contato precisa ter o mesmo domínio do site.
            <span className="mt-2 block text-marca-logo">Ex.: www.itstransdata.com · contato@itstransdata.com</span>
          </Cartao>
          <Cartao icone={FileText} titulo="CNPJ">
            Cartão do CNPJ atualizado da Receita Federal.
            <span className="mt-2 block text-marca-logo">projetos@itstransdata.com</span>
          </Cartao>
          <Cartao icone={Facebook} titulo="Facebook">
            Adicionar o e-mail dos dois desenvolvedores como administradores da página no período de ativação.
            <span className="mt-2 block text-marca-logo">allanoliveira@itstransdata.com<br />douglas@itstransdata.com</span>
          </Cartao>
        </div>
      </div>
    </Moldura>
  );
}

function ChatPrereq2(p: SlideProps) {
  return (
    <Moldura secao="Pré-requisitos" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[50px]">Lista de pré-requisitos para a implantação do ChatBot</Titulo>
        <div className="mt-8 grid grid-cols-4 gap-4">
          <Cartao icone={Phone} titulo="Número de telefone com DDD">
            (xx) xxxx-xxxx. O telefone <b>não pode</b> estar vinculado ao número do WhatsApp.
          </Cartao>
          <Cartao icone={MessageCircle} titulo="Nome do bot">
            O nome tem que fazer referência ao nome da empresa ou ao nome da cidade.
          </Cartao>
          <Cartao icone={ImageIcon} titulo="Logo para o avatar">
            O avatar exibido no WhatsApp deve ter 600 × 600 px, em PNG, JPG ou JPEG.
            {p.dados.logoCliente && <img src={p.dados.logoCliente} alt="" className="mt-3 h-12 max-w-[180px] object-contain" />}
          </Cartao>
          <Cartao icone={CreditCard} titulo="Dados do cartão teste">
            Número do cartão, número do cadastro no TDMax e número do CPF para o cartão teste.
          </Cartao>
        </div>
      </div>
    </Moldura>
  );
}

function ChatRegras(p: SlideProps) {
  const linhas: { titulo: string; campos: string[]; opcional?: boolean }[] = [
    { titulo: "Produtos que serão vendidos", campos: ["Nome do produto no TDMax"] },
    { titulo: "Valor da recarga", campos: ["Mínimo", "Máximo"] },
    { titulo: "Taxa de comodidade", campos: ["R$"], opcional: true },
    { titulo: "Atendimento humanizado", campos: ["Dias de atendimento", "Horário de atendimento", "Quantidade de atendentes", "E-mail dos atendentes"], opcional: true },
  ];
  return (
    <Moldura secao="Regras de negócio" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">Regras de negócio do ChatBot</Titulo>
        <div className="mt-7 space-y-3">
          {linhas.map(l => (
            <div key={l.titulo} className="flex items-center gap-6 rounded-2xl border border-[hsl(var(--sl-linha))] bg-[hsl(var(--sl-cartao))] px-6 py-4">
              <span className="w-[300px] shrink-0">
                <span className="block text-[20px] font-semibold text-[hsl(var(--sl-texto))]">{l.titulo}</span>
                {l.opcional && <span className="mt-1 inline-block rounded-full bg-marca-lilas/20 px-2.5 py-0.5 text-[12px] font-semibold text-marca-logo">Opcional</span>}
              </span>
              <span className="grid flex-1 grid-cols-2 gap-x-8 gap-y-2">
                {l.campos.map(c => (
                  <span key={c} className="flex items-end gap-2 text-[16.5px] text-[hsl(var(--sl-suave))]">
                    <span className="shrink-0 font-medium text-[hsl(var(--sl-texto))]">{c}:</span>
                    <span aria-hidden className="mb-1 h-px flex-1 border-b border-dashed border-[hsl(var(--sl-suave))]/50" />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Moldura>
  );
}

const FORM_CHATBOT = "https://forms.office.com/Pages/ResponsePage.aspx?id=42JOG5kbmk6BTPBeJaYOf8pU3nVJHBlPnVG7ab8Or6RUNDBDSzRRRUJQN1ZTQzJHMU1RRFhVVTQ3NC4u";

function ChatAtivacao(p: SlideProps) {
  return (
    <Moldura secao="Ativação" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px] w-[1150px]">
        <Titulo className="text-[54px]">Ativação do ChatBot</Titulo>
        <div className="mt-7 grid grid-cols-2 gap-5">
          <Cartao icone={FileText} titulo="Preenchimento do formulário">
            Depois de definir as regras de negócio e atender a todos os pré-requisitos, o cliente preenche o formulário. O desenvolvimento do bot começa somente depois do preenchimento.
            <a href={FORM_CHATBOT} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all text-[14px] text-marca-logo underline">{FORM_CHATBOT}</a>
          </Cartao>
          <Cartao icone={BadgeCheck} titulo="Reunião de ativação">
            Antes de agendar a reunião de ativação, o ChatBot deve ser testado pelo cliente.
          </Cartao>
        </div>
        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-marca-rosa/10 px-6 py-4 text-[17px] text-[hsl(var(--sl-texto))]">
          <AlertTriangle className="h-6 w-6 shrink-0 text-marca-rosa" />
          <span><b>Importante:</b> estar perto do telefone para receber os códigos de ativação por chamada ou SMS. O telefone não pode estar vinculado ao WhatsApp.</span>
        </div>
      </div>
    </Moldura>
  );
}

/* ─── Migração de BD (apresentação própria) ─── */

function MigProjeto(p: SlideProps) {
  return (
    <Moldura secao="Apresentação do projeto" p={p}>
      <img src={imgMigIlustracao} alt="" aria-hidden className="absolute right-[56px] top-[120px] w-[520px]" />
      <div className="sl-entra absolute left-[64px] top-[112px] w-[580px]">
        <Titulo className="text-[54px]">Migração de banco de dados</Titulo>
        <Texto className="mt-6">
          Este projeto é a migração do servidor de banco de dados do sistema de Bilhetagem TDMax no município de {p.dados.cidade}.
        </Texto>
        <div className="mt-6 flex items-start gap-4 rounded-2xl bg-marca-laranja/10 px-5 py-4">
          <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-marca-laranja" />
          <p className="text-[19px] leading-snug text-[hsl(var(--sl-texto))]">
            Como a chave/senha do sistema será mantida, não será necessário converter os cartões dos usuários. A atividade envolve a migração integral do banco de dados atual para o novo servidor.
          </p>
        </div>
      </div>
    </Moldura>
  );
}

function MigMarcos(p: SlideProps) {
  return (
    <Moldura secao="Escopo do contrato" p={p}>
      <div className="sl-entra absolute left-[64px] top-[112px]">
        <Titulo className="text-[56px]">Marcos do projeto</Titulo>
      </div>
      <Etapas className="absolute left-[64px] right-[64px] top-[300px]" etapas={[
        { titulo: "Reunião de alinhamento", icone: ClipboardCheck },
        { titulo: "Acesso ao banco de dados", icone: Database },
        { titulo: "Análise do banco de dados", icone: SearchCheck },
        { titulo: "Preparação do ambiente Transdata", icone: CloudCog },
        { titulo: "Migração de dados", icone: RefreshCw },
        { titulo: "Início da operação no ambiente Transdata", icone: BadgeCheck },
      ]} />
    </Moldura>
  );
}

function MigRegras(p: SlideProps) {
  return (
    <Moldura secao="Operação do cliente" p={p}>
      <div className="absolute left-[150px] top-[150px] flex h-[420px] w-[420px] items-center justify-center rounded-full border-[14px] border-marca-logo bg-[hsl(var(--sl-cartao))] shadow-[0_24px_60px_hsl(var(--marca-fundo)/0.2)]">
        <p className="sl-titulo text-center text-[64px] text-[hsl(var(--sl-texto))]">Regras de<br />migração</p>
      </div>
      <div className="sl-entra absolute left-[660px] top-[290px] w-[520px]">
        <p className="text-[30px] leading-snug text-[hsl(var(--sl-texto))]">Definição das regras de <b>migração do banco de dados</b>.</p>
      </div>
    </Moldura>
  );
}

/* ─── Encerramento ─── */

function Duvidas(p: SlideProps) {
  const { dados } = p;
  return (
    <>
      <img src={imgEncerramento} alt="" aria-hidden className="sl-aproxima absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-marca-fundo/95 via-marca-fundo/70 to-transparent" />
      <div className="sl-entra absolute left-[72px] top-[130px] w-[640px] text-white">
        <h2 className="sl-titulo text-[110px]">Dúvidas?</h2>
        <p className="mt-4 text-[24px] text-white/80">Obrigado pela atenção. Seguimos juntos na implantação.</p>
        {dados.gp && (
          <div className="mt-10 inline-flex items-center gap-5 rounded-[26px] border border-white/15 bg-white/10 px-7 py-5 backdrop-blur-md">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-marca-laranja to-marca-rosa"><Headphones className="h-7 w-7" /></span>
            <div>
              <p className="text-[22px] font-semibold">{dados.gp}</p>
              <p className="text-[15px] text-white/70">Gerente de Projetos</p>
              <p className="mt-1 flex flex-wrap gap-x-4 text-[16px] text-marca-lilas-claro">
                {dados.gpTelefone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{dados.gpTelefone}</span>}
                {dados.gpEmail && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{dados.gpEmail}</span>}
              </p>
            </div>
          </div>
        )}
      </div>
      <img src={logoClaro} alt="Transdata" className="absolute bottom-[56px] left-[72px] h-[48px]" />
      <div className="absolute bottom-[54px] right-[64px] text-right text-[16px] font-medium text-white/75">
        <p>+55 19 3515 1100</p>
        <p className="font-semibold text-white">itstransdata.com</p>
        <p>/SomosTransdata</p>
      </div>
    </>
  );
}

/* ─── Registro ─── */

const RENDER: Record<SlideId, { render: (p: SlideProps) => JSX.Element; escuro?: boolean }> = {
  capa: { render: Capa, escuro: true },
  atlasbox: { render: AtlasBox },
  v6: { render: V6 },
  biometria: { render: Biometria },
  its: { render: Its },
  chatbot: { render: Chatbot },
  responsaveis: { render: Responsaveis },
  regras: { render: Regras },
  migracao: { render: Migracao },
  fluxo: { render: Fluxo },
  coleta: { render: Coleta },
  cadastro: { render: Cadastro },
  venda: { render: Venda },
  materiais: { render: Materiais },
  cronograma: { render: Cronograma },
  app: { render: App },
  cartoes: { render: Cartoes },
  "bio-abertura": { render: BioAbertura, escuro: true },
  "bio-resultados": { render: BioResultados },
  "bio-funciona": { render: BioFunciona },
  "bio-requisitos": { render: BioRequisitos },
  "bio-foto": { render: BioFoto },
  "bio-equipe": { render: BioEquipe },
  "bio-informacoes": { render: BioInformacoes },
  "bio-convite": { render: BioConvite, escuro: true },
  "chat-prereq-1": { render: ChatPrereq1 },
  "chat-prereq-2": { render: ChatPrereq2 },
  "chat-regras": { render: ChatRegras },
  "chat-ativacao": { render: ChatAtivacao },
  "mig-projeto": { render: MigProjeto },
  "mig-marcos": { render: MigMarcos },
  "mig-regras": { render: MigRegras },
  duvidas: { render: Duvidas, escuro: true },
};

/** Um slide inteiro (1280×720). */
export function Slide({ id, ...p }: SlideProps & { id: SlideId }) {
  const r = RENDER[id];
  return (
    <div className={cn("slide-td", r.escuro && "sl-escuro", p.estatico && "slide-estatico")} lang="pt-BR">
      <r.render {...p} />
    </div>
  );
}
