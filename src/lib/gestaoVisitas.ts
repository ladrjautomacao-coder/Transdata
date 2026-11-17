// Gestão de cronograma: as visitas do projeto na Agenda Técnica (só as aprovadas pela coordenação de
// implantação), na linha do tempo. A situação vem da data: o fim aprovado já passou = realizada;
// entre o início e o fim = acontecendo agora; o início ainda vai chegar = próxima.
import {
  fetchProjectRequests, remotePeriodText, techniciansOf,
  type Attendance, type ImplantationRequest, type Technician, type VisitFormat,
} from "@/lib/implantationScheduling";

export type SituacaoVisita = "realizada" | "acontecendo" | "proxima";

export interface VisitaDoProjeto {
  id: string;
  /** Tipo da visita, como veio do agendamento (ex.: "1ª Visita - Bilhetagem"). */
  tipo: string;
  inicio: Date;
  fim: Date;
  situacao: SituacaoVisita;
  /** Presencial ou remoto: o registro da coordenação, quando houver; senão o formato pedido no agendamento. */
  formato: VisitFormat | Attendance | null;
  /** "Manhã, 09h às 12h" nas visitas remotas num dos turnos. */
  turno: string | null;
  tecnicos: Technician[];
  /** Atendimento registrado pela coordenação na Agenda Técnica. */
  registro: { por: string | null; em: string | null; nota: string | null } | null;
}

/** Realizada, acontecendo agora ou próxima, pelo período aprovado. */
export function situacaoVisita(inicio: Date, fim: Date, agora: Date): SituacaoVisita {
  if (+fim < +agora) return "realizada";
  if (+inicio <= +agora) return "acontecendo";
  return "proxima";
}

/** As visitas aprovadas do projeto, em ordem de data (canceladas, reprovadas e pendentes ficam fora). */
export function visitasDoProjeto(requests: ImplantationRequest[], agora: Date): VisitaDoProjeto[] {
  return requests
    .filter(r => r.status === "aprovada" && r.approved_start)
    .map(r => {
      const inicio = new Date(r.approved_start!);
      const fim = new Date(r.approved_end ?? r.approved_start!);
      const formato = r.attendance ?? r.visit_format ?? null;
      return {
        id: r.id,
        tipo: r.visit_purpose,
        inicio,
        fim,
        situacao: situacaoVisita(inicio, fim, agora),
        formato,
        turno: formato === "remoto" ? remotePeriodText("remoto", inicio, fim) : null,
        tecnicos: techniciansOf(r),
        registro: r.attendance ? { por: r.attended_by_name, em: r.attended_at, nota: r.attendance_note } : null,
      };
    })
    .sort((a, b) => +a.inicio - +b.inicio);
}

/** Quantas visitas em cada situação e a próxima pendente (a que está acontecendo; senão a mais perto). */
export function resumoVisitas(lista: VisitaDoProjeto[]) {
  const conta = (s: SituacaoVisita) => lista.filter(v => v.situacao === s).length;
  return {
    realizadas: conta("realizada"),
    acontecendo: conta("acontecendo"),
    proximas: conta("proxima"),
    proxima: lista.find(v => v.situacao === "acontecendo") ?? lista.find(v => v.situacao === "proxima") ?? null,
  };
}

/** Dias inteiros (no calendário) de hoje até o início da visita. */
export function diasAte(inicio: Date, agora: Date): number {
  const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((dia(inicio) - dia(agora)) / 86_400_000);
}

const dd = (n: number) => String(n).padStart(2, "0");
const hora = (d: Date) => `${dd(d.getHours())}h${d.getMinutes() ? dd(d.getMinutes()) : ""}`;
/**
 * O período da visita em texto, no horário local: `curto` "27/10", "03 a 05/11" ou "28/11 a 02/12";
 * `completo` com o ano; `horas` "08h às 18h" (início no primeiro dia, fim no último).
 */
export function periodoDaVisita(inicio: Date, fim: Date) {
  const dm = (d: Date) => `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`;
  const mesmoDia = inicio.toDateString() === fim.toDateString();
  const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear();
  const curto = mesmoDia ? dm(inicio) : mesmoMes ? `${dd(inicio.getDate())} a ${dm(fim)}` : `${dm(inicio)} a ${dm(fim)}`;
  return { curto, completo: `${curto}/${fim.getFullYear()}`, horas: `${hora(inicio)} às ${hora(fim)}` };
}

/** As visitas aprovadas do projeto, direto da Agenda Técnica (a situação é calculada na hora de mostrar). */
export const fetchVisitasDoProjeto = (projectId: string) => fetchProjectRequests(projectId);
