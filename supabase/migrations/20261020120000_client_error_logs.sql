-- Erros de tela do portal (o que antes deixava a página em branco).
-- O portal grava aqui, sem bloquear o usuário, a mensagem técnica, a tela, a versão
-- publicada (arquivo principal) e o navegador. Só Admin / Super Admin consultam.

CREATE TABLE IF NOT EXISTS public.client_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_email text,
  path text,
  message text NOT NULL,
  stack text,
  component_stack text,
  user_agent text,
  app_build text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_error_logs_size CHECK (
    char_length(message) <= 2000 AND char_length(coalesce(stack, '')) <= 8000
    AND char_length(coalesce(component_stack, '')) <= 8000 AND char_length(coalesce(path, '')) <= 500
    AND char_length(coalesce(user_agent, '')) <= 500 AND char_length(coalesce(app_build, '')) <= 300
  )
);
CREATE INDEX IF NOT EXISTS client_error_logs_recent ON public.client_error_logs (created_at DESC);

GRANT INSERT, SELECT ON public.client_error_logs TO authenticated;
GRANT ALL ON public.client_error_logs TO service_role;
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario registra os proprios erros" ON public.client_error_logs;
CREATE POLICY "usuario registra os proprios erros" ON public.client_error_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "admins leem os erros" ON public.client_error_logs;
CREATE POLICY "admins leem os erros" ON public.client_error_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
