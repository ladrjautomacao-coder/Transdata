-- Agenda de Implantação: um projeto não pode ter duas visitas ativas
-- (pendente ou aprovada) com o mesmo objetivo (ex.: duas "1ª Visita - Bilhetagem").
-- Reprovadas e canceladas não contam — o GP pode solicitar de novo.
--
-- Trigger (e não índice único) para não falhar com duplicidades que já existam
-- antes desta regra: elas continuam visíveis, mas nenhuma nova é aceita.

CREATE OR REPLACE FUNCTION public.implantation_requests_unique_purpose()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pendente', 'aprovada') AND EXISTS (
    SELECT 1 FROM public.implantation_requests r
    WHERE r.project_id = NEW.project_id
      AND r.id <> NEW.id
      AND r.status IN ('pendente', 'aprovada')
      AND lower(btrim(r.visit_purpose)) = lower(btrim(NEW.visit_purpose))
  ) THEN
    RAISE EXCEPTION 'Você já agendou este projeto justamente com este objetivo da visita, revise o Projeto.'
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_implantation_requests_unique_purpose
  BEFORE INSERT OR UPDATE OF status, visit_purpose, project_id ON public.implantation_requests
  FOR EACH ROW EXECUTE FUNCTION public.implantation_requests_unique_purpose();
