import { Building2 } from "lucide-react";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";

export default function LogoAnimation({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const branding = useTenantBranding();
  const fallbackColor = tone === "light" ? "bg-primary/10 text-primary" : "bg-white/10 text-white";
  const nameColor = tone === "light" ? "text-[#4b1768]" : "text-white";

  return (
    <div className="mx-auto flex h-36 w-36 shrink-0 items-center justify-center">
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt={branding.portalName}
          width={144}
          height={144}
          loading="eager"
          decoding="sync"
          className="h-36 w-36 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-full bg-primary/10">
          <Building2 className={`h-12 w-12 ${fallbackColor}`} />
          <span className={`text-center text-sm font-semibold ${nameColor}`}>{branding.portalName}</span>
        </div>
      )}
    </div>
  );
}