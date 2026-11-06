-- Grandes Operações: observação nova na atividade pela tela, com data, hora e quem escreveu (como
-- o acompanhamento da etapa). As da planilha antiga ficam como estão (sem hora nem autor). Como
-- histórico, a observação não se edita nem se apaga pela tela.

ALTER TABLE public.go_observacoes
  ADD COLUMN IF NOT EXISTS criado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS autor_id   uuid,
  ADD COLUMN IF NOT EXISTS autor_nome varchar(150) NOT NULL DEFAULT '';

-- data, hora, autor e posição vêm da sessão (na carga do pacote, go.carga = 'sim', vale o que veio)
CREATE OR REPLACE FUNCTION public.go_tg_obs_atividade_autor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('go.carga', true), '') = 'sim' THEN RETURN NEW; END IF;
  NEW.criado_em := now();
  NEW.data := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  NEW.autor_id := auth.uid();
  NEW.autor_nome := left(coalesce((SELECT nullif(btrim(full_name), '') FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), ''), 150);
  NEW.ordem := coalesce((SELECT max(ordem) + 1 FROM public.go_observacoes WHERE atividade_id = NEW.atividade_id), 1);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS go_obs_atividade_autor ON public.go_observacoes;
CREATE TRIGGER go_obs_atividade_autor BEFORE INSERT ON public.go_observacoes
  FOR EACH ROW EXECUTE FUNCTION public.go_tg_obs_atividade_autor();

-- quem edita o Hub só inclui observação (apagar a atividade continua levando as dela junto)
REVOKE UPDATE, DELETE ON public.go_observacoes FROM authenticated;
DROP POLICY IF EXISTS go_editar ON public.go_observacoes;
DROP POLICY IF EXISTS go_registrar ON public.go_observacoes;
CREATE POLICY go_registrar ON public.go_observacoes FOR INSERT TO authenticated WITH CHECK (public.go_pode('edit'));
