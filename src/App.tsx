import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { PwaUpdatePrompt } from "@/pwa/PwaUpdatePrompt";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantBrandingProvider, useTenantBranding } from "@/contexts/TenantBrandingContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { PermissionRoute } from "@/components/PermissionRoute";
import { SuperAdminRoute } from "@/components/SuperAdminRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import NewProject from "./pages/NewProject";
import ProjectList from "./pages/ProjectList";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectManagement from "./pages/ProjectManagement";
import Cronograma from "./pages/Cronograma";
import Gerenciamento from "./pages/Gerenciamento";
import GestaoOperacional from "./pages/GestaoOperacional";
import AreaOperacional from "./pages/AreaOperacional";
import VisaoComercial from "./pages/VisaoComercial";
import TeamMembers from "./pages/TeamMembers";
import Products from "./pages/Products";
import ReportImp from "./pages/ReportImp";
import SolicitacaoAgenda from "./pages/SolicitacaoAgenda";
import CalendarioImplantacao from "./pages/CalendarioImplantacao";
import Suporte from "./pages/Suporte";
import Financeiro from "./pages/Financeiro";
import AcervoTecnico from "./pages/AcervoTecnico";
import AreaImplantador from "./pages/AreaImplantador";

import UserManagement from "./pages/UserManagement";
import PermissionsAdmin from "./pages/PermissionsAdmin";
import SystemSettings from "./pages/SystemSettings";
import ProjectTypes from "./pages/ProjectTypes";
import SystemManual from "./pages/SystemManual";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const branding = useTenantBranding();

  if (branding.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projetos" element={<Projects />} />
          <Route path="/projetos/novo" element={<AdminRoute><NewProject /></AdminRoute>} />
          <Route path="/projetos/lista" element={<ProjectList />} />

          <Route path="/projetos/gestao" element={<ProjectManagement />} />
          <Route path="/projetos/cronograma" element={<Cronograma />} />
          <Route path="/projetos/gerenciamento" element={<SuperAdminRoute><Gerenciamento /></SuperAdminRoute>} />
          <Route path="/projetos/:id" element={<ProjectDetail />} />
          <Route path="/comercial" element={<VisaoComercial />} />
          {/* Portal PSM antigo foi desativado; links salvos caem no Report IMP */}
          <Route path="/implantacao" element={<Navigate to="/implantacao/report-imp" replace />} />
          <Route path="/implantacao/report-imp" element={<ReportImp />} />
          <Route path="/implantacao/solicitacoes" element={<PermissionRoute module="agenda_solicitacao"><SolicitacaoAgenda key="gp" /></PermissionRoute>} />
          <Route path="/implantacao/aprovacao" element={<PermissionRoute module="agenda_solicitacao" action="approve"><SolicitacaoAgenda key="ap" view="ap" /></PermissionRoute>} />
          <Route path="/implantacao/calendario" element={<PermissionRoute module="agenda_calendario"><CalendarioImplantacao /></PermissionRoute>} />
          <Route path="/implantacao/implantador" element={<PermissionRoute module="area_implantador"><AreaImplantador /></PermissionRoute>} />
          {/* em desenvolvimento: só Super Admin; um quadrante por área (src/lib/gestaoOperacional.ts) */}
          <Route path="/gestao-operacional" element={<SuperAdminRoute><GestaoOperacional /></SuperAdminRoute>} />
          <Route path="/gestao-operacional/:area" element={<SuperAdminRoute><AreaOperacional /></SuperAdminRoute>} />

          <Route path="/suporte" element={<Suporte />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/acervo" element={<PermissionRoute module="acervo"><AcervoTecnico /></PermissionRoute>} />
          <Route path="/admin/equipe" element={<AdminRoute><TeamMembers /></AdminRoute>} />
          <Route path="/admin/produtos" element={<AdminRoute><Products /></AdminRoute>} />
          <Route path="/admin/usuarios" element={<AdminRoute><UserManagement /></AdminRoute>} />
          <Route path="/admin/permissoes" element={<AdminRoute><PermissionsAdmin /></AdminRoute>} />
          <Route path="/admin/configuracoes" element={<AdminRoute><SystemSettings /></AdminRoute>} />
          <Route path="/admin/tipos-projeto" element={<AdminRoute><ProjectTypes /></AdminRoute>} />
          <Route path="/manual" element={<SystemManual />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SettingsProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PwaUpdatePrompt />
      <BrowserRouter>
        {/* última proteção: nunca mais página em branco */}
        <AppErrorBoundary fullPage>
          <AuthProvider>
            <TenantBrandingProvider>
              <AppRoutes />
            </TenantBrandingProvider>
          </AuthProvider>
        </AppErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
