import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const projectFields = "id, project_code, company_name, city, state, status, sub_phase, fleet_urbano, fleet_seccionado, updated_at, manager:team_members!projects_manager_id_fkey(full_name)";
const projectStatuses = new Set(["planejamento", "execucao", "homologacao", "encerrado", "suspenso"]);

type ProjectRecord = {
  id: string;
  project_code: string | null;
  company_name: string;
  city: string | null;
  state: string | null;
  status: string;
  sub_phase: string | null;
  fleet_urbano: number | null;
  fleet_seccionado: number | null;
  updated_at: string;
  manager: { full_name: string } | null;
};

function mapProject(project: ProjectRecord) {
  return {
    id: project.id,
    project_code: project.project_code,
    company_name: project.company_name,
    city: project.city,
    state: project.state,
    status: project.status,
    sub_phase: project.sub_phase,
    system: {
      urbano: project.fleet_urbano ?? 0,
      seccionado: project.fleet_seccionado ?? 0,
    },
    project_manager_name: project.manager?.full_name ?? null,
    updated_at: project.updated_at,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseInteger(value: string | null, fallback: number, maximum: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!tokenMatch) return jsonResponse({ error: "Bearer token required" }, 401);
    const token = tokenMatch[1];

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== "string") {
      return jsonResponse({ error: "Invalid or expired token" }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: integrationRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "integration")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!integrationRole) return jsonResponse({ error: "Integration role required" }, 403);

    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const functionIndex = segments.lastIndexOf("integration-api");
    const route = functionIndex >= 0 ? segments.slice(functionIndex + 1) : [];
    if (route[0] !== "projects" || route.length > 2) {
      return jsonResponse({ error: "Route not found" }, 404);
    }

    if (route.length === 2) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(route[1])) {
        return jsonResponse({ error: "Invalid project id" }, 400);
      }
      const { data, error } = await userClient
        .from("projects")
        .select(projectFields)
        .eq("id", route[1])
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ error: "Project not found" }, 404);
      return jsonResponse({ data: mapProject(data as ProjectRecord) });
    }

    const limit = parseInteger(url.searchParams.get("limit"), 50, 100);
    const offset = parseInteger(url.searchParams.get("offset"), 0, 1_000_000);
    const status = url.searchParams.get("status");
    if (limit === null || limit < 1 || offset === null) {
      return jsonResponse({ error: "Invalid pagination; limit must be 1-100 and offset a non-negative integer" }, 400);
    }
    if (status && !projectStatuses.has(status)) {
      return jsonResponse({ error: "Invalid status filter" }, 400);
    }

    let query = userClient
      .from("projects")
      .select(projectFields, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) throw error;
    return jsonResponse({
      data: (data ?? []).map((project) => mapProject(project as ProjectRecord)),
      pagination: { limit, offset, total: count ?? 0 },
    });
  } catch (error) {
    console.error("integration-api error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});