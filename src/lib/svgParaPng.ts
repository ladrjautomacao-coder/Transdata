/** Imagem PNG de um SVG da tela (o mapa de calor vai como imagem no e-mail e para baixar). */
export async function svgParaPng(svg: SVGSVGElement, escala = 1): Promise<Blob> {
  const { width, height } = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * escala);
    canvas.height = Math.round(height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("O navegador não conseguiu gerar a imagem do mapa.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, falha) =>
      canvas.toBlob(b => (b ? ok(b) : falha(new Error("O navegador não conseguiu gerar a imagem do mapa."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
