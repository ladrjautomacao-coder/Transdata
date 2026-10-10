import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyStatusLabelOverrides } from "@/lib/statusLabels";
import logoTransdata from "@/assets/logo-transdata.png";

interface TenantBranding {
  slug: string | null;
  portalName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  sidebarColor: string | null;
  accentColor: string | null;
  status: string | null;
  loading: boolean;
  /** false = domínio não bate com nenhum cliente (ex: raiz hopextnocode.com) -> mostra cadastro público. */
  isKnownTenant: boolean;
}

const DEFAULT_BRANDING = {
  slug: null,
  portalName: "HopeXT",
  logoUrl: "https://emzqlctomlsjwmgthbkv.supabase.co/storage/v1/object/public/tenant-logos/hopext-default.png",
  primaryColor: null,
  sidebarColor: null,
  accentColor: null,
  status: null,
} as const;

// Endereços deste projeto continuam sendo a Transdata; o domínio HopeXT e
// seus subdomínios são destinados à apresentação e aos novos clientes.
const FALLBACK_TENANT_SLUG = "transdata";
const TRANSDATA_BRANDING: TenantBranding = {
  slug: FALLBACK_TENANT_SLUG,
  portalName: "GP Transdata",
  logoUrl: logoTransdata,
  primaryColor: "273 70% 32%",
  sidebarColor: "273 70% 18%",
  accentColor: "17 89% 54%",
  status: null,
  loading: false,
  isKnownTenant: true,
};

const TenantBrandingContext = createContext<TenantBranding>({
  ...DEFAULT_BRANDING,
  loading: true,
  isKnownTenant: false,
});

export const useTenantBranding = () => useContext(TenantBrandingContext);

function extractSlug(hostname: string): string | null {
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return FALLBACK_TENANT_SLUG;
  if (hostname.endsWith(".vercel.app")) return FALLBACK_TENANT_SLUG;
  if (hostname === "projetostransdata.lovable.app" || hostname.endsWith(".lovableproject.com") || hostname.includes("--dc435e83-1e07-424d-952c-a66e45a342c7.lovable.app")) return FALLBACK_TENANT_SLUG;
  const parts = hostname.split(".");
  // "hopextnocode.com" (raiz, 2 partes) e "www.hopextnocode.com" (redireciona
  // pra raiz) -> sem tenant, cadastro público. "empresax.hopextnocode.com"
  // (3+ partes, não-www) -> primeira parte é o slug.
  if (parts.length <= 2) return null;
  if (parts[0] === "www") return null;
  return parts[0];
}

/** Domínio raiz "de verdade", sem o "www." — usado pra montar subdomínios. */
export function apexHostname(hostname: string): string {
  const parts = hostname.split(".");
  return parts[0] === "www" ? parts.slice(1).join(".") : hostname;
}

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantBranding>({
    ...DEFAULT_BRANDING,
    loading: true,
    isKnownTenant: false,
  });

  useEffect(() => {
    const slug = extractSlug(window.location.hostname);
    document.documentElement.dataset.tenant = slug || "default";
    if (!slug) {
      setState({ ...DEFAULT_BRANDING, loading: false, isKnownTenant: false });
      return;
    }

    if (slug === FALLBACK_TENANT_SLUG) {
      setState(TRANSDATA_BRANDING);
      document.title = "GP Transdata - Gestão de Projetos";
    }

    (supabase.rpc as any)("get_public_tenant_branding", { _slug: slug }).then(({ data }: { data: unknown }) => {
      const row = Array.isArray(data) ? data[0] : (data as any);
      if (!row) {
        setState(slug === FALLBACK_TENANT_SLUG ? TRANSDATA_BRANDING : { ...DEFAULT_BRANDING, loading: false, isKnownTenant: false });
        applyStatusLabelOverrides(null);
        return;
      }
      applyStatusLabelOverrides(row.status_labels);

      const branding: TenantBranding = {
        slug: row.slug,
        portalName: slug === FALLBACK_TENANT_SLUG ? TRANSDATA_BRANDING.portalName : row.portal_name || DEFAULT_BRANDING.portalName,
        logoUrl: slug === FALLBACK_TENANT_SLUG ? TRANSDATA_BRANDING.logoUrl : row.logo_url || DEFAULT_BRANDING.logoUrl,
        primaryColor: row.primary_color || null,
        sidebarColor: row.sidebar_color || null,
        accentColor: row.accent_color || null,
        status: row.status,
        loading: false,
        isKnownTenant: true,
      };
      setState(branding);
      document.title = `${branding.portalName} - Gestão de Projetos`;

      const root = document.documentElement;
      if (branding.primaryColor) {
        root.style.setProperty("--primary", branding.primaryColor);
        root.style.setProperty("--ring", branding.primaryColor);
      }
      if (branding.sidebarColor) {
        root.style.setProperty("--sidebar-background", branding.sidebarColor);
      }
      if (branding.accentColor) {
        root.style.setProperty("--sidebar-primary", branding.accentColor);
        root.style.setProperty("--sidebar-ring", branding.accentColor);
      }

      // Ícone da aba/PWA também segue o tenant — a Transdata (e qualquer
      // cliente com logo próprio) mantém o dela; só quem ainda não tem
      // logo cai no padrão da HopeXT.
      if (branding.logoUrl) {
        document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
          .forEach((link) => { link.href = branding.logoUrl!; });
      }
    }).catch(() => {
      setState(slug === FALLBACK_TENANT_SLUG ? TRANSDATA_BRANDING : { ...DEFAULT_BRANDING, loading: false, isKnownTenant: false });
    });
  }, []);

  return <TenantBrandingContext.Provider value={state}>{children}</TenantBrandingContext.Provider>;
}
