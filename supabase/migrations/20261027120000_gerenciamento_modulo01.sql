-- Gerenciamento: o que o GP registra no módulo 01 (Abertura do projeto / TAP) de cada projeto.
-- Um registro por projeto. Enquanto o módulo está em construção, o estado vai inteiro em JSON
-- (o mesmo objeto da tela, src/lib/gerenciamento.ts Modulo01Estado): atividades novas entram
-- sem migração. Acesso: só Super Admin, como a página do Gerenciamento.

CREATE TABLE IF NOT EXISTS public.gerenciamento_modulo01 (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT gerenciamento_modulo01_estado_obj_chk CHECK (jsonb_typeof(estado) = 'object')
);

-- Empresa vem do projeto; quem e quando gravou vêm da sessão.
CREATE OR REPLACE FUNCTION public.gerenciamento_modulo01_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.tenant_id := (SELECT tenant_id FROM public.projects WHERE id = NEW.project_id);
  IF NEW.tenant_id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado.'; END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN NEW.created_at := now(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gerenciamento_modulo01_before_write ON public.gerenciamento_modulo01;
CREATE TRIGGER trg_gerenciamento_modulo01_before_write
  BEFORE INSERT OR UPDATE ON public.gerenciamento_modulo01
  FOR EACH ROW EXECUTE FUNCTION public.gerenciamento_modulo01_before_write();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gerenciamento_modulo01 TO authenticated;
GRANT ALL ON public.gerenciamento_modulo01 TO service_role;
ALTER TABLE public.gerenciamento_modulo01 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerenciamento: super admin" ON public.gerenciamento_modulo01;
CREATE POLICY "gerenciamento: super admin" ON public.gerenciamento_modulo01 FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
