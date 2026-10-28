-- Código do projeto volta a acompanhar o cadastro: editar cidade, UF/país, tipo, segmento ou nome
-- da empresa refaz o código, mantendo o sequencial de 4 dígitos (o projeto continua o mesmo).
-- Essa regra existia (20260903205132) e foi perdida quando 20260926100000 reescreveu a função
-- para o código simples dos outros tenants. Os outros tenants (código "<cliente>-<seq>") não mudam.

CREATE OR REPLACE FUNCTION public.projects_set_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c_transdata constant uuid := 'a2f1c8e0-0000-4000-8000-000000000001';
  v_tenant uuid;
  v_client_number int;
  v_seq int;
  v_seq_txt text;
  v_type text;
  v_region text;
BEGIN
  -- novo projeto: gera o código
  IF NEW.project_code IS NULL OR NEW.project_code = '' THEN
    v_tenant := public.get_my_tenant_id();

    IF v_tenant = c_transdata THEN
      IF NEW.project_type_id IS NULL THEN
        RAISE EXCEPTION 'project_type_id é obrigatório para gerar o código do projeto';
      END IF;
      NEW.project_code := public.generate_project_code(
        NEW.city, NEW.state::text, NEW.project_type_id, NEW.project_segment, NEW.company_name, NEW.country_code
      );
    ELSE
      UPDATE public.tenants SET project_seq = project_seq + 1
        WHERE id = v_tenant
        RETURNING client_number, project_seq INTO v_client_number, v_seq;
      IF v_client_number IS NULL THEN
        RAISE EXCEPTION 'Não foi possível identificar o cliente para gerar o código do projeto';
      END IF;
      NEW.project_code := v_client_number::text || '-' || lpad(v_seq::text, 4, '0');
    END IF;
    RETURN NEW;
  END IF;

  -- edição na Transdata: o código acompanha os dados que o compõem (sem mexer em código editado à mão)
  IF TG_OP = 'UPDATE' AND NEW.tenant_id = c_transdata AND NEW.project_type_id IS NOT NULL
     AND NEW.project_code = OLD.project_code AND (
          NEW.city IS DISTINCT FROM OLD.city
       OR NEW.state IS DISTINCT FROM OLD.state
       OR NEW.country_code IS DISTINCT FROM OLD.country_code
       OR NEW.project_type_id IS DISTINCT FROM OLD.project_type_id
       OR NEW.project_segment IS DISTINCT FROM OLD.project_segment
       OR NEW.company_name IS DISTINCT FROM OLD.company_name) THEN

    -- preserva o sequencial de 4 dígitos do código atual
    v_seq_txt := substring(split_part(OLD.project_code, '-', 1) from '([0-9]{4})$');
    IF v_seq_txt IS NULL THEN RETURN NEW; END IF;

    SELECT short_code INTO v_type FROM public.project_types WHERE id = NEW.project_type_id;
    IF v_type IS NULL THEN RETURN NEW; END IF;

    v_region := CASE WHEN upper(coalesce(NEW.country_code, 'BR')) = 'BR'
                     THEN upper(coalesce(NEW.state::text, ''))
                     ELSE upper(coalesce(NEW.country_code, '')) END;

    NEW.project_code := substr(public.code_token(NEW.city), 1, 3)
      || v_region
      || upper(v_type)
      || public.segment_code(NEW.project_segment)
      || v_seq_txt
      || '-' || public.code_token(NEW.company_name);
  END IF;

  RETURN NEW;
END;
$$;

-- Projetos editados enquanto a regra esteve fora: código refeito pelo cadastro atual
-- (autorizado pelo usuário em 28/10/2026: São Bento, Auto Coletivo Caçador e Atlântico).
UPDATE public.projects p
SET project_code = substr(public.code_token(p.city), 1, 3)
  || CASE WHEN upper(coalesce(p.country_code, 'BR')) = 'BR' THEN upper(coalesce(p.state::text, '')) ELSE upper(coalesce(p.country_code, '')) END
  || upper(pt.short_code)
  || public.segment_code(p.project_segment)
  || substring(split_part(p.project_code, '-', 1) from '([0-9]{4})$')
  || '-' || public.code_token(p.company_name)
FROM public.project_types pt
WHERE pt.id = p.project_type_id
  AND p.tenant_id = 'a2f1c8e0-0000-4000-8000-000000000001'
  AND p.project_code IN (
    'NOVSPASNEW0011-EMPRESARODOVIARIAPIRACICABANALTDA',
    'CACSCASUPG0008-AUTOCOLETIVOCACADORLTDA',
    'JUABAVENEW0034-ATLANTICOTRANSPORTESETURISMOLTDA'
  );
