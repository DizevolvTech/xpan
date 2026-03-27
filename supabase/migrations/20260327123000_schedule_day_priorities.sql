alter table public.schedule_line_item_snapshots
  add column if not exists day_priorities jsonb not null default '{}'::jsonb;
