// PDF do Termo de Recebimento de Cartões (módulo 02), no layout do modelo do usuário. Carregado
// só quando o GP abre o termo (a biblioteca de PDF é pesada e não entra no carregamento do portal).
/* eslint-disable react-refresh/only-export-components -- componentes do PDF, não da tela */
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import logo from "@/assets/logo-transdata-documento.png";
import type { DadosTermo } from "@/lib/termoCartoes";

// sem hifenização automática: ela cortava códigos e nomes
Font.registerHyphenationCallback(palavra => [palavra]);

// Documento oficial: cores fixas (o laranja do logo na faixa "Recebido"), em papel branco
const COR = { tinta: "#1d1a22", linha: "#8c8c8c", laranja: "#f0803c" };

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 72, fontFamily: "Helvetica", fontSize: 10.5, color: COR.tinta, lineHeight: 1.45 },
  logo: { width: 150, marginLeft: -6 },
  titulo: { fontSize: 15, marginTop: 52, marginBottom: 10 },
  texto: { textAlign: "justify" },
  negrito: { fontFamily: "Helvetica-Bold" },
  tabela: { width: 300, alignSelf: "center", marginTop: 46, borderTopWidth: 1, borderLeftWidth: 1, borderColor: COR.linha },
  faixa: { backgroundColor: COR.laranja, borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR.linha, paddingVertical: 3 },
  faixaTxt: { fontFamily: "Helvetica-Bold", fontSize: 9.5, textAlign: "center" },
  linha: { flexDirection: "row" },
  cel: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: COR.linha, paddingVertical: 3, paddingHorizontal: 4, fontSize: 9.5, textAlign: "center" },
  th: { fontFamily: "Helvetica-Bold" },
  local: { marginTop: 56 },
  assinatura: { marginTop: 54, width: 230 },
  traco: { borderTopWidth: 1, borderTopColor: COR.tinta, marginBottom: 3 },
  assTxt: { fontSize: 8.8, lineHeight: 1.35 },
  cargo: { fontFamily: "Helvetica-Oblique", fontSize: 8.8, lineHeight: 1.35 },
});

// colunas: Quantidade, Descrição, Tipo
const W = [72, 128, 100];

function Termo({ d }: { d: DadosTermo }) {
  return (
    <Document title={`Termo de Recebimento de Cartões · ${d.clienteAssinatura}`} author="Transdata" subject={d.projeto}>
      <Page size="A4" style={s.page}>
        <Image src={logo} style={s.logo} />
        <Text style={s.titulo}>Termo de Recebimento de Cartões</Text>
        <Text style={s.texto}>
          Declaro, para os devidos fins, que recebi nesta data, da empresa Transdata Soluções em Mobilidade Ltda, os cartões JCOP do projeto{" "}
          <Text style={s.negrito}>{d.projeto}</Text> destinados ao Sistema de Bilhetagem Eletrônica da empresa{" "}
          <Text style={s.negrito}>{d.cliente}</Text>, conforme tabela abaixo:
        </Text>

        <View style={s.tabela} wrap={false}>
          <View style={s.faixa}><Text style={s.faixaTxt}>Recebido</Text></View>
          <View style={s.linha}>
            {["Quantidade", "Descrição", "Tipo"].map((t, i) => <Text key={t} style={[s.cel, s.th, { width: W[i] }]}>{t}</Text>)}
          </View>
          {d.cartoes.map((c, i) => (
            <View key={`${c.tipo}-${i}`} style={s.linha}>
              <Text style={[s.cel, { width: W[0] }]}>{c.quantidade}</Text>
              <Text style={[s.cel, { width: W[1] }]}>{c.descricao}</Text>
              <Text style={[s.cel, { width: W[2] }]}>{c.tipo}</Text>
            </View>
          ))}
        </View>

        <Text style={s.local}>{d.local}, <Text style={s.negrito}>{d.data}</Text></Text>

        <View style={s.assinatura} wrap={false}>
          <View style={s.traco} />
          <Text style={[s.assTxt, s.negrito]}>{d.clienteAssinatura}</Text>
          <Text style={s.assTxt}>{d.recebedor}</Text>
          <Text style={s.cargo}>{d.cargo}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function gerarTermoPdf(d: DadosTermo): Promise<Blob> {
  return pdf(<Termo d={d} />).toBlob();
}
