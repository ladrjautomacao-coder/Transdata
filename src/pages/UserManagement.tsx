import { useEffect, useState, useCallback } from "react";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle, XCircle, Trash2, KeyRound, Search, Shield, ShieldAlert,
  UserCheck, UserX, Mail, Clock, RefreshCw, Users, Sparkles, Hourglass,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABLE_ROLES, ROLE_LABELS, USER_AREAS } from "@/lib/permissions";
import { format, parseISO } from "date-fns";
import { approveSignup as approveSignupRpc, listPendingSignups, type PendingSignup } from "@/lib/accessRpc";

/** Papéis que podem ser escolhidos ao liberar um autocadastro. */
const SIGNUP_ROLES = ["user", ...USER_AREAS, "admin"] as const;

interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  cargo: string;
  role: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in: string | null;
  banned: boolean;
}

export default function UserManagement() {
  const { toast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSignup[]>([]);
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "reset" | "approve" | "ban" | "toggle_role" | "toggle_super";
    user: ManagedUser;
  } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users?action=list");
    if (error || data?.error) {
      toast({ title: "Erro ao carregar usuários", description: error?.message || data?.error, variant: "destructive" });
    } else {
      setUsers(data || []);
    }
    const { data: pendingData } = await listPendingSignups();
    setPending(pendingData ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const executeAction = async (action: string, userId: string, extra?: Record<string, any>) => {
    setActionLoading(userId);
    const { data, error } = await supabase.functions.invoke(`admin-users?action=${action}`, {
      body: { user_id: userId, ...extra },
    });
    if (error || data?.error) {
      toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Sucesso!", description: getSuccessMessage(action) });
      loadUsers();
    }
    setActionLoading(null);
    setConfirmAction(null);
  };

  const getSuccessMessage = (action: string) => {
    switch (action) {
      case "approve": return "Usuário aprovado com sucesso";
      case "reset_password": return "Solicitação de reset de senha enviada";
      case "delete": return "Usuário excluído com sucesso";
      case "toggle_ban": return "Status do usuário atualizado";
      case "toggle_role": return "Papel do usuário atualizado";
      default: return "Ação executada";
    }
  };

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    switch (type) {
      case "approve":
        executeAction("approve", user.id);
        break;
      case "reset":
        executeAction("reset_password", user.id, { email: user.email });
        break;
      case "delete":
        executeAction("delete", user.id);
        break;
      case "ban":
        executeAction("toggle_ban", user.id, { ban: !user.banned });
        break;
      case "toggle_role":
        executeAction("toggle_role", user.id, { role: user.role === "admin" || user.role === "super_admin" ? "user" : "admin" });
        break;
      case "toggle_super":
        executeAction("toggle_role", user.id, { role: user.role === "super_admin" ? "admin" : "super_admin" });
        break;
    }
  };

  const approveSignup = async (p: PendingSignup) => {
    const role = pendingRole[p.user_id];
    if (!role) return;
    setActionLoading(p.user_id);
    const { error } = await approveSignupRpc(p.user_id, role);
    setActionLoading(null);
    if (error) {
      toast({ title: "Erro ao liberar acesso", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Acesso liberado", description: `${p.full_name} entra como ${ROLE_LABELS[role] ?? role}.` });
    loadUsers();
  };

  const pendingIds = new Set(pending.map(p => p.user_id));
  const filtered = users.filter(u => !pendingIds.has(u.id)).filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    confirmed: users.filter(u => u.email_confirmed).length,
    pending: users.filter(u => !u.email_confirmed).length,
    admins: users.filter(u => u.role === "admin").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Gerenciamento de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle de acesso e permissões do sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Confirmados", value: stats.confirmed, icon: UserCheck, color: "text-emerald-500" },
          { label: "Pendentes", value: stats.pending, icon: Clock, color: "text-amber-500" },
          { label: "Admins", value: stats.admins, icon: ShieldAlert, color: "text-blue-500" },
        ].map(s => (
          <Card key={s.label} className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-5">
              <s.icon className="w-full h-full" />
            </div>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Autocadastros aguardando liberação */}
      {pending.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold">Cadastros aguardando liberação ({pending.length})</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Pessoas que criaram a conta pela tela de login. Escolha o perfil e libere o acesso — até lá elas não veem nada no portal.
            </p>
            {pending.map(p => (
              <div key={p.user_id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{p.full_name}</span>
                    {!p.email_confirmed && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">E-mail não confirmado</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>
                    <span>Cadastro: {format(parseISO(p.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <Select value={pendingRole[p.user_id] ?? ""} onValueChange={v => setPendingRole(r => ({ ...r, [p.user_id]: v }))}>
                    <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Escolher perfil" /></SelectTrigger>
                    <SelectContent>
                      {SIGNUP_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-8 text-xs" disabled={!pendingRole[p.user_id] || actionLoading === p.user_id}
                    onClick={() => approveSignup(p)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Liberar acesso
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10"
                    disabled={actionLoading === p.user_id}
                    onClick={() => {
                      const u = users.find(x => x.id === p.user_id);
                      if (u) setConfirmAction({ type: "delete", user: u });
                    }}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState type="search" title="Nenhum usuário encontrado" description="Tente ajustar a busca para encontrar resultados." />
      ) : (
        <div className="space-y-3">
          {filtered.map(user => (
            <Card
              key={user.id}
              className="group hover:shadow-md transition-all duration-200 border-l-4"
              style={{
                borderLeftColor: user.banned
                  ? "hsl(var(--destructive))"
                  : !user.email_confirmed
                  ? "hsl(var(--muted-foreground))"
                  : user.role === "admin"
                  ? "hsl(var(--primary))"
                  : "hsl(var(--accent))",
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  {/* User Info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {user.full_name?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{user.full_name}</span>
                        {user.role === "super_admin" && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-accent text-accent-foreground gap-0.5">
                            <Sparkles className="h-2.5 w-2.5" /> Super Admin
                          </Badge>
                        )}
                        {user.role === "admin" && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">Admin</Badge>
                        )}
                        {user.banned && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Banido</Badge>
                        )}
                        {!user.email_confirmed && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </span>
                        {user.cargo !== "—" && (
                          <span className="hidden sm:inline">• {user.cargo}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground/60">
                        <span>Criado: {format(parseISO(user.created_at), "dd/MM/yyyy")}</span>
                        {user.last_sign_in && (
                          <span>Último acesso: {format(parseISO(user.last_sign_in), "dd/MM/yyyy HH:mm")}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {!user.email_confirmed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 w-[90px]"
                        disabled={actionLoading === user.id}
                        onClick={() => setConfirmAction({ type: "approve", user })}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                    ) : (
                      <div className="w-[90px]" />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={actionLoading === user.id}
                      onClick={() => setConfirmAction({ type: "reset", user })}
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Senha
                    </Button>
                    <Select
                      value={user.role}
                      onValueChange={(newRole) => {
                        if (newRole === user.role) return;
                        if (newRole === "super_admin" && !isSuperAdmin) {
                          toast({ title: "Ação negada", description: "Apenas Super Admins podem conceder Super Admin.", variant: "destructive" });
                          return;
                        }
                        executeAction("toggle_role", user.id, { role: newRole });
                      }}
                      disabled={actionLoading === user.id}
                    >
                      <SelectTrigger className="h-8 w-[170px] text-xs">
                        <SelectValue placeholder="Definir área">
                          {(AVAILABLE_ROLES as readonly string[]).includes(user.role)
                            ? ROLE_LABELS[user.role]
                            : `${ROLE_LABELS[user.role] ?? user.role} (definir área)`}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_ROLES.map(r => (
                          <SelectItem
                            key={r}
                            value={r}
                            disabled={r === "super_admin" && !isSuperAdmin}
                          >
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-8 text-xs ${user.banned ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}`}
                      disabled={actionLoading === user.id}
                      onClick={() => setConfirmAction({ type: "ban", user })}
                    >
                      {user.banned ? (
                        <><UserCheck className="h-3.5 w-3.5 mr-1" /> Desbanir</>
                      ) : (
                        <><UserX className="h-3.5 w-3.5 mr-1" /> Banir</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      disabled={actionLoading === user.id}
                      onClick={() => setConfirmAction({ type: "delete", user })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" && "Excluir Usuário"}
              {confirmAction?.type === "reset" && "Resetar Senha"}
              {confirmAction?.type === "approve" && "Aprovar Usuário"}
              {confirmAction?.type === "ban" && (confirmAction.user.banned ? "Desbanir Usuário" : "Banir Usuário")}
              {confirmAction?.type === "toggle_role" && (confirmAction.user.role !== "user" ? "Remover Administrador" : "Tornar Administrador")}
              {confirmAction?.type === "toggle_super" && (confirmAction.user.role === "super_admin" ? "Remover Super Admin" : "Tornar Super Admin")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete" && (
                <>Tem certeza que deseja excluir permanentemente o usuário <strong>{confirmAction.user.full_name}</strong> ({confirmAction.user.email})? Esta ação não pode ser desfeita.</>
              )}
              {confirmAction?.type === "reset" && (
                <>Deseja enviar um link de redefinição de senha para <strong>{confirmAction?.user.email}</strong>?</>
              )}
              {confirmAction?.type === "approve" && (
                <>Deseja confirmar o email e aprovar o acesso de <strong>{confirmAction?.user.full_name}</strong>?</>
              )}
              {confirmAction?.type === "ban" && (
                confirmAction.user.banned
                  ? <>Deseja restaurar o acesso de <strong>{confirmAction.user.full_name}</strong>?</>
                  : <>Deseja bloquear o acesso de <strong>{confirmAction?.user.full_name}</strong> ao sistema?</>
              )}
              {confirmAction?.type === "toggle_role" && (
                confirmAction.user.role !== "user"
                  ? <>Deseja remover o papel de administrador de <strong>{confirmAction.user.full_name}</strong>?</>
                  : <>Deseja tornar <strong>{confirmAction.user.full_name}</strong> um administrador do sistema?</>
              )}
              {confirmAction?.type === "toggle_super" && (
                confirmAction.user.role === "super_admin"
                  ? <>Deseja remover o papel de Super Admin de <strong>{confirmAction.user.full_name}</strong>? Ele perderá acesso ao Assistente de IA.</>
                  : <>Deseja tornar <strong>{confirmAction.user.full_name}</strong> um Super Admin? Ele terá acesso ao Assistente de IA dos projetos.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
