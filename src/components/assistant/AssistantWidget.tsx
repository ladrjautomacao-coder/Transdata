import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AssistantChat } from "./AssistantChat";
import { useAuth } from "@/contexts/AuthContext";

/** Botão do assistente na faixa superior (só Super Admin): abre a conversa ao lado. Atalho Ctrl+J. */
export function AssistantWidget() {
  const { user, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "j" || e.key === "J") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSuperAdmin]);

  if (!user || !isSuperAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Assistente (Ctrl+J)"
        aria-label="Abrir o assistente"
        className="botao-faixa"
      >
        <MessageCircle className="h-[18px] w-[18px]" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <AssistantChat onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
