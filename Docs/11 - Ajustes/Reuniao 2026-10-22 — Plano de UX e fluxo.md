# Reunião 22/10/2026 — Plano de UX e fluxo (Daniel + Adriano)

Fonte: gravação Fathom "Xpan & Dizevolv - October 22" (40 min), lida inteira.
Prioridade definida pelo Lucas em 24/10: **UX primeiro** (listas limpas, filtros, tela/rolagem); lotes e auto-liberar depois.
Na reunião o cliente via a versão de 12/10; as mudanças de 18–21/10 só subiram em 23/10.

## Decisões do Lucas (24/10)

- Antecipar produção: **só aviso, sem bloqueio, para qualquer usuário** (substitui a trava no início de 21/10).
- Filtro das listas: **vários status** e **padrão salvo no usuário** (não no computador).
- Excluir OP: **só Master, com lixeira**.
- Mudanças grandes: validar com o cliente antes de ir para produção (ver "Ambiente de teste").

## Blocos, na ordem

Cada item: pedido (tempo da gravação) · como está hoje (develop 28cc9bf) · o que fazer.

### 1. Concluídos fora da tela
- Pedido (3:50, 5:00, 6:10, 9:54): entregue/finalizado/cancelado não aparece; histórico só quando pedir.
- Hoje: OPs e Pedidos já abrem só com pendências (`use-list-status-filter`). Visão Geral (`gestor-fabrica/page.tsx`) e Expedição (`gestor-fabrica/expedicao/page.tsx`, inalterada desde 12/10) mostram tudo.
- Fazer: mesmo comportamento (pendências + "Ver histórico") na Visão Geral e na Expedição, incluindo chão de fábrica.

### 2. Filtros
- Pedido (4:54–5:00): vários status; salvar filtro como padrão do usuário.
- Hoje: multi-status só em OPs/Pedidos; padrão em `localStorage` por página; Expedição com 1 status.
- Feito (24/10, no teste): padrão gravado no usuário em `auth.users.user_metadata.list_filters` por página (`/api/me/list-filters`, `src/lib/saved-list-filters.ts`), sem tabela nova; padrão antigo do navegador migra uma vez. Barra de status compacta numa faixa (`status-filter-bar.tsx`), com "Limpar" e confirmação de salvo.

### 3. Tela e rolagem
- Pedido (27:34): rolagem lateral horrível; botão Reabrir escondido à direita; monitor grande não é aproveitado.
- Hoje: `page-container` com `max-w-[1320px]`; tabelas largas; verificador viu rolagem em /administrador/usuarios a 390 px e cabeçalho do modal da OP espremido a 1280 px.
- Feito (24/10, no teste): `page-container` até 2000 px e menos margem; menu lateral 256 px e recolhido fica lembrado; coluna Ações presa à direita em toda `DataTable` e em Pedidos (sempre à vista); larguras mínimas menores em Pedidos/Expedição; no celular os blocos de progresso não forçam largura; cabeçalho das páginas quebra os botões em vez de espremer o título (`page-hero.tsx`); Pedido entregue não mostra mais "Cancelar".

### 4. Menos cliques
- Visão Geral (3:30): clicar no item abre o item (hoje leva à lista com `?status=`, e a Expedição nem lê o parâmetro).
- Expedição (7:20): pedido incompleto (83%) abre e mostra OPs/produtos faltantes (hoje só clica com produção 100%, e recarrega a página inteira).
- OP (9:03–9:39): mudar status direto da fila, várias de uma vez, informando quantidade; sem entrar produto a produto.
- OP Panetones travada (7:40–8:53): OP-260928-012, PR-61488 e PR-23307 em `em_preparacao` 20% no banco, tela "não iniciado" sem ação; itens por batida sem batidas na data. Reproduzir e garantir ação possível em toda OP.
- Imprimir OPs de amanhã (20:40): botão existe (`DayPrintButton`), deixar visível.
- Feito (24/10, no teste):
  - Visão Geral: pedido abre o próprio pedido; "Checklist" abre o checklist do pedido; pedidos dentro da OP abrem o pedido.
  - Expedição (gestor e chão): "Ver o que falta" abre na lista as OPs do pedido, as que faltam primeiro, com produtos e % (`expedition-pending.ts`, `expedition-order-ops-detail.tsx`); OPs entregues contam como prontas; checklist abre sem recarregar a página.
  - Fila de OPs (gestor e chão): caixa de seleção + "Avançar etapa das selecionadas" e botão "Avançar" por OP (`op-queue-advance.tsx`, `advanceableItemsOf`). Quantidade produzida continua sendo pedida só na conclusão dentro da OP.
  - OP de Panetones: causa = produto com capacidade de batida mas 1 batida só; o chão mostrava botões de etapa, o motor lê as batidas e o clique não mudava nada. Agora todo produto por batida mostra "Concluir batida" (chão) e o gestor também conclui/desfaz batida na OP e na janela da fila (`gestor-batch-controls.tsx`).
  - Botão de impressão do dia em destaque, com o dia e o nº de OPs no texto.

### 5. Resposta ao clique
- Pedido (6:50, 9:20): clique demora, parece que não funcionou.
- Fazer: indicador imediato de carregando; navegação sem recarga total. Upgrade do banco (Nano) é decisão do Lucas.
- Feito (24/10, no teste): barra fina no topo aparece no clique de qualquer link interno ou linha que abre tela (`navigation-progress.tsx`, `pushWithProgress`) e some quando a tela abre; Pedidos, Expedição, Entregas e Fila de OPs mostram "Carregando…" em vez de "0 pedidos" enquanto os dados chegam; no celular o caminho de navegação não fica mais embaixo do botão de menu.

### 6. Dia de produção
- Pedido (10:50–19:47): o que produzir hoje/amanhã/atrasado; data de produção ao lado da entrega; antecipar com aviso.
- Hoje: fila de OPs por dia de produção no ar desde 23/10 (cliente não viu); lista de Pedidos só mostra entrega.
- Fazer: dias de produção na lista de Pedidos; filtro por dia de produção; trocar a trava de data futura por aviso (`workflow-date-guard.ts`).
- Feito (24/10, no teste): Pedidos mostra "Produz dd/mm" (ou "Produz dd/mm a dd/mm (N dias)") abaixo da entrega e tem filtro "Dia de produção" (`order-production-days.ts`); adiantar produção não trava mais para ninguém: avança e mostra o aviso "Produção antecipada: estava prevista para dd/mm" (`describeProductionAnticipation`, evento `xpan:workflow-notice`).

### 7. Pedidos e lotes
- Pedido (20:50–30:22): painel de lotes (abertos, % de lojas, prazo, liberados; liberado sai); aviso de lote esquecido; "Pedido para entrega em dd/mm"; auto-liberar só com lote completo ou prazo encerrado.
- Hoje: só contador "Lote aberto X/Y"; lotes nunca fecham (Grupo Chama: 3 abertos, 2 desde 24/09); `autoReleaseEligibleOrders` libera pedido a pedido; aviso de lojas pendentes só na liberação manual.
- Feito (24/10, no teste): painel de lotes em Pedidos (`order-batches-panel.tsx`, `/api/order-batches/overview`): um cartão por "Pedido para entrega em dd/mm" com lojas que pediram (X/Y e %), prazo das lojas (entrega − antecedência, no horário de corte), quem falta, já liberados e "Liberar lote" (`/api/order-batches/release`; antes do prazo e com loja faltando pede confirmação). Lote todo liberado fecha e sai do painel. Aviso "Lote não aberto" quando o cronograma pede uma entrega sem lote e o prazo está nas próximas 72 h, com "Abrir lote". Auto-liberar só libera pedido de lote completo ou com prazo encerrado (o resto fica "aguardando lojas"). Lógica em `order-batch-progress.ts`.

### 8. Extras
- Lembrete por e-mail às lojas X horas antes do prazo (25:40) — não existe envio de e-mail.
- Soma por produto antes de liberar (28:16).
- Cadastro alterado não mexe em lote/OP já gerados (36:25–38:35) — receita já congelada na liberação; data de produção ainda recalculada.
- Excluir OP, só Master, com lixeira (39:03).
- Feito (24/10, no teste):
  - Soma por produto: botão "Soma por produto" em cada lote (quantidade, kg e nº de lojas) antes de liberar (`order-product-sum.ts`).
  - Cadastro alterado: na liberação, além da receita, ficam congeladas a data de produção e a entrega de cada produto (`workflow_release_recipe_snapshots.production_date/delivery_date`); mudar dias, antecedência ou cronograma depois não move a OP gerada. Pedidos liberados antes desta versão seguem o cálculo ao vivo. A Expedição mostra em "Ver o que falta" o produto do pedido que ficou sem OP (era a causa do "75% com 4/4 OPs").
  - Excluir OP: só o Master (perfil administrador-master, aberto no cliente) vê "Excluir OP (Master)" no menu da OP e a "Lixeira de OPs" na fila; a OP vai para a lixeira (`production_order_trash`), some da fila, quadros e impressões; "Restaurar" devolve. Pedido novo na mesma linha e dia faz a OP voltar. Nada é apagado.
  - Lembrete às lojas: dentro do sistema a loja vê em cada data do lote "Prazo para pedir: dd/mm às hh:mm", em destaque ("Faltam N h") nas últimas 24 h e "Prazo encerrado" depois. O envio por e-mail precisa de remetente e aprovação (o sistema não envia e-mail hoje).

## Ambiente de teste
Prometido na reunião (38:35): o cliente testa numa cópia, sem risco para a operação.
Montado em 24/10 (Lucas: "sim"):

- Endereço do cliente: `https://preview-xpan.dizevolv.com` (Worker `hf-xpan-03f0f7a7-preview`), faixa amarela "Sistema de TESTE" no topo (`src/lib/test-environment.ts`, só pelo endereço).
- Banco: Supabase self-hosted no dize-db, stack `/opt/dizevolv/xpan-teste/stack` (projeto compose `xpan-teste`: db, auth, rest, api-gw; porta 127.0.0.1:4141), exposto por Caddy em `https://api-teste-xpan.dizevolv.com` (DNS A sem proxy). Envio de e-mail desligado (SMTP inválido), cadastro aberto desligado.
- Dados: cópia da produção de 24/10 15:00 UTC (`supabase db dump` do projeto de produção: schema + dados, inclusive `auth.users`; mesmas senhas). Contagens conferidas iguais à produção (28 usuários, 22 pedidos, 86 produtos, 7 tenants). Arquivos em `/opt/dizevolv/xpan-teste/restore` (root, 600).
- Worker de teste: `NEXT_PUBLIC_SUPABASE_URL` = API de teste, `SUPABASE_PROJECT_REF=api-teste-xpan` (cookie `sb-api-teste-xpan-auth-token`), chaves do banco de teste como secrets (1Password: "Xpan - teste (dize-db) - chaves Supabase self-hosted"). Removidos do Worker de teste os segredos de produção sem uso (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Sem agendamentos (cron) no Worker de teste.
- Fluxo: cada bloco é publicado primeiro no teste; o cliente aprova; depois vai para `xpan.dizevolv.com`.
- Atualizar a cópia: novo `supabase db dump --linked --dry-run` (schema e `--data-only`) a partir do host Hefesto, transferir ao dize-db, recriar o banco do stack (`docker compose down -v` só do projeto `xpan-teste`, `up -d db auth rest api-gw`) e restaurar com `psql -U supabase_admin`; o único erro esperado é `storage.buckets` (storage não é usado).

## Fora de mudança
- Mix de produtos: esboço prometido pelo Lucas (segue adiado no snapshot).
- Cronograma Blumenau D-4 já ajustado pelo Daniel; D-3 é o prazo final.
- A confirmar: admin Márcio (Casa Express) não vê Pedidos.
