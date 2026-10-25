/** Só os dígitos do CNPJ. */
export const cnpjDigits = (v: string) => v.replace(/\D/g, "").slice(0, 14);

/** 87.113.700/0001-70 enquanto digita (aceita colar com ou sem pontuação). */
export function formatCnpj(v: string) {
  return cnpjDigits(v)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
