// PDF do TAP (Termo de Abertura do Projeto). Carregado só quando o GP gera o documento
// (a biblioteca de PDF é pesada e não entra no carregamento do portal).
/* eslint-disable react-refresh/only-export-components -- componentes do PDF, não da tela */
import { Children, type ReactNode } from "react";
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import logo from "@/assets/logo-transdata-documento.png";
import type { DadosTap, Par } from "@/lib/tap";

// sem hifenização automática: ela cortava códigos e nomes ("EMPRE-SATESTELTDA", "Ju-nior")
Font.registerHyphenationCallback(palavra => [palavra]);

// Documento oficial: cores fixas da marca Transdata (o laranja e o rosa do logo), em papel branco
const COR = { tinta: "#1d1a22", suave: "#6b6475", linha: "#e4dfea", fundo: "#f6f4f8", laranja: "#f26522", rosa: "#e6007e", verde: "#047857", ambar: "#b45309" };

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 58, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: COR.tinta, lineHeight: 1.4 },
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 142 },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 15, textAlign: "right" },
  subtitulo: { fontSize: 8.5, color: COR.suave, textAlign: "right", marginTop: 4 },
  faixa: { flexDirection: "row", height: 3, marginTop: 12, marginBottom: 12 },
  meta: { flexDirection: "row", borderWidth: 1, borderColor: COR.linha, borderRadius: 4, marginBottom: 18 },
  metaCel: { flex: 1, paddingVertical: 6, paddingHorizontal: 9 },
  metaSep: { borderLeftWidth: 1, borderLeftColor: COR.linha },
  metaRot: { fontSize: 6.8, color: COR.suave, textTransform: "uppercase", letterSpacing: 0.6 },
  metaVal: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 2 },
  secao: { marginBottom: 16 },
  secaoTit: { flexDirection: "row", alignItems: "center", marginBottom: 8, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: COR.linha },
  num: { width: 17, height: 17, borderRadius: 9, backgroundColor: COR.laranja, alignItems: "center", justifyContent: "center", marginRight: 7 },
  numTxt: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8.5, lineHeight: 1, marginTop: 1 },
  secaoTxt: { fontFamily: "Helvetica-Bold", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5 },
  grade: { flexDirection: "row", flexWrap: "wrap" },
  par: { width: "50%", paddingVertical: 3.5, paddingRight: 12 },
  rot: { fontSize: 7.5, color: COR.suave },
  val: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginTop: 1 },
  paragrafo: { fontSize: 9.5, marginBottom: 6 },
  cab: { flexDirection: "row", backgroundColor: COR.fundo, borderWidth: 1, borderColor: COR.linha, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  // borda inteira em cada linha (sobreposta 1 pt à de cima): a tabela que continua na outra página fica fechada
  linhaT: { flexDirection: "row", borderWidth: 1, borderColor: COR.linha, marginTop: -1 },
  ultimaT: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.2, color: COR.suave, textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 5, paddingHorizontal: 6 },
  td: { fontSize: 8.8, paddingVertical: 5, paddingHorizontal: 6 },
  caixa: { backgroundColor: COR.fundo, borderRadius: 4, padding: 8, marginTop: 7 },
  bloco: { marginTop: 7 },
  blocoTit: { fontFamily: "Helvetica-Bold", fontSize: 8.8, marginBottom: 2 },
  assinaturas: { flexDirection: "row", marginTop: 34 },
  assinatura: { flex: 1, marginHorizontal: 8, alignItems: "center" },
  linhaAss: { borderTopWidth: 1, borderTopColor: COR.tinta, width: "100%", marginBottom: 4 },
  rodapeLinha: { position: "absolute", top: 800, left: 40, right: 40, borderTopWidth: 1, borderTopColor: COR.linha },
  rodapeEsq: { position: "absolute", top: 806, left: 40, right: 120, fontSize: 7.5, color: COR.suave },
  // número da página: posicionado pelo topo (A4 = 842 pt). Com "bottom" e o lineHeight da página,
  // a biblioteca não desenha o texto dinâmico.
  rodapeDir: { position: "absolute", top: 806, left: 40, right: 40, fontSize: 7.5, color: COR.suave, textAlign: "right" },
  cliente: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 8 },
});

const COR_SITUACAO = { "Atendido": COR.verde, "Não se aplica": COR.suave, "Pendente": COR.ambar } as const;

function Secao({ n, titulo, children, inteira = false }: { n: number; titulo: string; children: ReactNode; inteira?: boolean }) {
  // o título anda junto com o primeiro bloco: nunca fica sozinho no pé da página
  const [primeiro, ...resto] = Children.toArray(children);
  return (
    <View style={s.secao} wrap={!inteira}>
      <View wrap={false}>
        <View style={s.secaoTit}>
          <View style={s.num}><Text style={s.numTxt}>{n}</Text></View>
          <Text style={s.secaoTxt}>{titulo}</Text>
        </View>
        {primeiro}
      </View>
      {resto}
    </View>
  );
}

function Grade({ pares }: { pares: Par[] }) {
  return (
    <View style={s.grade}>
      {pares.map(([r, v]) => (
        <View key={r} style={s.par} wrap={false}>
          <Text style={s.rot}>{r}</Text>
          <Text style={s.val}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/** Tabela simples (larguras em % por coluna), devolvida em partes: o cabeçalho anda com a
 *  primeira linha e a seção prende o título nelas; as outras linhas podem seguir na página seguinte. */
function tabela(colunas: { titulo: string; largura: string }[], linhas: (ReactNode | string)[][]): ReactNode[] {
  const linha = (l: (ReactNode | string)[], i: number) => (
    <View key={i} style={[s.linhaT, i === linhas.length - 1 ? s.ultimaT : {}]} wrap={false}>
      {l.map((cel, j) => typeof cel === "string"
        ? <Text key={j} style={[s.td, { width: colunas[j].largura }]}>{cel}</Text>
        : <View key={j} style={[s.td, { width: colunas[j].largura }]}>{cel}</View>)}
    </View>
  );
  return [
    <View key="topo" wrap={false}>
      <View style={s.cab}>
        {colunas.map(c => <Text key={c.titulo} style={[s.th, { width: c.largura }]}>{c.titulo}</Text>)}
      </View>
      {linhas.length > 0 && linha(linhas[0], 0)}
    </View>,
    ...linhas.slice(1).map((l, i) => linha(l, i + 1)),
  ];
}

// o código do projeto não quebra (é uma palavra só): a fonte diminui para caber na célula
const fonteCodigo = (codigo: string) => Math.max(6.5, Math.min(9.5, 200 / (codigo.length * 0.7)));

function TapDocumento({ d }: { d: DadosTap }) {
  return (
    <Document title={`TAP · ${d.codigo}`} author="Transdata · Portal de Projetos" subject={`Termo de Abertura do Projeto · ${d.cliente}`} language="pt-BR">
      <Page size="A4" style={s.page}>
        {/* Rodapé em todas as páginas */}
        <View style={s.rodapeLinha} fixed />
        <Text style={s.rodapeEsq} fixed>TAP {d.codigo} · Documento interno Transdata · emitido em {d.emitidoEm}</Text>
        <Text style={s.rodapeDir} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />

        {/* Cabeçalho */}
        <View style={s.topo}>
          <Image src={logo} style={s.logo} />
          <View>
            <Text style={s.titulo}>TERMO DE ABERTURA DO PROJETO</Text>
            <Text style={s.subtitulo}>TAP · Documento interno · Gestão de Projetos</Text>
          </View>
        </View>
        <View style={s.faixa}>
          <View style={{ flex: 3, backgroundColor: COR.laranja }} />
          <View style={{ flex: 2, backgroundColor: COR.rosa }} />
        </View>
        <Text style={s.cliente}>{d.cliente}</Text>
        <View style={s.meta}>
          {[["Código do projeto", d.codigo], ["Versão", d.versao], ["Emitido em", d.emitidoEm], ["Emitido por", d.emitidoPor]].map(([r, v], i) => (
            <View key={r} style={[s.metaCel, i ? s.metaSep : {}, { flex: [2.5, 0.6, 1.3, 1.45][i] }]}>
              <Text style={s.metaRot}>{r}</Text>
              <Text style={[s.metaVal, i ? {} : { fontSize: fonteCodigo(v) }]}>{v}</Text>
            </View>
          ))}
        </View>

        <Secao n={1} titulo="Identificação do projeto"><Grade pares={d.identificacao} /></Secao>

        <Secao n={2} titulo="Objetivo e escopo">
          <Text style={s.paragrafo}>{d.objetivo}</Text>
          <Grade pares={d.escopo} />
        </Secao>

        <Secao n={3} titulo="Partes interessadas e responsabilidades">
          {tabela([{ titulo: "Papel", largura: "28%" }, { titulo: "Nome", largura: "26%" }, { titulo: "Responsabilidade", largura: "46%" }],
            d.partes.map(p => [p.papel, p.nome, p.responsabilidade]))}
        </Secao>

        <Secao n={4} titulo="Pré-requisitos de abertura (checklist)">
          {tabela([{ titulo: "Pré-requisito", largura: "56%" }, { titulo: "Responsável", largura: "20%" }, { titulo: "Situação", largura: "24%" }],
            d.checklist.itens.map(i => [i.texto, i.responsavel,
              <Text key="s" style={{ fontFamily: "Helvetica-Bold", color: COR_SITUACAO[i.situacao] }}>{i.situacao}</Text>]))}
          <View style={s.caixa} wrap={false}>
            <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Resultado: </Text>{d.checklist.resultado}</Text>
            {d.checklist.vencimentoDzero && <Text style={{ marginTop: 2 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Vencimento do D-zero: </Text>{d.checklist.vencimentoDzero}</Text>}
            {d.checklist.observacoes && <Text style={{ marginTop: 2 }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Observações: </Text>{d.checklist.observacoes}</Text>}
          </View>
        </Secao>

        <Secao n={5} titulo="Marcos da abertura">
          {tabela([{ titulo: "#", largura: "6%" }, { titulo: "Atividade", largura: "30%" }, { titulo: "Responsável", largura: "24%" }, { titulo: "Concluída em", largura: "14%" }, { titulo: "Registro", largura: "26%" }],
            d.marcos.map((m, i) => [String(i + 1), m.atividade, m.responsavel, m.concluidaEm,
              m.link ? <Link key="l" src={m.link} style={{ color: COR.laranja }}>{m.registro}</Link> : m.registro]))}
        </Secao>

        {d.handover && (
          <Secao n={6} titulo="Reunião de Handover">
            <Grade pares={[["Data da reunião", d.handover.data], ["Participantes", d.handover.participantes]]} />
            <View style={s.bloco} wrap={false}><Text style={s.blocoTit}>Particularidades do projeto</Text><Text>{d.handover.particularidades}</Text></View>
            <View style={s.bloco} wrap={false}><Text style={s.blocoTit}>Pontos de atenção (riscos e restrições)</Text><Text>{d.handover.atencao}</Text></View>
            <View style={s.bloco} wrap={false}><Text style={s.blocoTit}>Expectativas do cliente (critérios de sucesso)</Text><Text>{d.handover.expectativas}</Text></View>
          </Secao>
        )}

        <Secao n={d.handover ? 7 : 6} titulo="Aprovação" inteira>
          <Text>Ao assinar, as partes confirmam a abertura do projeto nas condições descritas neste termo e autorizam o início do planejamento.</Text>
          <View style={s.assinaturas}>
            {d.aprovacao.map(a => (
              <View key={a.papel} style={s.assinatura}>
                <View style={s.linhaAss} />
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{a.nome || " "}</Text>
                <Text style={{ fontSize: 8, color: COR.suave }}>{a.papel}</Text>
                <Text style={{ fontSize: 8, color: COR.suave, marginTop: 8 }}>Data: ____/____/______</Text>
              </View>
            ))}
          </View>
        </Secao>
      </Page>
    </Document>
  );
}

/** Gera o PDF do TAP. */
export async function gerarTapPdf(d: DadosTap): Promise<Blob> {
  return pdf(<TapDocumento d={d} />).toBlob();
}
