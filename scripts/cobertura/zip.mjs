// Leitura de arquivos .zip sem baixar tudo: o índice (diretório central) fica no fim do arquivo,
// então com requisições HTTP Range dá para listar o conteúdo e baixar só a entrada que interessa.
// Também lê zips já baixados (os mapas do IBGE). Sem zip64: os arquivos usados têm menos de 4 GB.
import { createInflateRaw } from "node:zlib";
import { Readable } from "node:stream";
import { open } from "node:fs/promises";

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;

/** Entradas do diretório central (nome, método, tamanhos e onde começa o cabeçalho local). */
function parseDiretorio(buf) {
  const entradas = [];
  for (let i = 0; i + 46 <= buf.length && buf.readUInt32LE(i) === ASSINATURA_CENTRAL;) {
    const nome = buf.toString("utf8", i + 46, i + 46 + buf.readUInt16LE(i + 28));
    entradas.push({
      nome,
      metodo: buf.readUInt16LE(i + 10),
      comprimido: buf.readUInt32LE(i + 20),
      tamanho: buf.readUInt32LE(i + 24),
      offset: buf.readUInt32LE(i + 42),
    });
    i += 46 + buf.readUInt16LE(i + 28) + buf.readUInt16LE(i + 30) + buf.readUInt16LE(i + 32);
  }
  return entradas;
}

/** `ler(inicio, fim)` devolve os bytes de [inicio, fim] do zip. */
async function listar(total, ler) {
  const cauda = Math.min(total, 66_000);
  const fim = await ler(total - cauda, total - 1);
  let p = fim.length - 22;
  while (p >= 0 && fim.readUInt32LE(p) !== ASSINATURA_FIM) p--;
  if (p < 0) throw new Error("Arquivo .zip sem o índice no fim (corrompido ou incompleto).");
  const tamanhoDir = fim.readUInt32LE(p + 12), inicioDir = fim.readUInt32LE(p + 16);
  return parseDiretorio(await ler(inicioDir, inicioDir + tamanhoDir - 1));
}

/** Conteúdo de um zip remoto (só o índice é baixado). */
export async function zipRemoto(url) {
  const head = await fetch(url, { method: "HEAD" });
  if (!head.ok) throw new Error(`Não foi possível acessar ${url} (HTTP ${head.status}).`);
  const total = Number(head.headers.get("content-length"));
  const ultimaAlteracao = head.headers.get("last-modified");
  const ler = async (ini, fim) => {
    const r = await fetch(url, { headers: { Range: `bytes=${ini}-${fim}` } });
    if (r.status !== 206) throw new Error(`O servidor não aceitou leitura por partes (HTTP ${r.status}).`);
    return Buffer.from(await r.arrayBuffer());
  };
  const entradas = await listar(total, ler);
  /** Fluxo descompactado de uma entrada. */
  const abrir = async e => {
    const cab = await ler(e.offset, e.offset + 29);
    const inicio = e.offset + 30 + cab.readUInt16LE(26) + cab.readUInt16LE(28);
    const r = await fetch(url, { headers: { Range: `bytes=${inicio}-${inicio + e.comprimido - 1}` } });
    if (r.status !== 206) throw new Error(`Falha ao baixar ${e.nome} (HTTP ${r.status}).`);
    const corpo = Readable.fromWeb(r.body);
    return e.metodo === 0 ? corpo : corpo.pipe(createInflateRaw());
  };
  return { entradas, ultimaAlteracao, abrir };
}

/** Conteúdo de um zip em disco. */
export async function zipLocal(caminho) {
  const fh = await open(caminho, "r");
  const { size } = await fh.stat();
  const ler = async (ini, fim) => {
    const buf = Buffer.alloc(fim - ini + 1);
    await fh.read(buf, 0, buf.length, ini);
    return buf;
  };
  const entradas = await listar(size, ler);
  /** Bytes descompactados de uma entrada. */
  const extrair = async e => {
    const cab = await ler(e.offset, e.offset + 29);
    const inicio = e.offset + 30 + cab.readUInt16LE(26) + cab.readUInt16LE(28);
    const dados = await ler(inicio, inicio + e.comprimido - 1);
    if (e.metodo === 0) return dados;
    const partes = [];
    await new Promise((ok, falha) => {
      const inf = createInflateRaw();
      inf.on("data", d => partes.push(d)).on("end", ok).on("error", falha);
      inf.end(dados);
    });
    return Buffer.concat(partes);
  };
  return { entradas, extrair, fechar: () => fh.close() };
}

/** Lê um fluxo de texto linha a linha (UTF-8, tira o BOM). */
export async function* linhas(fluxo) {
  let resto = "";
  const dec = new TextDecoder("utf-8");
  for await (const parte of fluxo) {
    resto += dec.decode(parte, { stream: true });
    const ls = resto.split("\n");
    resto = ls.pop();
    for (const l of ls) yield l.replace(/\r$/, "").replace(/^﻿/, "");
  }
  resto += dec.decode();
  if (resto) yield resto.replace(/\r$/, "");
}
