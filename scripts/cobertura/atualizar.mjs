// Carga da cobertura das operadoras (Claro e Vivo) usada no e-mail de cobertura do Gerenciamento
// (projetos com Carrier). Fontes oficiais:
//  - Anatel: cobertura por município e por setor censitário, estimada a partir das estações
//    licenciadas (atualização trimestral). Só os dois CSVs do período mais recente são baixados.
//  - IBGE: desenho dos setores censitários do Censo 2022, por UF (fica em cache em .cache/).
// Grava a tabela cobertura_movel_municipio e um arquivo por município no Storage
// (cobertura/setores/{codigo IBGE}.json) com o mapa de calor dos setores.
//
// Uso:
//   node atualizar.mjs                         carga completa (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
//   node atualizar.mjs --forcar                recarrega mesmo se o período já estiver no banco
//   node atualizar.mjs --verificar             só diz se a Anatel tem período novo (novo=true|false
//                                              também em $GITHUB_OUTPUT, para o agendamento)
//   node atualizar.mjs --uf SC --municipio 4218707 --saida ./saida
//                                              só gera os arquivos na pasta, sem gravar nada
import { appendFile, mkdir, writeFile, rm, readdir, readFile, rename } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { linhas, zipLocal, zipRemoto } from "./zip.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ANATEL = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/infraestrutura/cobertura_movel.zip";
const IBGE = "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/setores/shp/UF";
const OPERADORAS = ["CLARO", "VIVO"];
const TECNOLOGIAS = ["4G", "5G", "Todas"];
const UFS = ["RO", "AC", "AM", "RR", "PA", "AP", "TO", "MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA",
  "MG", "ES", "RJ", "SP", "PR", "SC", "RS", "MS", "MT", "GO", "DF"];

/** Mesma regra de src/lib/coberturaOperadoras.ts (é por ela que o portal acha a cidade do cadastro). */
const normalizarMunicipio = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const filtroUf = args.uf ? new Set(String(args.uf).toUpperCase().split(",")) : null;
const filtroMun = args.municipio ? new Set(String(args.municipio).split(",")) : null;
const saida = typeof args.saida === "string" ? args.saida : null;
const URL_SUPA = process.env.SUPABASE_URL?.replace(/\/$/, "");
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!saida && (!URL_SUPA || !CHAVE)) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY, ou use --saida <pasta> para só gerar os arquivos.");
  process.exit(1);
}

const num = s => (s ? Number(s.replace(",", ".")) : 0);
const pct = s => Math.round(num(s) * 10000) / 100; // 0–1 → 0–100, duas casas
const um = n => Math.round(n * 10) / 10;

/** Campos de uma linha separada por ";" (nomes de cidade podem vir entre aspas). */
function campos(l) {
  const out = [];
  let cur = "", aspas = false;
  for (const ch of l) {
    if (ch === '"') aspas = !aspas;
    else if (ch === ";" && !aspas) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Posição de cada coluna esperada; para com erro se a Anatel mudar o layout. */
function colunas(cab, esperadas, arquivo) {
  const idx = {};
  for (const [k, nome] of Object.entries(esperadas)) {
    idx[k] = cab.indexOf(nome);
    if (idx[k] < 0) throw new Error(`${arquivo}: coluna "${nome}" não encontrada. Cabeçalho: ${cab.join(" | ")}`);
  }
  return idx;
}

const motivo = e => [e?.message, e?.cause?.code ?? e?.cause?.message].filter(Boolean).join(" · ");
/** No GitHub Actions, o erro vira anotação da execução (fica legível sem abrir o registro). */
const erroNoGitHub = (titulo, texto) => {
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=${titulo}::${String(texto).replace(/\r?\n/g, " ")}`);
};
process.on("uncaughtException", e => { erroNoGitHub("Carga da cobertura", motivo(e)); console.error(e); process.exit(1); });

/**
 * Repete o que falhar por rede: os servidores da Anatel e do IBGE às vezes demoram a aceitar
 * conexão. Espera 15 s, 30 s, 45 s e 60 s entre as tentativas; erro marcado `semRepetir` para na hora.
 */
async function comTentativas(descricao, fn, tentativas = 5) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (e?.semRepetir || i >= tentativas) throw e;
      console.log(`${descricao}: ${motivo(e)}. Nova tentativa em ${15 * i}s (${i} de ${tentativas - 1}).`);
      await new Promise(ok => setTimeout(ok, 15_000 * i));
    }
  }
}

function supa(caminho, init = {}) {
  return comTentativas(`Supabase ${caminho.split("?")[0]}`, async () => {
    const r = await fetch(URL_SUPA + caminho, { ...init, headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, ...init.headers } });
    if (!r.ok) {
      const e = new Error(`${init.method ?? "GET"} ${caminho}: HTTP ${r.status} ${await r.text()}`);
      e.semRepetir = r.status < 500 && r.status !== 429; // chave errada, sem permissão etc.: repetir não resolve
      throw e;
    }
    return r.headers.get("content-type")?.includes("json") ? r.json() : null;
  });
}

async function emParalelo(itens, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < itens.length) await fn(itens[i++]); }));
}

// ---------------------------------------------------------------- Anatel
const anatel = await comTentativas("Anatel (índice do zip)", () => zipRemoto(ANATEL));
const periodos = anatel.entradas.map(e => /^Cobertura_(\d{4})_(\d{2})_Municipios\.csv$/.exec(e.nome)).filter(Boolean).map(m => `${m[1]}-${m[2]}`).sort();
const periodo = periodos.at(-1);
if (!periodo) throw new Error("Nenhum arquivo Cobertura_AAAA_MM_Municipios.csv no zip da Anatel.");
const [ano, mes] = periodo.split("-");
const entrada = sufixo => {
  const e = anatel.entradas.find(x => x.nome === `Cobertura_${ano}_${mes}_${sufixo}.csv`);
  if (!e) throw new Error(`Falta Cobertura_${ano}_${mes}_${sufixo}.csv no zip da Anatel.`);
  return e;
};
console.log(`Anatel: período ${mes}/${ano} (arquivo publicado em ${anatel.ultimaAlteracao}).`);

if (!saida && !args.forcar) {
  const [meta] = await supa("/rest/v1/cobertura_movel_meta?id=eq.1&select=periodo");
  const novo = meta?.periodo !== periodo;
  if (args.verificar) {
    console.log(novo ? `Período novo para carregar (no banco: ${meta?.periodo ?? "nenhum"}).` : "Este período já está carregado.");
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `novo=${novo}\n`);
    process.exit(0);
  }
  if (!novo) {
    console.log("Este período já está carregado. Nada a fazer (use --forcar para recarregar).");
    process.exit(0);
  }
}

// Por município: % da área, dos moradores e dos domicílios cobertos, por operadora e tecnologia
const municipais = [];
const escopo = new Map(); // código IBGE → { nome, uf }
await comTentativas("Anatel (municípios)", async () => {
  municipais.length = 0;
  escopo.clear();
  let idx = null;
  for await (const l of linhas(await anatel.abrir(entrada("Municipios")))) {
    if (!l) continue;
    const f = campos(l);
    if (!idx) {
      idx = colunas(f, { cod: "Código Município", nome: "Município", uf: "UF", tec: "Tecnologia", op: "Operadora", area: "% área coberta",
        mor: "% moradores cobertos", dom: "% domicilios cobertos", km2: "Área (km2)", moradores: "Moradores" }, "Municipios.csv");
      continue;
    }
    const cod = f[idx.cod], uf = f[idx.uf];
    if ((filtroUf && !filtroUf.has(uf)) || (filtroMun && !filtroMun.has(cod))) continue;
    escopo.set(cod, { nome: f[idx.nome], uf });
    if (!OPERADORAS.includes(f[idx.op]) || !TECNOLOGIAS.includes(f[idx.tec])) continue;
    municipais.push({
      cod_ibge: Number(cod), municipio: f[idx.nome], municipio_norm: normalizarMunicipio(f[idx.nome]), uf,
      operadora: f[idx.op], tecnologia: f[idx.tec], pct_area: pct(f[idx.area]), pct_moradores: pct(f[idx.mor]),
      pct_domicilios: pct(f[idx.dom]), area_km2: Math.round(num(f[idx.km2]) * 100) / 100, moradores: Math.round(num(f[idx.moradores])), periodo,
    });
  }
});
console.log(`Municípios: ${escopo.size}, linhas Claro/Vivo: ${municipais.length}.`);

// A tabela entra já: o comparativo funciona mesmo que algum mapa falhe depois
if (!saida) {
  for (let i = 0; i < municipais.length; i += 1000) {
    await supa("/rest/v1/cobertura_movel_municipio?on_conflict=cod_ibge,operadora,tecnologia", {
      method: "POST", body: JSON.stringify(municipais.slice(i, i + 1000)),
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  }
  console.log("Tabela por município gravada.");
}

// Por setor censitário: % do setor com 4G e 5G, por operadora (setores do Censo 2022)
const porSetor = new Map(); // código do município → Map(código do setor → { CLARO: [4G, 5G], VIVO: [...] })
await comTentativas("Anatel (setores)", async () => {
  porSetor.clear();
  let idx = null;
  for await (const l of linhas(await anatel.abrir(entrada("Setores")))) {
    if (!l) continue;
    const f = campos(l);
    if (!idx) {
      idx = colunas(f, { op: "Operadora", setor: "Código Setor Censitário", censo: "Ano Censo", c4g: "Cobertura_4G", c5g: "Cobertura_5G" }, "Setores.csv");
      continue;
    }
    if (!OPERADORAS.includes(f[idx.op]) || f[idx.censo] !== "2022") continue;
    const setor = f[idx.setor], mun = setor.slice(0, 7);
    if (!escopo.has(mun)) continue;
    if (!porSetor.has(mun)) porSetor.set(mun, new Map());
    const m = porSetor.get(mun);
    if (!m.has(setor)) m.set(setor, {});
    m.get(setor)[f[idx.op]] = [um(num(f[idx.c4g])), um(num(f[idx.c5g]))];
  }
});
console.log(`Setores com cobertura: ${[...porSetor.values()].reduce((s, m) => s + m.size, 0)}.`);

// ---------------------------------------------------------------- IBGE + arquivos por município
const cache = join(AQUI, ".cache");
await mkdir(cache, { recursive: true });

/** Desenho simplificado dos setores dos municípios pedidos de uma UF: código do município → features. */
async function setoresDaUf(uf, municipios) {
  const zipPath = join(cache, `${uf}_setores_CD2022.zip`);
  if (!existsSync(zipPath)) {
    console.log(`IBGE: baixando os setores de ${uf}...`);
    await comTentativas(`IBGE ${uf}`, async () => {
      const r = await fetch(`${IBGE}/${uf}_setores_CD2022.zip`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await pipeline(Readable.fromWeb(r.body), createWriteStream(zipPath + ".parcial"));
    });
    await rename(zipPath + ".parcial", zipPath);
  }
  const tmp = join(cache, `tmp-${uf}`);
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const z = await zipLocal(zipPath);
  for (const e of z.entradas) if (/\.(shp|shx|dbf|prj|cpg)$/i.test(e.nome)) await writeFile(join(tmp, basename(e.nome)), await z.extrair(e));
  await z.fechar();
  const shp = (await readdir(tmp)).find(f => f.toLowerCase().endsWith(".shp"));
  const { default: mapshaper } = await import("mapshaper"); // só carrega quando há mapa a gerar
  const filtro = municipios.length <= 50 ? `-filter '${JSON.stringify(municipios)}.includes(String(CD_MUN))'` : "";
  const geojson = join(tmp, "setores.json");
  // simplifica mantendo o formato de cada setor; 5 casas decimais ≈ 1 m
  await mapshaper.runCommands(`-i "${join(tmp, shp)}" ${filtro} -filter-fields CD_SETOR,CD_MUN -simplify 12% keep-shapes -o "${geojson}" format=geojson precision=0.00001`);
  const { features } = JSON.parse(await readFile(geojson, "utf8"));
  await rm(tmp, { recursive: true, force: true });
  const porMun = new Map();
  for (const f of features) {
    const mun = String(f.properties.CD_MUN);
    if (!porMun.has(mun)) porMun.set(mun, []);
    porMun.get(mun).push(f);
  }
  return porMun;
}

/**
 * Desenho compacto (≈ 1/3 do GeoJSON): cada anel vira [x0, y0, dx1, dy1, ...] em inteiros de 1e-5 grau (≈ 1 m).
 * O portal desfaz em src/lib/coberturaOperadoras.ts (`aneisDoSetor`).
 */
const ESCALA = 1e5;
function anel(pontos) {
  const out = [];
  let px = 0, py = 0;
  for (const [x, y] of pontos) {
    const ix = Math.round(x * ESCALA), iy = Math.round(y * ESCALA);
    out.push(ix - px, iy - py);
    px = ix; py = iy;
  }
  return out;
}
const compactar = g => (g.type === "Polygon" ? g.coordinates.map(anel) : g.coordinates.flatMap(p => p.map(anel)));

function caixa(features) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const andar = c => (typeof c[0] === "number" ? (b[0] = Math.min(b[0], c[0]), b[1] = Math.min(b[1], c[1]), b[2] = Math.max(b[2], c[0]), b[3] = Math.max(b[3], c[1])) : c.forEach(andar));
  for (const f of features) if (f.geometry) andar(f.geometry.coordinates);
  return b;
}

const arquivos = [];
const falhas = []; // UFs que não deram certo: as outras seguem, e a carga fica para a próxima execução
const ufsNoEscopo = [...new Set([...escopo.values()].map(m => m.uf))].filter(uf => UFS.includes(uf));
for (const uf of ufsNoEscopo) {
  try {
    const muns = [...escopo].filter(([, m]) => m.uf === uf).map(([cod]) => cod);
    const geo = await setoresDaUf(uf, muns);
    const daUf = [];
    for (const cod of muns) {
      const features = (geo.get(cod) ?? []).filter(f => f.geometry);
      if (!features.length) continue;
      const cob = porSetor.get(cod) ?? new Map();
      const conteudo = {
        periodo, municipio: { cod_ibge: Number(cod), nome: escopo.get(cod).nome, uf },
        fonte: "Anatel (cobertura estimada) e IBGE (setores censitários, Censo 2022)",
        bbox: caixa(features),
        // g: anéis do setor (os buracos se desenham com a regra evenodd); v: % do setor com [4G, 5G]
        setores: features.map(f => ({ c: String(f.properties.CD_SETOR), g: compactar(f.geometry), v: cob.get(String(f.properties.CD_SETOR)) ?? {} })),
      };
      daUf.push({ cod, json: JSON.stringify(conteudo) });
    }
    if (saida) arquivos.push(...daUf);
    else await enviarArquivos(daUf);
    console.log(`${uf}: ${muns.length} municípios processados.`);
  } catch (e) {
    falhas.push(uf);
    console.error(`${uf}: falhou (${motivo(e)}). Seguindo com as outras UFs.`);
    erroNoGitHub(`Mapas de ${uf}`, motivo(e));
  }
}

async function enviarArquivos(lista) {
  await emParalelo(lista, 8, ({ cod, json }) => supa(`/storage/v1/object/cobertura/setores/${cod}.json`, {
    method: "POST", body: json, headers: { "Content-Type": "application/json", "x-upsert": "true", "cache-control": "3600" },
  }));
}

// ---------------------------------------------------------------- gravação
if (saida) {
  await mkdir(saida, { recursive: true });
  await writeFile(join(saida, "municipios.json"), JSON.stringify({ periodo, linhas: municipais }, null, 1));
  for (const { cod, json } of arquivos) await writeFile(join(saida, `setores-${cod}.json`), json);
  console.log(`Arquivos gerados em ${saida} (nada foi gravado no banco).`);
} else if (falhas.length) {
  // sem marcar o período como carregado: a próxima execução refaz tudo
  erroNoGitHub("Carga incompleta", `Mapas não gerados para: ${falhas.join(", ")}. A tabela por município foi gravada; a próxima execução tenta de novo.`);
  process.exit(1);
} else {
  await supa("/rest/v1/cobertura_movel_meta?on_conflict=id", {
    method: "POST",
    body: JSON.stringify({ id: 1, periodo, fonte_publicada_em: anatel.ultimaAlteracao ? new Date(anatel.ultimaAlteracao).toISOString() : null, carregado_em: new Date().toISOString() }),
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
  });
  console.log(`Carga concluída: período ${mes}/${ano}, ${municipais.length} linhas por município.`);
}
