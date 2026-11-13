// Portal Transdata · gerador de vídeo com Runway (ver LEIA-ME.md)
// A chave fica em chave-runway.txt (fora do Git) ou na variável RUNWAYML_API_SECRET do Windows — nunca neste arquivo.
//
// Exemplos:
//   node gerar-video.mjs --prompt "Escritório moderno ao amanhecer, câmera lenta"
//   node gerar-video.mjs --prompt "Pessoa caminhando na cidade" --formato short --segundos 5
//   node gerar-video.mjs --imagem ..\miniaturas\logo.png --prompt "Logo surgindo com brilho laranja"
//
// Opções:
//   --prompt    texto descrevendo a cena (obrigatório; inglês costuma dar resultado melhor)
//   --imagem    caminho de uma imagem local para animar (opcional)
//   --formato   longo (16:9, padrão) ou short (9:16)
//   --segundos  duração, padrão 5
//   --modelo    gen4.5 (padrão, ~US$0,12/s) ou gen4_turbo (só com imagem, ~US$0,05/s)
//   --proporcao largura:altura aceita pelo modelo (ex.: 832:1104 para foto em pé); substitui --formato
//   --nome      nome do arquivo de saída (sem extensão), no lugar da data e hora

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import RunwayML, { TaskFailedError } from '@runwayml/sdk';

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return o;
}

// Lê a chave do arquivo chave-runway.txt (ou .env) desta pasta, se existir
for (const nome of ['chave-runway.txt', '.env']) {
  const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), nome);
  if (!fs.existsSync(envFile)) continue;
  for (const line of fs.readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !m[2].startsWith('COLE')) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    else if (/^\s*key_\S{20,}\s*$/.test(line)) process.env.RUNWAYML_API_SECRET ??= line.trim(); // só a chave colada

  }
}

const o = args();
if (!process.env.RUNWAYML_API_SECRET) {
  console.error('Falta a variável RUNWAYML_API_SECRET. Abra o arquivo runway\\chave-runway.txt no Bloco de Notas e cole a chave depois do sinal de =.');
  process.exit(1);
}
if (!o.prompt) {
  console.error('Use --prompt "descrição da cena". Veja exemplos no topo deste arquivo.');
  process.exit(1);
}

const ratio = o.proporcao || (o.formato === 'short' ? '720:1280' : '1280:720');
const duration = Number(o.segundos || 5);
const model = o.modelo || 'gen4.5';
const client = new RunwayML();

let promptImage;
if (o.imagem) {
  const ext = path.extname(o.imagem).slice(1).toLowerCase().replace('jpg', 'jpeg');
  promptImage = `data:image/${ext};base64,${fs.readFileSync(o.imagem).toString('base64')}`;
}

console.log(`Gerando ${duration}s em ${ratio} com ${model}${promptImage ? ' a partir da imagem' : ''}... (pode levar alguns minutos)`);

try {
  const body = { model, promptText: o.prompt, ratio, duration };
  const req = promptImage
    ? client.imageToVideo.create({ ...body, promptImage })
    : client.textToVideo.create(body);
  const task = await req.waitForTaskOutput();

  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'videos');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = o.nome || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const saved = [];
  for (const [i, url] of (task.output || []).entries()) {
    const file = path.join(outDir, `${stamp}${i ? '-' + i : ''}.mp4`);
    const res = await fetch(url);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    saved.push(file);
  }
  fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify({ ...body, imagem: o.imagem || null, taskId: task.id, arquivos: saved }, null, 2));
  console.log('Pronto! Vídeo salvo em:\n' + saved.join('\n'));
} catch (err) {
  if (err instanceof TaskFailedError) {
    console.error('O Runway não conseguiu gerar o vídeo:', JSON.stringify(err.taskDetails, null, 2));
  } else {
    console.error('Erro:', err.message || err);
  }
  process.exit(1);
}
