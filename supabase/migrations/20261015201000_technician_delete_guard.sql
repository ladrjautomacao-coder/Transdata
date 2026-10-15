-- Trava: técnico com visitas não pode ser excluído de vez (a cascata apagaria o
-- vínculo dele com as visitas). Nesse caso o portal marca removed_at.
CREATE OR REPLACE FUNCTION public.guard_technician_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.implantation_request_members WHERE technician_id = OLD.id) THEN
    RAISE EXCEPTION 'Técnico com visitas registradas não pode ser excluído; ele é apenas removido das listas'
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_technician_delete ON public.implantation_technicians;
CREATE TRIGGER guard_technician_delete
  BEFORE DELETE ON public.implantation_technicians
  FOR EACH ROW EXECUTE FUNCTION public.guard_technician_delete();
