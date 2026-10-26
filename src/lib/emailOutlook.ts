// E-mails que o portal monta para o GP colar no Outlook (Data Center, cobertura das operadoras).
// Ao colar, o Outlook descarta parte do CSS (caixa alta, espaçamento entre letras, cantos
// arredondados, opacidade, herança de cor): cada texto leva fonte, tamanho, cor e peso próprios.

export const FONTE_EMAIL = "font-family:'Segoe UI',Arial,Helvetica,sans-serif;";

/** Estilo completo de um texto do e-mail. */
export const estiloTexto = (size: number, color: string, bold = false) =>
  `${FONTE_EMAIL}font-size:${size}px;color:${color};font-weight:${bold ? "bold" : "normal"};`;

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Copia o e-mail formatado (HTML) para colar no Outlook; sem suporte, copia o texto. */
export async function copiarEmail(html: string, texto: string) {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([texto], { type: "text/plain" }),
      })]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    return true;
  } catch { return false; }
}
