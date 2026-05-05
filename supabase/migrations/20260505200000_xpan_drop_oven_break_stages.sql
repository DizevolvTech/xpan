-- Remove uso das opções 'antes_forno' e 'depois_forno' de break_stage.
-- A UI passou a oferecer apenas 'antes_divisao' / 'depois_divisao'.
-- O enum continua com os 4 valores em PostgreSQL (drop value de enum exige recriar tipo);
-- mantemos os 2 deprecated apenas como histórico, sem uso novo.
update public.products
set break_stage = 'depois_divisao'
where break_stage in ('antes_forno', 'depois_forno');
