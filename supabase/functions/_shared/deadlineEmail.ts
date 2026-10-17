// Modelos de e-mail dos alertas de prazo (layout do mockup aprovado).
// HTML de e-mail: tabelas, estilos inline e fontes do sistema — Outlook e Gmail
// não carregam fontes da web nem entendem flex/grid.
import {
  CONTRACT_MILESTONES, MILESTONE_LABEL, addDays, addMonths, daysBetween, fmtDate, fmtDayMonth, fmtLongDate,
  plural, remainingShort, remainingText, timeLeft, toneOf, weekday,
  type DeadlineKind, type DeadlineMilestone, type Tone,
} from "./deadlineDates.ts";

/** Uma linha de public.project_deadline_alerts(). */
export interface DeadlineAlert {
  project_id: string;
  company_name: string;
  project_code: string | null;
  city: string | null;
  state: string | null;
  status: string;
  sub_phase: string | null;
  manager_name: string | null;
  executive_name: string | null;
  contract_date: string;
  kind: DeadlineKind;
  milestone: DeadlineMilestone;
  deadline_days: number;
  due_date: string;
  days_left: number;
}

export interface EmailContext {
  /** Data de hoje em Brasília (YYYY-MM-DD). */
  today: string;
  portalUrl: string;
  logoUrl: string;
  recipients: string[];
  /** O GP do projeto também recebe (aparece no rodapé). */
  includesManager: boolean;
  statusLabels?: Record<string, string> | null;
  roleLabels?: { manager?: string | null; executive?: string | null } | null;
  /** E-mail de teste disparado pelo admin (faixa de aviso e "[Teste]" no assunto). */
  test?: boolean;
}

export interface RenderedEmail { subject: string; preheader: string; html: string; text: string }

const FONT = "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const C = {
  ink: "#1F1630", body: "#4F465C", muted: "#6B6378", line: "#E6E0EC", soft: "#FAF8FC", panel: "#F6F2FA",
  page: "#EFEBF3", brand: "#4D1475", track: "#EEE9F3", steps: "#3B3347",
};
const TONE: Record<Tone, { text: string; bg: string; dot: string; bar: string; tileBg: string; tileBorder: string; tileLabel: string }> = {
  amber: { text: "#8A5A00", bg: "#FFF7E0", dot: "#D29A00", bar: "#D29A00", tileBg: "#FFFAEB", tileBorder: "#F1DFA6", tileLabel: "#6A4500" },
  orange: { text: "#B54708", bg: "#FFF0E5", dot: "#F27405", bar: "#E8590C", tileBg: "#FFF4EB", tileBorder: "#F9D4B5", tileLabel: "#7E3A0A" },
  purple: { text: "#4D1475", bg: "#F3ECFA", dot: "#4D1475", bar: "#4D1475", tileBg: "#F7F2FC", tileBorder: "#DCCDEB", tileLabel: "#3A1059" },
};

const DEFAULT_STATUS: Record<string, string> = {
  comercial: "Comercial", planejamento: "Planejamento", implantacao: "Implantação", encerrado: "Implementado", suspenso: "Outros",
};
const SUB_PHASE: Record<string, string> = {
  aguardando_contrato: "Aguardando contrato", contrato_assinado: "Contrato Transdata assinado",
  cobranca_dzero: "Cobrança D-zero emitida", pagamento_dzero: "Pagamento D-zero efetuado",
  sem_pendencias: "Cliente sem pendências financeiras", reuniao_handover: "Reunião de Handover",
  reuniao_kickoff: "Reunião de Kick-off", reuniao_proj_executivo: "Reunião Projeto Executivo",
  levantamento_materiais: "Levantamento de Materiais", aquisicao_materiais: "Aquisição de Materiais",
  cronograma_visita: "Cronograma de Visita Técnica", suspenso: "Suspenso", cancelado: "Cancelado", piloto_reprovado: "Piloto reprovado",
};

export const SAMPLE_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listPt = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}` : xs[0] ?? "");

const phaseOf = (a: DeadlineAlert, ctx: EmailContext) => {
  const st = ctx.statusLabels?.[a.status] || DEFAULT_STATUS[a.status] || a.status;
  const sp = a.sub_phase ? SUB_PHASE[a.sub_phase] : null;
  return sp && sp !== st ? `${st} · ${sp}` : st;
};
const placeOf = (a: DeadlineAlert) => [a.city, a.state].filter(Boolean).join("/");
const managerLabel = (ctx: EmailContext) => ctx.roleLabels?.manager?.trim() || "Gerente de Projetos";
const executiveLabel = (ctx: EmailContext) => ctx.roleLabels?.executive?.trim() || "Executivo de Vendas";
/** Acompanhamento do projeto (notas do GP, linha da vida e mudanças de status). */
const projectUrl = (a: DeadlineAlert, ctx: EmailContext) =>
  a.project_id === SAMPLE_PROJECT_ID ? `${ctx.portalUrl}/comercial` : `${ctx.portalUrl}/comercial?projeto=${encodeURIComponent(a.project_id)}`;
/** Cronograma do projeto: etapas e linha do tempo das visitas técnicas. */
const cronogramaUrl = (a: DeadlineAlert, ctx: EmailContext) =>
  a.project_id === SAMPLE_PROJECT_ID ? `${ctx.portalUrl}/projetos/cronograma` : `${ctx.portalUrl}/projetos/cronograma?projeto=${encodeURIComponent(a.project_id)}`;
const elapsedOf = (a: DeadlineAlert, today: string) => {
  const used = Math.min(a.deadline_days, Math.max(0, daysBetween(a.contract_date, today)));
  return { used, pct: a.deadline_days > 0 ? Math.round((used / a.deadline_days) * 100) : 0 };
};
const subtitleOf = (a: DeadlineAlert, extra?: string) => [a.project_code, placeOf(a), extra].filter(Boolean).map(esc).join(" · ");

/* ─── Peças ─────────────────────────────────────────────────────────────── */
const tbl = (inner: string, style = "", attrs = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${attrs} style="border-collapse:separate;${style}">${inner}</table>`;
const gap = (h: number) => `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;

const pill = (text: string, tone: Tone) =>
  `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${TONE[tone].bg};color:${TONE[tone].text};font:700 13px/18px ${FONT};"><span style="color:${TONE[tone].dot};">&#9679;</span>&nbsp;${esc(text)}</span>`;
const overline = (text: string) =>
  `<span style="font:600 12px/18px ${FONT};letter-spacing:0.1em;text-transform:uppercase;color:${C.muted};">${esc(text)}</span>`;

function hero(top: string, title: string, introHtml: string) {
  return `<tr><td class="px" style="padding:32px 32px 0;">${top}
    <h1 class="h1" style="margin:12px 0 0;font:700 26px/34px ${FONT};color:${C.ink};letter-spacing:-0.01em;">${esc(title)}</h1>
    <p style="margin:12px 0 0;font:400 15px/24px ${FONT};color:${C.body};">${introHtml}</p></td></tr>`;
}

/** Grade de 2 colunas (no celular vira 1). Valores já em HTML. */
function facts(items: { label: string; html: string; color?: string }[]) {
  const cell = (it: { label: string; html: string; color?: string }) =>
    `<td class="col" width="50%" valign="top" style="padding:0 12px 14px 0;">
      <div style="font:700 11px/16px ${FONT};letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">${esc(it.label)}</div>
      <div style="margin-top:3px;font:${it.color ? 700 : 400} 15px/22px ${FONT};color:${it.color ?? C.ink};">${it.html}</div></td>`;
  let rows = "";
  for (let i = 0; i < items.length; i += 2) rows += `<tr>${cell(items[i])}${items[i + 1] ? cell(items[i + 1]) : "<td></td>"}</tr>`;
  return tbl(rows);
}

function bar(pct: number, tone: Tone, height = 10) {
  const w = Math.max(2, Math.min(100, pct));
  const fill = `<td width="${w}%" height="${height}" bgcolor="${TONE[tone].bar}" style="height:${height}px;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>`;
  return tbl(`<tr>${fill}${w < 100 ? `<td style="font-size:0;line-height:0;">&nbsp;</td>` : ""}</tr>`, `background:${C.track};border-radius:999px;`, `bgcolor="${C.track}"`);
}

function progress(label: string, detailHtml: string, pct: number, tone: Tone, scale: string[]) {
  const scaleCells = scale.map((s, i) =>
    `<td align="${i === 0 ? "left" : i === scale.length - 1 ? "right" : "center"}" style="font:400 12px/18px ${FONT};color:${C.muted};">${esc(s)}</td>`).join("");
  return tbl(`<tr><td style="font:600 13px/20px ${FONT};color:${C.ink};">${esc(label)}</td><td align="right" style="font:400 13px/20px ${FONT};color:${C.body};">${detailHtml}</td></tr>`)
    + gap(8) + bar(pct, tone) + gap(8) + tbl(`<tr>${scaleCells}</tr>`);
}

function projectCard(a: DeadlineAlert, subtitleHtml: string, factsHtml: string, progressHtml: string) {
  return `<tr><td class="px" style="padding:24px 32px 0;">${tbl(`
    <tr><td style="padding:16px 20px;background:${C.soft};border-bottom:1px solid ${C.line};border-radius:10px 10px 0 0;">
      <div style="font:700 17px/24px ${FONT};color:${C.ink};">${esc(a.company_name)}</div>
      <div style="margin-top:2px;font:400 13px/19px ${FONT};color:${C.muted};">${subtitleHtml}</div></td></tr>
    <tr><td style="padding:16px 20px 4px;">${factsHtml}</td></tr>
    <tr><td style="padding:4px 20px 18px;">${progressHtml}</td></tr>`, `border:1px solid ${C.line};border-radius:10px;`)}</td></tr>`;
}

const button = (href: string, label: string, primary = true) =>
  `<a href="${esc(href)}" class="btn" style="display:inline-block;padding:13px 24px;border-radius:8px;${primary
    ? `background:${C.brand};color:#FFFFFF;border:1px solid ${C.brand};`
    : `background:#FFFFFF;color:${C.brand};border:1px solid #D8CFE2;`}font:700 15px/20px ${FONT};text-decoration:none;">${esc(label)}</a>`;
const buttons = (...btns: string[]) =>
  `<tr><td class="px" style="padding:24px 32px 0;">${btns.join(`<span class="sp" style="display:inline-block;width:12px;height:10px;"></span>`)}</td></tr>`;

function stepsBlock(list: string[]) {
  const items = list.map((s, i) => tbl(`<tr>
    <td width="36" valign="top" style="padding-top:10px;"><div style="width:24px;height:24px;border-radius:12px;background:${C.brand};color:#FFFFFF;font:700 12px/24px ${FONT};text-align:center;">${i + 1}</div></td>
    <td valign="top" style="padding-top:12px;font:400 14px/21px ${FONT};color:${C.steps};">${s}</td></tr>`)).join("");
  return `<tr><td class="px" style="padding:28px 32px 0;">${tbl(`<tr><td style="padding:18px 22px 20px;">
    <div style="font:700 15px/22px ${FONT};color:${C.ink};">O que fazer agora</div>${items}</td></tr>`, `background:${C.panel};border-radius:10px;`, `bgcolor="${C.panel}"`)}</td></tr>`;
}

const note = (title: string, text: string, pad = "24px 32px 28px") =>
  `<tr><td class="px" style="padding:${pad};font:400 12px/19px ${FONT};color:${C.muted};"><b style="color:${C.body};">${esc(title)}</b> ${esc(text)}</td></tr>`;

function footerText(ctx: EmailContext) {
  const who = [...ctx.recipients];
  return `Enviado para ${listPt(who)}${ctx.includesManager ? `${who.length ? " e" : ""} para o ${managerLabel(ctx)} responsável` : ""}.`;
}

function shell(ctx: EmailContext, title: string, preheader: string, blocks: string[]) {
  const testBanner = ctx.test
    ? `<tr><td class="px" style="padding:12px 32px;background:#FFF7E0;font:600 13px/19px ${FONT};color:#6A4500;">E-mail de teste enviado pelo portal. Nenhuma ação é necessária.</td></tr>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title>
<style>
@media (max-width: 620px) {
  .container { width: 100% !important; }
  .px { padding-left: 20px !important; padding-right: 20px !important; }
  .col { display: block !important; width: 100% !important; padding-right: 0 !important; }
  .btn { display: block !important; text-align: center !important; }
  .sp { display: block !important; width: auto !important; }
  .h1 { font-size: 22px !important; line-height: 30px !important; }
}
</style></head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;border-collapse:separate;">
<tr><td class="px" bgcolor="${C.brand}" style="padding:22px 32px;background:${C.brand};border-radius:12px 12px 0 0;">${tbl(`<tr>
  <td><img src="${esc(ctx.logoUrl)}" height="46" alt="Transdata" style="display:block;height:46px;width:auto;border:0;color:#FFFFFF;font:700 20px ${FONT};"></td>
  <td align="right" style="font:600 12px/16px ${FONT};letter-spacing:0.12em;text-transform:uppercase;color:#E4D5F2;">Portal de Projetos</td></tr>`)}</td></tr>
<tr><td height="4" bgcolor="#FF7705" style="height:4px;line-height:4px;font-size:0;background:#FF7705;background-image:linear-gradient(90deg,#FF7705,#FF1E2E);">&nbsp;</td></tr>
${testBanner}
${blocks.join("\n")}
<tr><td class="px" style="padding:20px 32px;background:#F6F3F9;border-top:1px solid ${C.line};border-radius:0 0 12px 12px;font:400 12px/18px ${FONT};color:${C.muted};">${esc(footerText(ctx))}<br>Portal de Projetos Transdata · mensagem automática, não é preciso responder.</td></tr>
</table></td></tr></table>
</body></html>`;
}

const subjectOf = (ctx: EmailContext, s: string) => (ctx.test ? `[Teste] ${s}` : s);
const textOf = (lines: (string | null | false)[]) => lines.filter(l => l !== null && l !== false).join("\n");

/* ─── Alerta de prazo de implantação ────────────────────────────────────── */
function implantacaoEmail(a: DeadlineAlert, ctx: EmailContext): RenderedEmail {
  const { today } = ctx;
  const due = a.due_date;
  const tone = toneOf("implantacao", a.milestone);
  const left = daysBetween(today, due);
  const phase = phaseOf(a, ctx);
  const gp = a.manager_name?.trim() || null;
  const { used, pct } = elapsedOf(a, today);
  const title = `O prazo de implantação de ${a.company_name} termina em ${fmtDate(due)}`;
  const leftPlain = left <= 0 ? "A finalização prevista é hoje" : `Faltam ${plural(left, "dia", "dias")} para a finalização prevista`;
  const introPlain = `${leftPlain} e o projeto ainda está em ${phase}. Confira o andamento${gp ? ` com ${gp}` : ""} e, se a data mudou, atualize o projeto no portal.`;
  const introHtml = `${left <= 0 ? "A finalização prevista é <b>hoje</b>" : `Faltam <b style="color:${C.ink};">${plural(left, "dia", "dias")}</b> para a finalização prevista`}`
    + ` e o projeto ainda está em <b style="color:${C.ink};">${esc(phase)}</b>. Confira o andamento${gp ? ` com ${esc(gp)}` : ""} e, se a data mudou, atualize o projeto no portal.`;
  const steps = [
    "Confira o cronograma e as visitas técnicas e veja se a implantação termina dentro do prazo.",
    "Se a data foi renegociada com o cliente, atualize o <b>Prazo de implantação</b> no cadastro do projeto.",
    "Se houver risco de atraso, alinhe o plano com o gestor ainda este mês.",
  ];
  const why = "a finalização prevista é a data do contrato somada ao prazo de implantação. O portal avisa 30 dias antes dessa data, para projetos que ainda não foram implementados.";
  const subject = subjectOf(ctx, `[Prazo de implantação] ${a.company_name} · ${remainingText("implantacao", today, due)} (${fmtDate(due)})`);

  const html = shell(ctx, title, introPlain, [
    hero(`${pill(cap(remainingText("implantacao", today, due)), tone)}&nbsp;&nbsp;${overline("Alerta de prazo de implantação")}`, title, introHtml),
    projectCard(a, subtitleOf(a),
      facts([
        { label: "Finalização prevista", html: `${fmtDate(due)} · ${weekday(due)}`, color: TONE[tone].text },
        { label: "Prazo de implantação", html: `${a.deadline_days} dias desde ${fmtDate(a.contract_date)}` },
        { label: managerLabel(ctx), html: esc(gp ?? "Não definido") },
        { label: "Fase atual", html: esc(phase) },
      ]),
      progress("Prazo decorrido", `${used} de ${a.deadline_days} dias · <b style="color:${TONE[tone].text};">${pct}%</b>`, pct, tone,
        [`Contrato ${fmtDayMonth(a.contract_date)}`, `Hoje ${fmtDayMonth(today)}`, `Prazo ${fmtDayMonth(due)}`])),
    buttons(button(projectUrl(a, ctx), "Abrir projeto no portal"), button(cronogramaUrl(a, ctx), "Ver cronograma e visitas", false)),
    stepsBlock(steps),
    note("Por que você recebeu este aviso:", why),
  ]);
  const text = textOf([
    title, "", introPlain, "",
    `Projeto: ${a.company_name}${subtitleOf(a) ? ` (${[a.project_code, placeOf(a)].filter(Boolean).join(" · ")})` : ""}`,
    `Finalização prevista: ${fmtDate(due)} (${weekday(due)})`,
    `Prazo de implantação: ${a.deadline_days} dias desde ${fmtDate(a.contract_date)}`,
    `${managerLabel(ctx)}: ${gp ?? "Não definido"}`,
    `Fase atual: ${phase}`,
    `Prazo decorrido: ${used} de ${a.deadline_days} dias (${pct}%)`, "",
    `Abrir projeto: ${projectUrl(a, ctx)}`,
    `Cronograma e visitas: ${cronogramaUrl(a, ctx)}`, "",
    "O que fazer agora:", ...steps.map((s, i) => `${i + 1}. ${s.replace(/<[^>]+>/g, "")}`), "",
    `Por que você recebeu este aviso: ${why}`, "",
    footerText(ctx),
  ]);
  return { subject, preheader: introPlain, html, text };
}

/* ─── Alerta de prazo de contrato ───────────────────────────────────────── */
function contratoEmail(a: DeadlineAlert, ctx: EmailContext): RenderedEmail {
  const { today } = ctx;
  const due = a.due_date;
  const tone = toneOf("contrato", a.milestone);
  const left = daysBetween(today, due);
  const phase = phaseOf(a, ctx);
  const gp = a.manager_name?.trim() || null;
  const exec = a.executive_name?.trim() || null;
  const { used, pct } = elapsedOf(a, today);
  const last = a.milestone === "3m";
  const title = `O contrato de ${a.company_name} termina em ${fmtDate(due)}`;
  const leftPlain = left <= 0 ? "O contrato termina hoje." : `Faltam ${timeLeft(today, due)} para o fim do contrato.`;
  const nextPlain = last
    ? "Este é o último aviso antes do fim: alinhe agora com o cliente a renovação ou o aditivo."
    : "É um bom momento para conversar com o cliente sobre renovação ou aditivo.";
  const introPlain = `${leftPlain} ${nextPlain}`;
  const introHtml = `${left <= 0 ? "O contrato termina <b>hoje</b>." : `Faltam <b style="color:${C.ink};">${esc(timeLeft(today, due))}</b> para o fim do contrato.`} `
    + (last
      ? `Este é o último aviso antes do fim: alinhe agora com o cliente a <b style="color:${C.ink};">renovação ou o aditivo</b>.`
      : `É um bom momento para conversar com o cliente sobre <b style="color:${C.ink};">renovação ou aditivo</b>.`);

  const tracker = CONTRACT_MILESTONES.map(({ milestone, months }) => {
    const when = addMonths(due, -months);
    const state = milestone === a.milestone ? "atual" : when < today ? "passado" : "futuro";
    const circle = state === "passado"
      ? `<div style="width:28px;height:28px;border-radius:14px;background:${C.brand};color:#FFFFFF;font:700 14px/28px ${FONT};text-align:center;margin:0 auto;">&#10003;</div>`
      : state === "atual"
        ? `<div style="width:22px;height:22px;border-radius:14px;border:3px solid ${TONE[tone].dot};background:${TONE[tone].bg};color:${TONE[tone].dot};font:700 12px/22px ${FONT};text-align:center;margin:0 auto;">&#9679;</div>`
        : `<div style="width:24px;height:24px;border-radius:14px;border:2px solid #C9BFD4;background:#FFFFFF;margin:0 auto;">&nbsp;</div>`;
    const sub = state === "atual" ? `este aviso · ${fmtDate(today)}` : state === "passado" ? `aviso de ${fmtDate(when)}` : `previsto para ${fmtDate(when)}`;
    const color = state === "atual" ? TONE[tone].text : state === "futuro" ? C.body : C.ink;
    return `<td width="33%" align="center" valign="top" style="padding:0 4px;">${circle}
      <div style="margin-top:6px;font:700 13px/18px ${FONT};color:${color};">${MILESTONE_LABEL[milestone]} antes</div>
      <div style="margin-top:2px;font:${state === "atual" ? 600 : 400} 12px/17px ${FONT};color:${state === "atual" ? TONE[tone].text : C.muted};">${sub}</div></td>`;
  }).join("");

  const steps = [
    "Converse com o cliente sobre a renovação ou um aditivo do contrato.",
    `Alinhe com o ${esc(executiveLabel(ctx))}${exec ? ` (${esc(exec)})` : ""} a proposta e os próximos passos.`,
    "Se a vigência mudou, atualize o <b>Prazo contratual</b> no cadastro do projeto.",
  ];
  const why = "o fim do contrato é a data do contrato somada ao prazo contratual. O portal avisa com 12, 6 e 3 meses de antecedência.";
  const subject = subjectOf(ctx, `[Prazo de contrato] ${a.company_name} · ${remainingText("contrato", today, due)} (${fmtDate(due)})`);

  const html = shell(ctx, title, introPlain, [
    hero(`${pill(cap(remainingText("contrato", today, due)), tone)}&nbsp;&nbsp;${overline("Alerta de prazo de contrato")}`, title, introHtml),
    projectCard(a, subtitleOf(a, phase),
      facts([
        { label: "Fim do contrato", html: `${fmtDate(due)} · ${weekday(due)}`, color: TONE[tone].text },
        { label: "Vigência", html: `${a.deadline_days} dias desde ${fmtDate(a.contract_date)}` },
        { label: managerLabel(ctx), html: esc(gp ?? "Não definido") },
        { label: executiveLabel(ctx), html: esc(exec ?? "Não definido") },
      ]),
      progress("Vigência decorrida", `${used} de ${a.deadline_days} dias · <b style="color:${TONE[tone].text};">${pct}%</b>`, pct, tone,
        [`Início ${fmtDate(a.contract_date)}`, `Hoje ${fmtDate(today)}`, `Fim ${fmtDate(due)}`])),
    `<tr><td class="px" style="padding:20px 32px 0;">${tbl(`<tr><td style="padding:16px 16px 18px;">
      <div style="font:700 13px/18px ${FONT};letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};margin-bottom:14px;">Avisos deste contrato</div>
      ${tbl(`<tr>${tracker}</tr>`)}</td></tr>`, `border:1px solid ${C.line};border-radius:10px;`)}</td></tr>`,
    buttons(button(projectUrl(a, ctx), "Abrir projeto no portal")),
    stepsBlock(steps),
    note("Por que você recebeu este aviso:", why),
  ]);
  const text = textOf([
    title, "", introPlain, "",
    `Projeto: ${a.company_name} (${[a.project_code, placeOf(a), phase].filter(Boolean).join(" · ")})`,
    `Fim do contrato: ${fmtDate(due)} (${weekday(due)})`,
    `Vigência: ${a.deadline_days} dias desde ${fmtDate(a.contract_date)}`,
    `${managerLabel(ctx)}: ${gp ?? "Não definido"}`,
    `${executiveLabel(ctx)}: ${exec ?? "Não definido"}`,
    `Vigência decorrida: ${used} de ${a.deadline_days} dias (${pct}%)`, "",
    `Abrir projeto: ${projectUrl(a, ctx)}`, "",
    "O que fazer agora:", ...steps.map((s, i) => `${i + 1}. ${s.replace(/<[^>]+>/g, "")}`), "",
    `Por que você recebeu este aviso: ${why}`, "",
    footerText(ctx),
  ]);
  return { subject, preheader: introPlain, html, text };
}

export function renderAlertEmail(a: DeadlineAlert, ctx: EmailContext): RenderedEmail {
  return a.kind === "implantacao" ? implantacaoEmail(a, ctx) : contratoEmail(a, ctx);
}

/* ─── Resumos semanais: um de implantação e outro de contrato ──────────── */
const byDue = (x: DeadlineAlert, y: DeadlineAlert) => x.due_date.localeCompare(y.due_date) || x.company_name.localeCompare(y.company_name);
const verbN = (n: number) => (n === 1 ? "termina" : "terminam");

function tilesRow(items: [number, string, Tone][]) {
  const tds = items.map(([n, label, t], i) => `<td class="col" width="33%" valign="top" style="padding:0 ${i < items.length - 1 ? 12 : 0}px 12px 0;">${tbl(`<tr><td style="padding:14px 16px;">
      <div style="font:800 30px/36px ${FONT};color:${TONE[t].text};">${n}</div>
      <div style="margin-top:2px;font:600 13px/18px ${FONT};color:${TONE[t].tileLabel};">${esc(label)}</div></td></tr>`,
    `background:${TONE[t].tileBg};border:1px solid ${TONE[t].tileBorder};border-radius:10px;`, `bgcolor="${TONE[t].tileBg}"`)}</td>`).join("");
  return `<tr><td class="px" style="padding:24px 32px 0;">${tbl(`<tr>${tds}</tr>`)}</td></tr>`;
}
const sectionHeading = (text: string, tone: Tone) =>
  `<div style="font:700 13px/18px ${FONT};letter-spacing:0.06em;text-transform:uppercase;color:${TONE[tone].text};"><span style="color:${TONE[tone].dot};">&#9679;</span>&nbsp;${esc(text)}</div>`;
const emptyNote = (text: string) => `<div style="margin-top:12px;font:400 14px/21px ${FONT};color:${C.muted};">${esc(text)}</div>`;
const wideButton = (href: string, label: string) =>
  `<tr><td class="px" style="padding:28px 32px 0;"><a href="${esc(href)}" class="btn" style="display:block;padding:13px 24px;border-radius:8px;background:${C.brand};color:#FFFFFF;text-align:center;font:700 15px/20px ${FONT};text-decoration:none;">${esc(label)}</a></td></tr>`;

/** Faixa de urgência da implantação: até 7 dias, 8 a 15, 16 a 30. */
const implTone = (days: number): Tone => (days <= 7 ? "orange" : days <= 15 ? "amber" : "purple");
const implLeft = (days: number) => (days <= 0 ? "vence hoje" : days === 1 ? "vence amanhã" : `em ${days} dias`);

/** Resumo semanal de implantação: projetos não implementados com finalização nos próximos 30 dias. */
export function renderImplantacaoDigest(alerts: DeadlineAlert[], ctx: EmailContext): RenderedEmail {
  const { today } = ctx;
  const impl = alerts.filter(a => a.kind === "implantacao").sort(byDue);
  const days = (a: DeadlineAlert) => daysBetween(today, a.due_date);
  const c7 = impl.filter(a => days(a) <= 7).length;
  const c15 = impl.filter(a => days(a) > 7 && days(a) <= 15).length;
  const c30 = impl.length - c7 - c15;
  const n = impl.length;
  const title = n ? `${plural(n, "implantação", "implantações")} ${verbN(n)} nos próximos 30 dias` : "Nenhuma implantação termina nos próximos 30 dias";
  const introPlain = `${cap(fmtLongDate(today))}. Projetos ainda não implementados com a finalização prevista nos próximos 30 dias.`;
  const preheader = `Até 7 dias: ${c7} · 8 a 15 dias: ${c15} · 16 a 30 dias: ${c30} · ${fmtLongDate(today)}`;

  const cards = impl.map(a => {
    const t = implTone(days(a));
    const { pct } = elapsedOf(a, today);
    return gap(12) + tbl(`<tr><td style="padding:16px 18px;">
      ${tbl(`<tr><td valign="top"><div style="font:700 16px/22px ${FONT};color:${C.ink};">${esc(a.company_name)}</div>
          <div style="margin-top:2px;font:400 13px/19px ${FONT};color:${C.muted};">${subtitleOf(a)}</div></td>
        <td valign="top" align="right" style="white-space:nowrap;padding-left:12px;"><div style="font:700 15px/22px ${FONT};color:${TONE[t].text};">${fmtDate(a.due_date)}</div>
          <div style="margin-top:2px;font:700 12px/17px ${FONT};color:${TONE[t].text};">${esc(implLeft(days(a)))}</div></td></tr>`)}
      <div style="margin-top:10px;font:400 13px/20px ${FONT};color:${C.body};">GP: <b style="color:${C.ink};">${esc(a.manager_name ?? "Não definido")}</b> · Fase: <b style="color:${C.ink};">${esc(phaseOf(a, ctx))}</b> · Prazo: ${a.deadline_days} dias desde ${fmtDate(a.contract_date)}</div>
      ${gap(10)}${tbl(`<tr><td>${bar(pct, t, 8)}</td><td width="104" align="right" style="font:700 12px/16px ${FONT};color:${TONE[t].text};white-space:nowrap;">${pct}% do prazo</td></tr>`)}
      <div style="margin-top:10px;"><a href="${esc(projectUrl(a, ctx))}" style="font:700 14px/20px ${FONT};color:${C.brand};text-decoration:none;">Abrir projeto &rarr;</a></div>
      </td></tr>`, `border:1px solid ${C.line};border-radius:10px;`);
  }).join("");

  const how = "a finalização prevista é a data do contrato somada ao prazo de implantação. Cada projeto gera um alerta 30 dias antes dessa data, enquanto não for implementado, e este resumo chega toda segunda-feira.";
  const subject = subjectOf(ctx, `[Prazo de implantação] Resumo semanal: ${plural(n, "implantação", "implantações")} ${verbN(n)} em até 30 dias`);
  const html = shell(ctx, title, preheader, [
    hero(overline("Resumo semanal · prazo de implantação"), title, esc(introPlain)),
    tilesRow([[c7, "Terminam em até 7 dias", "orange"], [c15, "Em 8 a 15 dias", "amber"], [c30, "Em 16 a 30 dias", "purple"]]),
    `<tr><td class="px" style="padding:16px 32px 0;">${sectionHeading("Projetos por data de finalização", "amber")}${n ? cards : emptyNote("Nenhuma implantação termina nos próximos 30 dias.")}</td></tr>`,
    wideButton(`${ctx.portalUrl}/projetos/cronograma`, "Ver cronograma no portal"),
    note("Como funciona:", how),
  ]);
  const text = textOf([
    title, "", introPlain, "", preheader, "",
    ...(n
      ? impl.map(a => `- ${a.company_name}: ${fmtDate(a.due_date)} (${implLeft(days(a))}) · GP ${a.manager_name ?? "não definido"} · ${phaseOf(a, ctx)} · ${projectUrl(a, ctx)}`)
      : ["Nenhuma implantação termina nos próximos 30 dias."]), "",
    `Como funciona: ${how}`, "",
    footerText(ctx),
  ]);
  return { subject, preheader, html, text };
}

const CONTRACT_BUCKETS: { milestone: DeadlineMilestone; label: string; short: string; tone: Tone }[] = [
  { milestone: "3m", label: "Terminam em até 3 meses", short: "Até 3 meses", tone: "orange" },
  { milestone: "6m", label: "Em 3 a 6 meses", short: "3 a 6 meses", tone: "amber" },
  { milestone: "12m", label: "Em 6 a 12 meses", short: "6 a 12 meses", tone: "purple" },
];

/** Resumo semanal de contrato: contratos que terminam nos próximos 12 meses, por faixa (3, 6 e 12 meses). */
export function renderContratoDigest(alerts: DeadlineAlert[], ctx: EmailContext): RenderedEmail {
  const { today } = ctx;
  const contr = alerts.filter(a => a.kind === "contrato").sort(byDue);
  const n = contr.length;
  const groups = CONTRACT_BUCKETS.map(b => ({ ...b, items: contr.filter(a => a.milestone === b.milestone) }));
  const execLabel = executiveLabel(ctx) === "Executivo de Vendas" ? "Executivo" : executiveLabel(ctx);
  const title = n ? `${plural(n, "contrato", "contratos")} ${verbN(n)} nos próximos 12 meses` : "Nenhum contrato termina nos próximos 12 meses";
  const introPlain = `${cap(fmtLongDate(today))}. ${n ? "Hora de planejar com os clientes as renovações e os aditivos." : "Nenhuma renovação para planejar por enquanto."}`;
  const preheader = `${groups.map(g => `${g.short}: ${g.items.length}`).join(" · ")} · ${fmtLongDate(today)}`;

  const row = (a: DeadlineAlert, last: boolean, tone: Tone) => {
    const people = [
      a.manager_name ? `GP <b style="color:${C.ink};">${esc(a.manager_name)}</b>` : null,
      a.executive_name ? `${esc(execLabel)} <b style="color:${C.ink};">${esc(a.executive_name)}</b>` : null,
    ].filter(Boolean).join(" · ");
    return `<tr><td style="padding:14px 18px;${last ? "" : "border-bottom:1px solid #EFEBF3;"}">${tbl(`<tr>
      <td valign="middle"><div style="font:700 15px/21px ${FONT};color:${C.ink};"><a href="${esc(projectUrl(a, ctx))}" style="color:${C.ink};text-decoration:none;">${esc(a.company_name)}</a></div>
        <div style="margin-top:2px;font:400 13px/19px ${FONT};color:${C.muted};">${subtitleOf(a, phaseOf(a, ctx))}</div>
        ${people ? `<div style="margin-top:2px;font:400 13px/19px ${FONT};color:${C.body};">${people}</div>` : ""}</td>
      <td valign="middle" align="right" style="white-space:nowrap;padding-left:12px;"><div style="font:700 14px/20px ${FONT};color:${C.ink};">${fmtDate(a.due_date)}</div>
        <div style="margin-top:4px;"><span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${TONE[tone].bg};color:${TONE[tone].text};font:700 12px/17px ${FONT};">${esc(remainingShort(today, a.due_date))}</span></div></td></tr>`)}</td></tr>`;
  };
  const sections = n
    ? groups.filter(g => g.items.length).map((g, i) =>
      `<tr><td class="px" style="padding:${i === 0 ? 16 : 24}px 32px 0;">${sectionHeading(g.label, g.tone)}${gap(12)}${tbl(
        g.items.map((a, j) => row(a, j === g.items.length - 1, g.tone)).join(""), `border:1px solid ${C.line};border-radius:10px;`)}</td></tr>`)
    : [`<tr><td class="px" style="padding:16px 32px 0;">${emptyNote("Nenhum contrato termina nos próximos 12 meses.")}</td></tr>`];

  const how = "o fim do contrato é a data do contrato somada ao prazo contratual. Cada projeto gera alertas 12, 6 e 3 meses antes dessa data, e este resumo chega toda segunda-feira.";
  const subject = subjectOf(ctx, `[Prazo de contrato] Resumo semanal: ${plural(n, "contrato", "contratos")} ${verbN(n)} em até 12 meses`);
  const html = shell(ctx, title, preheader, [
    hero(overline("Resumo semanal · prazo de contrato"), title, esc(introPlain)),
    tilesRow(groups.map(g => [g.items.length, g.label, g.tone] as [number, string, Tone])),
    ...sections,
    wideButton(`${ctx.portalUrl}/projetos/lista`, "Ver todos os projetos no portal"),
    note("Como funciona:", how),
  ]);
  const text = textOf([
    title, "", introPlain, "", preheader, "",
    ...(n
      ? groups.filter(g => g.items.length).flatMap(g => [
        g.label.toUpperCase(),
        ...g.items.map(a => `- ${a.company_name}: ${fmtDate(a.due_date)} (${remainingShort(today, a.due_date)}) · GP ${a.manager_name ?? "não definido"}${a.executive_name ? ` · ${execLabel} ${a.executive_name}` : ""} · ${projectUrl(a, ctx)}`),
        "",
      ])
      : ["Nenhum contrato termina nos próximos 12 meses.", ""]),
    `Como funciona: ${how}`, "",
    footerText(ctx),
  ]);
  return { subject, preheader, html, text };
}

/** Projeto fictício para o e-mail de teste quando não há nenhum prazo real no período. */
export function sampleAlert(kind: DeadlineKind, today: string): DeadlineAlert {
  const base = {
    project_id: SAMPLE_PROJECT_ID, company_name: "Projeto de exemplo", project_code: "EXEMPLO-0001",
    city: "Florianópolis", state: "SC", sub_phase: null, manager_name: "Gerente de Projetos",
  };
  if (kind === "implantacao") {
    const due = addDays(today, 30);
    return { ...base, status: "implantacao", executive_name: null, contract_date: addDays(due, -180), kind, milestone: "30d", deadline_days: 180, due_date: due, days_left: 30 };
  }
  const due = addMonths(today, 6);
  const start = addMonths(due, -24);
  return {
    ...base, status: "encerrado", executive_name: "Executivo de Vendas", contract_date: start, kind, milestone: "6m",
    deadline_days: daysBetween(start, due), due_date: due, days_left: daysBetween(today, due),
  };
}
