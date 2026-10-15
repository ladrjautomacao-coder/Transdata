import { supabase } from "@/integrations/supabase/client";

// RPCs do autocadastro (migração 20261015180000_self_signup_domains) — ainda fora dos tipos gerados.
type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as <T>(fn: string, args?: Record<string, unknown>) => RpcResult<T>;

export interface PendingSignup {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
  email_confirmed: boolean;
}

export const getMyAccessStatus = () => rpc<string>("get_my_access_status");
export const listPendingSignups = () => rpc<PendingSignup[]>("list_pending_signups");
export const approveSignup = (userId: string, role: string) =>
  rpc<null>("approve_signup", { _user_id: userId, _role: role });
