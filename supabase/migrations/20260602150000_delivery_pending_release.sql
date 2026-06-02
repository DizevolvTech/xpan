-- Liberação de entrega com pendência (override do gestor/admin).
-- Quando o checklist de expedição não está 100% concluído, o gestor de fábrica
-- ou administrador pode liberar a entrada na entrega mesmo assim, desde que
-- informe uma justificativa. Estas colunas registram esse override para
-- auditoria: o motivo informado, quem liberou e quando.
alter table public.delivery_executions
  add column if not exists pending_release_reason text,
  add column if not exists pending_released_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists pending_released_at timestamptz;
