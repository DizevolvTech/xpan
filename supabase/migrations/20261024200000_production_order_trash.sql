-- Reunião 22/10 (bloco 8): "um botãozinho de excluir OPs ajudaria bastante para limpar e
-- fazer teste novo ... liberando para o Master". Decisão do Lucas (24/10): só Master, com lixeira.
--
-- A OP é derivada dos pedidos liberados (não é uma linha própria). Excluir = colocar a OP na
-- lixeira pela sua chave de planejamento (data|setor|linha|cronograma): ela some das telas de
-- produção e das impressões enquanto tiver só os mesmos pedidos. Restaurar = tirar da lixeira (restored_at). Nada é apagado.

create table if not exists public.production_order_trash (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  planning_key text not null,
  op_code text,
  production_date date,
  line_name text,
  products_count integer,
  -- Pedidos da OP no momento da exclusão. Pedido NOVO que entrar na mesma linha/dia faz a
  -- OP voltar (não escondemos demanda nova por engano).
  order_codes text[] not null default '{}',
  total_kg numeric(14, 3),
  deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default timezone('utc', now()),
  restored_by_profile_id uuid references public.profiles(id) on delete set null,
  restored_at timestamptz
);

create unique index if not exists uq_production_order_trash_active
  on public.production_order_trash (tenant_id, planning_key)
  where restored_at is null;

create index if not exists idx_production_order_trash_tenant
  on public.production_order_trash (tenant_id, deleted_at desc);

comment on table public.production_order_trash is
  'Lixeira de OPs (só Master). OP na lixeira (restored_at nulo) some das telas de produção; restaurar devolve.';

-- Só o servidor (service role) lê e escreve; a autorização (Master) é feita na API.
alter table public.production_order_trash enable row level security;
