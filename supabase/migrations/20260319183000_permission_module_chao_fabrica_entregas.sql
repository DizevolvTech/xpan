insert into public.permission_modules (module_key, label, route, group_key)
values (
  'chao-fabrica.entregas',
  'Entregas',
  '/chao-fabrica/entregas',
  'chao-fabrica'::public.permission_group
)
on conflict (module_key) do update
set
  label = excluded.label,
  route = excluded.route,
  group_key = excluded.group_key;
