import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AssistantChat } from "./AssistantChat";
import { useAuth } from "@/contexts/AuthContext";

/** Botão "Assistente" no topo do portal (só Super Admin): abre a conversa ao lado. Atalho Ctrl+J. */
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title="Assistente Transdata (Ctrl+J)"
        aria-label="Abrir o assistente"
        className="h-9 gap-2 rounded-lg border-primary/20 bg-primary/10 px-2.5 text-primary hover:bg-primary/15 hover:text-primary sm:px-3"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden text-[13px] font-semibold sm:inline">Assistente</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <AssistantChat onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
