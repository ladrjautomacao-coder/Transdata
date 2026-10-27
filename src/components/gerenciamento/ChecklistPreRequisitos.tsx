import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Circle, Copy, Mail, MinusCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CHECKLIST_ITENS, RESP_CHECKLIST, checklistLiberado, itemOk, itensAplicaveis, naoAplica, pendenciasDe,
  type GerProject, type Modulo01Estado,
} from "@/lib/gerenciamento";
import { ChecklistEmailDialog } from "./ChecklistEmailDialog";

const p2 = (n: number) => String(n).padStart(2, "0");
const dia = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
const quando = (iso: string) => { const d = new Date(iso); return `${dia(d)} às ${p2(d.getHours())}:${p2(d.getMinutes())}`; };

/**
 * Checklist de pré-requisitos do projeto (modelo "Checklist · Cadastro Novo Projeto").
 * Libera as próximas atividades só com todos os itens ok ou com exceção da diretoria.
 */
export function ChecklistPreRequisitos({ project, estado, onChange, userName }: {
  project: GerProject;
  estado: Modulo01Estado;
  onChange: (update: (e: Modulo01Estado) => Modulo01Estado) => void;
  userName: string;
}) {
  const c = estado.checklist;
  const [emailGp, setEmailGp] = useState(false);
  const set = (patch: Partial<Modulo01Estado["checklist"]>) => onChange(e => ({ ...e, checklist: { ...e.checklist, ...patch } }));
  const pendentes = pendenciasDe(estado);
  const total = itensAplicaveis(estado).length;
  const ok = total - pendentes.length;
  const semSigo = CHECKLIST_ITENS.length - total;
  const liberado = checklistLiberado(estado);
  const codigo = project.project_code ?? "—";

  const info = [
    { l: "Cliente", v: project.company_name },
    { l: "Data", v: c.em ? dia(new Date(c.em)) : dia(new Date()) },
    { l: "Projeto", v: project.project_type?.name ?? "—" },
    { l: "Executivo(a) de Vendas", v: project.executive?.full_name ?? "—" },
    { l: "Gerente de Projetos", v: project.manager?.full_name ?? "—" },
  ];

  const emailComercial = [
    `Assunto: Pendências do checklist – ${project.company_name} (${codigo})`,
    "",
    "Olá,",
    "",
    `No checklist de pré-requisitos do projeto ${project.company_name} (${codigo}), estes itens ainda não estão ok:`,
    "",
    ...pendentes.map(i => `- ${i.texto}${i.vencimento && !c.vencimentoDzero ? " (sem vencimento informado)" : ""} · responsável: ${RESP_CHECKLIST[i.resp].label}`),
    ...(c.observacoes.trim() ? ["", "Observações:", c.observacoes.trim()] : []),
    "",
    "Por favor, nos ajudem com as providências para seguirmos com o projeto.",
    "",
    "Obrigado,",
    userName,
  ].join("\n");
  const copiar = async () => {
    try { await navigator.clipboard.writeText(emailComercial); toast.success("E-mail ao Comercial copiado. Cole no seu e-mail."); }
    catch { toast.error("Não foi possível copiar. Selecione o texto e copie manualmente."); }
  };

  return (
    <div className="space-y-4">
      {/* Informações gerais (vêm do cadastro do projeto) */}
      <dl className="grid gap-x-6 gap-y-1.5 rounded-lg bg-muted/50 px-3.5 py-3 text-[13px] sm:grid-cols-2">
        {info.map(i => <div key={i.l} className="flex min-w-0 gap-2"><dt className="shrink-0 text-muted-foreground">{i.l}</dt><dd className="truncate font-medium">{i.v}</dd></div>)}
      </dl>

      {/* Pré-requisitos */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold">Pré-requisitos</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${pendentes.length ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>{ok} de {total} ok</span>
          {semSigo > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{semSigo} não se aplica{semSigo > 1 ? "m" : ""}</span>}
          <span className="ml-auto flex flex-wrap gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Responsabilidade:</span>
            {Object.values(RESP_CHECKLIST).map(r => <span key={r.label} className={`rounded px-1.5 font-semibold ${r.chip}`}>{r.label}</span>)}
          </span>
        </div>
        <ul className="divide-y overflow-hidden rounded-lg border border-border/60">
          {CHECKLIST_ITENS.map(i => {
            const na = naoAplica(estado, i);
            const marcado = !na && !!c.itens[i.id];
            const okItem = !na && itemOk(estado, i);
            // o pagamento do D-zero só fica ok com o vencimento informado
            const semData = !!i.vencimento && !c.vencimentoDzero;
            return (
              <li key={i.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 pl-3 pr-2.5 transition-colors ${na ? "bg-muted/40" : okItem ? "bg-emerald-500/[0.08] shadow-[inset_3px_0_0_0_rgb(16_185_129)]" : ""}`}>
                {okItem ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  : na ? <MinusCircle className="h-[18px] w-[18px] shrink-0 text-muted-foreground/60" aria-hidden />
                  : <Circle className="h-[18px] w-[18px] shrink-0 text-muted-foreground/50" aria-hidden />}
                <span className={`min-w-0 flex-1 text-sm font-medium leading-snug ${na ? "text-muted-foreground line-through" : okItem ? "text-emerald-900 dark:text-emerald-100" : ""}`}>{i.texto}</span>
                {i.podeNaoAplicar && (
                  // no celular desce para a linha de baixo, alinhado ao texto
                  <span className="order-last basis-full pl-[30px] sm:order-none sm:basis-auto sm:pl-0">
                    <button type="button" disabled={liberado} aria-pressed={na} onClick={() => set({ naoAplica: { ...c.naoAplica, [i.id]: !na } })}
                      title={na ? "Voltar a contar este item" : "O cliente não contratou este serviço do Sigo"}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70 ${na ? "border-foreground/60 bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>
                      Não se aplica
                    </button>
                  </span>
                )}
                {i.vencimento && (
                  // no celular o vencimento desce para a linha de baixo, alinhado ao texto
                  <span className="order-last flex basis-full items-center gap-1.5 pl-[30px] sm:order-none sm:basis-auto sm:pl-0">
                    <Label htmlFor="ger-ck-venc" className="text-[11px] text-muted-foreground">Vencimento</Label>
                    <Input id="ger-ck-venc" type="date" disabled={liberado} className={`h-8 w-[150px] text-xs ${marcado && !c.vencimentoDzero ? "border-amber-500" : ""}`}
                      value={c.vencimentoDzero} onChange={ev => set({ vencimentoDzero: ev.target.value })} />
                  </span>
                )}
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${RESP_CHECKLIST[i.resp].chip}`}>{RESP_CHECKLIST[i.resp].label}</span>
                {!na && (
                  <Button type="button" size="sm" aria-pressed={marcado}
                    disabled={liberado || (!marcado && semData)}
                    title={marcado ? "Clique para desfazer" : semData ? "Informe o vencimento primeiro" : "Marcar como ok"}
                    aria-label={`${i.texto}: ${marcado ? "desfazer ok" : "marcar como ok"}`}
                    onClick={() => set({ itens: { ...c.itens, [i.id]: !marcado } })}
                    className={`h-7 w-[60px] px-0 text-xs ${okItem
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-100"
                      : marcado // marcado, mas o vencimento foi apagado
                      ? "border border-amber-500 bg-background text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
                      : "border border-border bg-background text-foreground hover:border-emerald-500 hover:bg-emerald-500/10"}`}>
                    <Check className="mr-1 h-3.5 w-3.5" />OK
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <Label className="text-xs" htmlFor="ger-ck-obs">Observações</Label>
        <Textarea id="ger-ck-obs" className="mt-1.5 min-h-[72px]" disabled={liberado} placeholder="Ex.: o cliente possui pendências financeiras já acordadas e pagas mensalmente."
          value={c.observacoes} onChange={ev => set({ observacoes: ev.target.value })} />
      </div>

      {/* Resultado */}
      {liberado ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-[13px]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="min-w-0 flex-1">
              {c.resultado === "excecao"
                ? <>Exceção autorizada por <b>{c.autorizadoPor}</b> com {ok} de {total} itens ok, registrada em {quando(c.em!)} por {userName}</>
                : <>Checklist atendido, com todos os itens ok{semSigo ? ` (${semSigo} do Sigo não se aplica${semSigo > 1 ? "m" : ""})` : ""}, confirmado em {quando(c.em!)} por {userName}</>}
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => set({ em: null, resultado: null, emailGpEm: null })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Desfazer</Button>
          </div>
          {/* checklist liberado: avisar o GP do projeto por e-mail */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button className="h-9" onClick={() => setEmailGp(true)}><Mail className="mr-1.5 h-4 w-4" />Montar e-mail ao GP</Button>
            {c.emailGpEm
              ? <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />E-mail ao GP enviado em {quando(c.emailGpEm)}</span>
              : <span className="text-[12px] text-muted-foreground">Avise o Gerente de Projetos{project.manager?.full_name ? ` (${project.manager.full_name})` : ""} que o checklist foi liberado.</span>}
          </div>
        </div>
      ) : pendentes.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07] p-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="min-w-0 flex-1 text-[13px]"><b>Todos os pré-requisitos estão ok.</b> Ao confirmar, as próximas atividades são liberadas.</p>
          <Button onClick={() => set({ resultado: "atendido", em: new Date().toISOString() })}><Check className="mr-1.5 h-4 w-4" />Confirmar checklist atendido</Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.07] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 text-[13px]">
              <p><b>{pendentes.length === 1 ? "1 pendência" : `${pendentes.length} pendências`}:</b> as próximas atividades ficam bloqueadas até todos os itens estarem ok.</p>
              <ul className="mt-1 space-y-0.5">
                {pendentes.map(i => (
                  <li key={i.id} className="flex flex-wrap items-center gap-1.5">
                    <span>· {i.texto}{i.vencimento && c.itens[i.id] && !c.vencimentoDzero ? " (falta o vencimento)" : ""}</span>
                    <span className={`rounded px-1.5 text-[10.5px] font-semibold ${RESP_CHECKLIST[i.resp].chip}`}>{RESP_CHECKLIST[i.resp].label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 bg-background" onClick={copiar}><Copy className="mr-1.5 h-3.5 w-3.5" />Copiar e-mail ao Comercial</Button>
            {c.emailComercialEm
              ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200"><Mail className="h-3.5 w-3.5" />E-mail enviado em {quando(c.emailComercialEm)}</span>
              : <Button size="sm" className="h-8" onClick={() => set({ emailComercialEm: new Date().toISOString() })}><Mail className="mr-1.5 h-3.5 w-3.5" />Registrar envio do e-mail</Button>}
          </div>
          <div className="border-t border-amber-500/30 pt-3">
            <p className="mb-2 text-xs text-muted-foreground">Exceção: só com autorização da diretoria por e-mail (guarde o e-mail na pasta do projeto).</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1 basis-56">
                <Label className="text-xs" htmlFor="ger-autorizou">Quem da diretoria autorizou</Label>
                <Input id="ger-autorizou" className="mt-1.5 h-9 bg-background" placeholder="Nome do diretor" value={c.autorizadoPor} onChange={ev => set({ autorizadoPor: ev.target.value })} />
              </div>
              <Button variant="outline" className="h-9 bg-background" disabled={!c.autorizadoPor.trim()} onClick={() => set({ resultado: "excecao", em: new Date().toISOString() })}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />Registrar exceção da diretoria
              </Button>
            </div>
          </div>
        </div>
      )}
      <ChecklistEmailDialog open={emailGp} onOpenChange={setEmailGp} project={project} estado={estado} remetente={userName}
        onCopiado={() => onChange(e => ({ ...e, checklist: { ...e.checklist, emailGpEm: e.checklist.emailGpEm ?? new Date().toISOString() } }))} />
    </div>
  );
}
