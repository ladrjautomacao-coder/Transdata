import { useEffect, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Moon, Search, Settings, Sun, UserRound } from "lucide-react";
import marcaT from "@/assets/logo-transdata-t.png";
import { useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertsBell } from "@/components/AlertsBell";
import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { InstallAppButton } from "@/pwa/InstallAppButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantBranding } from "@/contexts/TenantBrandingContext";
import { useTema } from "@/hooks/useTema";
import { abrirBusca } from "@/lib/atalhos";

/**
 * O "T" do logo Transdata inteiro (com o traço de cima completo) num quadrado no roxo do fundo do
 * logo. O arquivo é só o "T", recortado do logo sem as letras do nome.
 */
function MarcaLogo() {
  return (
    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-marca-logo ring-1 ring-marca-lilas/30">
      <img src={marcaT} alt="" className="w-7" />
    </span>
  );
}

/** Logotipo "CSflow": "CS" forte, "flow" em lilás e uma onda de fluxo no laranja-rosa do logo embaixo. */
function LogotipoCsFlow() {
  const id = useId();
  return (
    <span aria-hidden className="relative whitespace-nowrap pb-[6px] text-[22px] font-bold leading-[1.05] tracking-[-0.03em] text-white">
      CS<span className="relative font-medium text-marca-lilas-claro">flow
        <svg width="51" height="8" viewBox="0 0 44 7" fill="none" className="absolute -bottom-[7px] -left-[5px]">
          <defs>
            <linearGradient id={id} x1="0" x2="1">
              <stop offset="0" stopColor="hsl(var(--marca-laranja))" />
              <stop offset="1" stopColor="hsl(var(--marca-rosa))" />
            </linearGradient>
          </defs>
          <path d="M1 4.5 C 8 0.5, 13 0.5, 20 3.5 S 33 6.5, 43 1.5" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

/** Selo de conexão: "Sistema online" com o ponto verde pulsando; sem internet, fica vermelho. */
function StatusConexao() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const texto = online ? "Sistema online" : "Sem conexão";
  return (
    <div role="status" aria-label={online ? "Sistema online" : "Sem conexão com a internet"} title={texto}
      className="inline-flex h-[30px] shrink-0 items-center gap-2 rounded-full border border-marca-lilas/20 bg-[rgb(20_11_30/0.45)] px-[11px] text-xs font-medium text-marca-lilas-claro lg:px-3">
      <span className="relative flex h-2 w-2">
        {online && <span aria-hidden className="absolute inset-0 rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />}
        <span aria-hidden className={`relative h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-rose-500"}`} />
      </span>
      <span className="hidden whitespace-nowrap lg:inline">{texto}</span>
    </div>
  );
}

/** Avatar com o menu da conta: perfil, configurações, tema e sair. */
function MenuUsuario() {
  const { profile, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { escuro, alternar } = useTema();
  const nome = profile?.full_name || "Usuário";
  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "U";
  const papel = isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Usuário";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Menu do usuário: ${nome}`} title={nome}
          className="flex shrink-0 items-center gap-1 rounded-full border border-transparent py-[3px] pl-[3px] pr-[3px] text-[rgb(226_208_247/0.62)] transition-colors hover:border-marca-lilas/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-lilas-claro data-[state=open]:bg-white/[0.08] sm:pr-1.5">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full border border-marca-lilas bg-gradient-to-br from-[#6B2FA0] to-[#3A1760] text-xs font-bold text-white">{iniciais}</span>
          <ChevronDown aria-hidden className="hidden h-4 w-4 sm:block" strokeWidth={2.2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold">{nome}</span>
          <span className="block text-xs text-muted-foreground">{papel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/admin/equipe")}><UserRound className="mr-2 h-4 w-4" />Meu perfil</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/admin/configuracoes")}><Settings className="mr-2 h-4 w-4" />Configurações</DropdownMenuItem>
        <DropdownMenuItem onSelect={alternar}>
          {escuro ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{escuro ? "Modo claro" : "Modo escuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Faixa superior do portal, de ponta a ponta: menu lateral, marca, busca (Ctrl+K) no centro e, à
 * direita, assistente, avisos, a conta e o selo de conexão.
 */
export function FaixaPortal() {
  const { toggleSidebar, isMobile, state, openMobile } = useSidebar();
  const { portalName } = useTenantBranding();
  const menuAberto = isMobile ? openMobile : state === "expanded";

  return (
    <header className="faixa-portal sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 px-3 text-white sm:gap-4 sm:px-5">
      <div className="flex shrink-0 items-center gap-3">
        <button type="button" onClick={toggleSidebar} className="botao-faixa" aria-label="Alternar menu lateral" aria-expanded={menuAberto} title="Menu (Ctrl+B)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        </button>
        <Link to="/" className="marca-faixa flex items-center gap-2.5 rounded-lg" aria-label={`${portalName}: página inicial`}>
          <MarcaLogo />
          <span className="hidden sm:flex">
            {portalName === "CS Flow"
              ? <LogotipoCsFlow />
              : <span className="whitespace-nowrap text-[15px] font-bold tracking-[-0.01em] text-white">{portalName}</span>}
          </span>
        </Link>
      </div>

      {/* busca: campo no centro em telas largas; abaixo de ~1000px, só a lupa (como no modelo) */}
      <div className="flex min-w-0 flex-1 justify-end lg:justify-center">
        <button type="button" onClick={abrirBusca} aria-label="Buscar projetos, gestores e telas (Ctrl+K)" title="Buscar (Ctrl+K)"
          className="busca-faixa w-9 justify-center lg:w-full lg:max-w-[520px] lg:justify-start lg:pl-3 lg:pr-2.5">
          <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="hidden min-w-0 flex-1 truncate text-left text-sm lg:block">Buscar projetos, gestores e telas...</span>
          <kbd className="hidden whitespace-nowrap rounded-md border border-marca-lilas/20 bg-white/5 px-[7px] py-[3px] font-sans text-[11px] font-medium lg:inline">Ctrl K</kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <AssistantWidget />
        <InstallAppButton />
        <AlertsBell />
        <MenuUsuario />
        <StatusConexao />
      </div>
    </header>
  );
}
