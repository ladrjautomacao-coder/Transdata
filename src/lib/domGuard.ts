// Tradutores do navegador (Edge/Chrome) e algumas extensões trocam os textos da página
// por elementos próprios. Quando o React depois tenta remover ou reposicionar esses textos,
// o navegador lança "Failed to execute 'removeChild' on 'Node'" e a tela quebra.
// Aqui o conflito é ignorado (com aviso no console) em vez de derrubar a tela.
// O index.html também pede para o navegador não traduzir (lang="pt-BR" translate="no").

export function installDomGuard() {
  if (typeof Node !== "function" || !Node.prototype) return;
  const proto = Node.prototype as Node & { __domGuard?: boolean };
  if (proto.__domGuard) return;
  proto.__domGuard = true;

  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      console.warn("Ignorado: remover um elemento que outro script (tradutor/extensão) já tirou do lugar.", child);
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      console.warn("Ignorado: inserir antes de um elemento que outro script (tradutor/extensão) já tirou do lugar.", ref);
      return node;
    }
    return insertBefore.call(this, node, ref) as T;
  };
}
