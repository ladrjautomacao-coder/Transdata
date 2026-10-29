// PDF dos comprovantes de pagamento da visita de PE (módulo 02), que o GP anexa no e-mail ao
// Financeiro. Carregado só quando o GP abre os comprovantes (a biblioteca de PDF é pesada).
/* eslint-disable react-refresh/only-export-components -- componentes do PDF, não da tela */
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import logo from "@/assets/logo-transdata-documento.png";
import type { DadosComprovantesPdf } from "@/lib/comprovantesFinanceiro";

Font.registerHyphenationCallback(palavra => [palavra]);

// Documento: cores fixas da marca (roxo dos e-mails, laranja do logo), em papel branco
const COR = { tinta: "#1f1630", suave: "#645a72", linha: "#e3dcec", marca: "#4b1768", faixa: "#efe6f6", laranja: "#f0803c" };

// área do comprovante na página (A4 sem as margens, o topo e o título)
const AREA = { largura: 507, altura: 640 };
/** A imagem inteira na área, encostada no alto. */
const caber = (largura: number, altura: number) => {
  const k = Math.min(AREA.largura / largura, AREA.altura / altura);
  return { width: largura * k, height: altura * k };
};

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: COR.tinta, lineHeight: 1.35 },
  topo: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: COR.laranja, paddingBottom: 8 },
  logo: { width: 118, marginLeft: -4 },
  topoTxt: { fontSize: 8, color: COR.suave, textAlign: "right" },
  sobre: { fontFamily: "Helvetica-Bold", fontSize: 8, color: COR.marca, letterSpacing: 0.8, marginTop: 16 },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 15, marginTop: 3 },
  intro: { marginTop: 6, color: COR.suave },
  grupo: { marginTop: 12, borderWidth: 1, borderColor: COR.linha },
  grupoTit: { backgroundColor: COR.faixa, color: COR.marca, fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 0.6, paddingVertical: 4, paddingHorizontal: 8 },
  linha: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COR.linha },
  rotulo: { width: "36%", paddingVertical: 3.5, paddingHorizontal: 8, color: COR.suave },
  valor: { flex: 1, paddingVertical: 3.5, paddingHorizontal: 8, fontFamily: "Helvetica-Bold" },
  compTit: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 14 },
  compDesc: { marginTop: 2, color: COR.suave },
  compImg: { marginTop: 10 },
  rodape: { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COR.linha, paddingTop: 5, fontSize: 7.5, color: COR.suave },
});

function Topo({ projeto }: { projeto: string }) {
  return (
    <View style={s.topo} fixed>
      <Image src={logo} style={s.logo} />
      <Text style={s.topoTxt}>Visita de Projeto Executivo{"\n"}{projeto}</Text>
    </View>
  );
}

function Comprovantes({ d }: { d: DadosComprovantesPdf }) {
  return (
    <Document title={`Comprovantes · Visita de PE · ${d.projeto}`} author="Transdata" subject={d.projeto}>
      <Page size="A4" style={s.page}>
        <Topo projeto={d.projeto} />
        <Text style={s.sobre}>COMPROVANTES DE PAGAMENTO · FINANCEIRO</Text>
        <Text style={s.titulo}>{d.projeto}</Text>
        <Text style={s.intro}>{d.intro}</Text>
        {d.grupos.map(g => (
          <View key={g.titulo} style={s.grupo} wrap={false}>
            <Text style={s.grupoTit}>{g.titulo}</Text>
            {g.linhas.map(l => (
              <View key={l.label} style={s.linha}>
                <Text style={s.rotulo}>{l.label}</Text>
                <Text style={s.valor}>{l.valor}</Text>
              </View>
            ))}
          </View>
        ))}
        <Rodape texto={d.rodape} />
      </Page>
      {d.comprovantes.map(c => (
        <Page key={c.titulo} size="A4" style={s.page}>
          <Topo projeto={d.projeto} />
          <Text style={s.compTit}>{c.titulo}</Text>
          {c.descricao ? <Text style={s.compDesc}>{c.descricao}</Text> : null}
          <Image src={c.imagem} style={[s.compImg, caber(c.largura, c.altura)]} />
          <Rodape texto={d.rodape} />
        </Page>
      ))}
    </Document>
  );
}

function Rodape({ texto }: { texto: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text>{texto}</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export async function gerarComprovantesPdf(d: DadosComprovantesPdf): Promise<Blob> {
  return pdf(<Comprovantes d={d} />).toBlob();
}
