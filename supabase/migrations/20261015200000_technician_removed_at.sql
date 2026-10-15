-- Remover técnico da agenda: quem já tem visitas não é apagado (a exclusão em
-- cascata tiraria o nome dele do histórico das visitas); fica marcado como
-- removido e inativo, some do cadastro e das listas, e o histórico continua.
ALTER TABLE public.implantation_technicians
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;
