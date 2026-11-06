import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";

export default function TeamMembers() {
  const { toast } = useToast();
  const { settings } = useSettings();
  const roleLabels = Object.fromEntries(settings.teamRoles.map(r => [r.value, r.label]));
  const [members, setMembers] = useState<any[]>([]);
  // excluir só desativa: quem saiu continua no banco (e o e-mail não pode repetir na empresa)
  const [inativos, setInativos] = useState<{ id: string; email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(settings.teamRoles[0]?.value || "executivo_vendas");
  const [submitting, setSubmitting] = useState(false);
  // membro em edição (null: adicionando); sem o e-mail carregado (quem não é admin), a edição não mexe nele
  const [editId, setEditId] = useState<string | null>(null);
  const [comEmail, setComEmail] = useState(false);

  const load = async () => {
    setLoading(true);
    // Admins fetch full team incl. email via SECURITY DEFINER RPC (email column is
    // no longer readable by non-admins directly). Non-admins fall back to public columns.
    const { data: adminData, error: adminErr } = await supabase.rpc("admin_get_team_emails");
    if (!adminErr && adminData) {
      setMembers((adminData as any[]).filter(m => m.active).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setInativos(adminData.filter(m => !m.active));
      setComEmail(true);
    } else {
      const { data } = await supabase.from("team_members").select("id, full_name, role, active").eq("active", true).order("full_name");
      setMembers(data || []);
      setComEmail(false);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const abrirNovo = () => {
    setEditId(null); setName(""); setEmail(""); setRole(settings.teamRoles[0]?.value || "executivo_vendas"); setOpen(true);
  };
  const abrirEdicao = (m: { id: string; full_name: string; email?: string | null; role: string }) => {
    setEditId(m.id); setName(m.full_name); setEmail(m.email ?? ""); setRole(m.role); setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    setSubmitting(true);
    const mail = email.trim();
    // e-mail de quem foi excluído (desativado): volta à Equipe com o nome e a função informados
    const inativo = !editId && mail ? inativos.find(m => m.email?.trim().toLowerCase() === mail.toLowerCase()) : undefined;
    const { error } = editId
      ? await supabase.from("team_members").update({ full_name: name.trim(), role, ...(comEmail ? { email: mail || null } : {}) }).eq("id", editId)
      : inativo
        ? await supabase.from("team_members").update({ full_name: name.trim(), role, active: true }).eq("id", inativo.id)
        : await supabase.from("team_members").insert({ full_name: name.trim(), email: mail || null, role });
    if (error) {
      const repetido = error.message.includes("team_members_tenant_email_lower_uniq");
      toast({ title: "Erro", description: repetido ? "Já existe alguém na Equipe com esse e-mail." : error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Membro atualizado!" : inativo ? "Membro reativado!" : "Membro adicionado!" });
      setName(""); setEmail(""); setEditId(null); setOpen(false); load();
    }
    setSubmitting(false);
  };

  const handleDeactivate = async (id: string) => {
    await supabase.from("team_members").update({ active: false }).eq("id", id);
    toast({ title: "Membro desativado" });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Equipe</h1>
        <Button onClick={abrirNovo}><Plus className="mr-2 h-4 w-4" /> Novo Membro</Button>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setEditId(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Editar Membro" : "Adicionar Membro"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome Completo *</Label><Input value={name} onChange={e => setName(e.target.value)} maxLength={100} /></div>
              {(!editId || comEmail) && (
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} /></div>
              )}
              <div className="space-y-2">
                <Label>Função *</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.teamRoles.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editId && <p className="text-[11px] text-muted-foreground">Mudar a função não muda os projetos que já estão com essa pessoa.</p>}
              <Button onClick={handleSave} disabled={submitting} className="w-full">{submitting ? "Salvando..." : editId ? "Salvar" : "Adicionar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : members.length === 0 ? (
        <EmptyState type="team" title="Nenhum membro cadastrado" description="Adicione membros da equipe para começar a gerenciar seus projetos." />
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell>{m.email || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{roleLabels[m.role] || m.role}</Badge></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEdicao(m)} aria-label={`Editar ${m.full_name}`} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeactivate(m.id)} aria-label={`Excluir ${m.full_name}`} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
