-- Agenda de Implantação: feriados próprios (os nacionais são calculados no portal).
--   abrangência "empresa"   vale para todas as visitas
--   abrangência "estadual"  vale para projetos da UF informada
--   abrangência "municipal" vale para projetos da cidade/UF informadas
-- Leitura: quem vê qualquer tela da agenda. Cadastro: quem gerencia os técnicos da agenda.

CREATE TABLE public.implantation_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  scope text NOT NULL DEFAULT 'empresa' CHECK (scope IN ('empresa', 'estadual', 'municipal')),
  state text,
  city text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT implantation_holidays_location_chk CHECK (
    (scope = 'empresa')
    OR (scope = 'estadual' AND state IS NOT NULL)
    OR (scope = 'municipal' AND state IS NOT NULL AND length(trim(coalesce(city, ''))) > 0))
);
CREATE INDEX idx_implantation_holidays_date ON public.implantation_holidays(tenant_id, holiday_date);
CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.implantation_holidays
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_session();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.implantation_holidays TO authenticated;
GRANT ALL ON public.implantation_holidays TO service_role;
ALTER TABLE public.implantation_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda: ver feriados" ON public.implantation_holidays FOR SELECT TO authenticated
  USING (public.agenda_can_view());
CREATE POLICY "agenda: cadastrar feriados" ON public.implantation_holidays FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "agenda: editar feriados" ON public.implantation_holidays FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "agenda: excluir feriados" ON public.implantation_holidays FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'agenda_tecnicos', 'edit'));
CREATE POLICY "tenant guard" ON public.implantation_holidays AS RESTRICTIVE FOR ALL
  USING (public.tenant_guard(tenant_id));
