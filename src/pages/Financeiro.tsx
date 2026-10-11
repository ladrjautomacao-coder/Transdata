import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";

const FINANCEIRO_URL = "https://datastudio.google.com/reporting/06aa5370-0f65-4c85-8e1f-dc3ce4ad5b6d/page/p_3pu0qo75td?s=qx9z6ubmuyI";

export default function Financeiro() {
  const branding = useTenantBranding();
  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div>
          <h1 className="text-lg font-semibold">Gestão de Contratos</h1>
          <p className="text-xs text-muted-foreground">Data Studio {branding.portalName}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={FINANCEIRO_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir em nova aba
          </a>
        </Button>
      </div>
      <iframe
        src={FINANCEIRO_URL}
        title="Gestão de Contratos"
        className="flex-1 w-full border-0"
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </div>
  );
}
