import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string; avatar_url: string | null; tenant_id: string } | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null; tenant_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const requestIdRef = useRef(0);

  const resetUserData = () => {
    setProfile(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
  };

  const loadUserData = async (userId: string) => {
    const requestId = ++requestIdRef.current;
    resetUserData();

    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, tenant_id").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (requestId !== requestIdRef.current) return;

    const roles = (rolesData ?? []).map(r => r.role);
    setProfile((profileData as unknown as { full_name: string; avatar_url: string | null; tenant_id: string } | null) ?? null);
    setIsAdmin(roles.includes("admin") || roles.includes("super_admin"));
    setIsSuperAdmin(roles.includes("super_admin"));
  };

  useEffect(() => {
    let isMounted = true;
    let initialized = false;
    // getSession e onAuthStateChange podem disparar quase juntos; só a chamada mais
    // recente encerra o loading, senão as rotas protegidas veem isAdmin=false e redirecionam.
    let applySeq = 0;

    const applySession = async (session: Session | null) => {
      if (!isMounted) return;
      const seq = ++applySeq;

      setLoading(true);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadUserData(session.user.id);
      } else {
        requestIdRef.current += 1;
        resetUserData();
      }

      if (isMounted && seq === applySeq) setLoading(false);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      initialized = true;
      await applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialized) return;
      void applySession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isAdmin, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
