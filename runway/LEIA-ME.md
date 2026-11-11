# Runway no portal Transdata

Ferramenta local para gerar vídeos com a API da Runway. Nada daqui vai para o site: só o vídeo final, copiado para `src/assets/`.

## Uso

1. Crie conta e projeto em https://dev.runway.com, compre créditos (1 crédito = US$ 0,01) e crie uma chave na aba **API Keys**.
2. Cole a chave no arquivo `runway\chave-runway.txt` (ele fica fora do Git) ou na variável de ambiente `RUNWAYML_API_SECRET` do Windows.
3. Nesta pasta, rode uma vez: `npm install`
4. Gere um vídeo: `node gerar-video.mjs --prompt "Modern office at sunrise, slow cinematic camera move"`
   - Duração: `--segundos 10` (gen4.5 aceita de 2 a 10)
   - Vertical: `--formato short`
   - Animar uma imagem: `--imagem caminho\da\imagem.png`
5. Os vídeos ficam em `runway\videos\` (com um .json do prompt usado ao lado; a pasta fica fora do Git).

Custo: gen4.5 = 12 créditos por segundo (10 s = US$ 1,20). gen4_turbo (só com imagem) = 5 créditos por segundo.
Nunca cole a chave em chat, código ou commit.

## Vídeo da entrada (tela de login)

Arquivos usados pelo site: `src/assets/entrada/entrada-login.mp4` (loop de 8 s, sem som) e `entrada-login.jpg` (primeiro quadro, mostrado enquanto carrega e para quem pede menos movimento).

Gerado em 10/11/2026 com:

```
node gerar-video.mjs --segundos 10 --prompt "Slow cinematic aerial drone shot at blue hour over a modern Brazilian city. A wide avenue with a dedicated bus lane runs diagonally through the frame; city buses with warm headlights glide smoothly along it, leaving soft long-exposure light trails in amber and orange. Deep violet and indigo sky fading to a warm orange glow on the horizon, light haze, city lights twinkling in the distance. Calm, steady forward camera movement, no cuts, photorealistic, elegant and premium mood. No text, no signs, no logos, no people close up."
```

Depois, o loop sem emenda (o fim se funde com o começo em 2 s) e a imagem, com ffmpeg, a partir da raiz do projeto (troque `ENTRADA.mp4` pelo arquivo gerado e `8.042` pela duração dele menos 2):

```
ffmpeg -i runway\videos\ENTRADA.mp4 -filter_complex "[0:v]split[a][b];[a]trim=start=2,setpts=PTS-STARTPTS[corpo];[b]trim=end=2,setpts=PTS-STARTPTS[inicio];[corpo][inicio]xfade=transition=fade:duration=2:offset=6.042,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 27 -profile:v high -movflags +faststart src\assets\entrada\entrada-login.mp4
ffmpeg -i src\assets\entrada\entrada-login.mp4 -frames:v 1 -q:v 4 src\assets\entrada\entrada-login.jpg
```
