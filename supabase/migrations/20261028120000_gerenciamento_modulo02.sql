-- Gerenciamento: o que o GP registra no módulo 02 (Preparação da visita de PE) de cada projeto.
-- Mesmo formato do módulo 01: um registro por projeto, com o estado da tela inteiro em JSON
-- (src/lib/modulo02.ts Modulo02Estado). A data da reunião de PE também fica numa coluna própria,
-- reuniao_pe_em, copiada do estado a cada gravação: é a base dos alertas do PE.
-- Acesso: só Super Admin, como a página do Gerenciamento.

CREATE TABLE IF NOT EXISTS public.gerenciamento_modulo02 (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- reunião de PE agendada (contato registrado); null enquanto não houver
  reuniao_pe_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT gerenciamento_modulo02_estado_obj_chk CHECK (jsonb_typeof(estado) = 'object')
);

CREATE INDEX IF NOT EXISTS gerenciamento_modulo02_reuniao_pe_idx
  ON public.gerenciamento_modulo02 (reuniao_pe_em) WHERE reuniao_pe_em IS NOT NULL;

-- Empresa vem do projeto; quem e quando gravou vêm da sessão; a reunião de PE vem do estado.
CREATE OR REPLACE FUNCTION public.gerenciamento_modulo02_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pe text := nullif(NEW.estado->'contato'->>'reuniaoPe', '');
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM public.projects WHERE id = NEW.project_id);
  IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;

  -- a tela grava a hora local digitada (AAAA-MM-DDThh:mm); vale só com o agendamento salvo
  NEW.reuniao_pe_em := NULL;
  IF v_pe IS NOT NULL AND NEW.estado->'contato'->>'registradoEm' IS NOT NULL THEN
    BEGIN
      NEW.reuniao_pe_em := v_pe::timestamp AT TIME ZONE 'America/Sao_Paulo';
    EXCEPTION WHEN others THEN
      NEW.reuniao_pe_em := NULL; -- data inválida não impede de gravar o resto do módulo
    END;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerenciamento_modulo02_before_write ON public.gerenciamento_modulo02;
CREATE TRIGGER trg_gerenciamento_modulo02_before_write
  BEFORE INSERT OR UPDATE ON public.gerenciamento_modulo02
  FOR EACH ROW EXECUTE FUNCTION public.gerenciamento_modulo02_before_write();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gerenciamento_modulo02 TO authenticated;
GRANT ALL ON public.gerenciamento_modulo02 TO service_role;
ALTER TABLE public.gerenciamento_modulo02 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerenciamento: super admin" ON public.gerenciamento_modulo02;
CREATE POLICY "gerenciamento: super admin" ON public.gerenciamento_modulo02 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
