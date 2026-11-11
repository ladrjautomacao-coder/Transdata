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

Arquivos usados pelo site: `src/assets/entrada/entrada-login.mp4` (loop de ~20 s, sem som) e `entrada-login.jpg` (primeiro quadro, mostrado enquanto carrega e para quem pede menos movimento).

Fundo de tela pede vídeo calmo e sem defeitos de IA:
- velocidade real (nada de time-lapse/hyperlapse, que dá sensação de tremor), câmera quase parada e a mesma luz do começo ao fim;
- veículos pequenos e espaçados: perto da câmera a IA funde carros e ônibus (um carro "engolido" por um ônibus derrubou a 2ª versão);
- nada em primeiro plano (mureta, parapeito).

Antes de usar, confira quadro a quadro a avenida (veículos que somem ou se fundem) e as bordas dos prédios nos quadros intermediários.

Gerado em 10/11/2026 (3ª versão) com:

```
node gerar-video.mjs --segundos 10 --prompt "Wide high-angle establishing shot from the top of a tall building at blue hour over a modern Brazilian city skyline. Far below, a long straight avenue with a dedicated bus lane stretches toward the horizon. Light, sparse traffic: only a few buses and cars, small in the frame and well spaced apart, each one staying in its own lane at a steady speed, never overlapping, never merging. Real-time speed, NOT a time-lapse. The camera is almost still: an extremely slow, perfectly smooth, stabilized drift forward. Constant lighting from start to finish: deep violet and indigo sky with a faint warm orange glow on the horizon, steady city lights, no flicker, no exposure changes. Calm, serene, premium mood, photorealistic, soft haze. Nothing in the foreground, no rooftop edge, no railing. No text, no signs, no logos, no cuts."
```

Depois, com ffmpeg, a partir da raiz do projeto (troque `ENTRADA.mp4` pelo arquivo gerado):

1. Trecho mais calmo (dos 5 s ao fim; antes a câmera passa rápido por um prédio) desacelerado para 50%, com quadros intermediários:
   ```
   ffmpeg -ss 5 -i runway\videos\ENTRADA.mp4 -vf "minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setpts=PTS*2" -r 24 -an -c:v libx264 -preset fast -crf 18 lento.mp4
   ```
2. Loop em vai e volta (avança e recua, sem corte). `237` = número de quadros do `lento.mp4` menos 2:
   ```
   ffmpeg -i lento.mp4 -filter_complex "[0:v]setpts=N/24/TB,split[ida][b];[b]reverse,select='between(n\,1\,237)',setpts=N/24/TB[volta];[ida][volta]concat=n=2:v=1,format=yuv420p[v]" -map "[v]" -an -r 24 -c:v libx264 -preset slow -crf 26 -profile:v high -movflags +faststart src\assets\entrada\entrada-login.mp4
   ffmpeg -i src\assets\entrada\entrada-login.mp4 -frames:v 1 -q:v 4 src\assets\entrada\entrada-login.jpg
   ```
