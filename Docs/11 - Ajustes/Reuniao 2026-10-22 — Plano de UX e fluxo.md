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
- Feito (24/10, no teste): painel de lotes em Pedidos (`order-batches-panel.tsx`, `/api/order-batches/overview`): um cartão por "Pedido para entrega em dd/mm" com lojas que pediram (X/Y e %), prazo das lojas (entrega − antecedência, no horário de corte), quem falta, já liberados e "Liberar lote" (`/api/order-batches/release`; antes do prazo e com loja faltando pede confirmação). Entrega liberada (completa, com prazo encerrado ou liberada pelo gestor mesmo faltando lojas) sai do painel; lote com todas as entregas liberadas fecha. Aviso "Lote não aberto" quando o cronograma pede uma entrega sem lote e o prazo está nas próximas 72 h, com "Abrir lote". Auto-liberar só libera pedido de lote completo ou com prazo encerrado (o resto fica "aguardando lojas"). Lógica em `order-batch-progress.ts`.

### 8. Extras
- Lembrete por e-mail às lojas X horas antes do prazo (25:40) — não existe envio de e-mail.
- Soma por produto antes de liberar (28:16).
- Cadastro alterado não mexe em lote/OP já gerados (36:25–38:35) — receita já congelada na liberação; data de produção ainda recalculada.
- Excluir OP, só Master, com lixeira (39:03).
- Feito (24/10, no teste):
  - Soma por produto: botão "Soma por produto" em cada lote (quantidade, kg e nº de lojas) antes de liberar (`order-product-sum.ts`).
  - Cadastro alterado: na liberação, além da receita, ficam congeladas a data de produção e a entrega de cada produto (`workflow_release_recipe_snapshots.production_date/delivery_date`); mudar dias, antecedência ou cronograma depois não move a OP gerada. Pedidos liberados antes desta versão seguem o cálculo ao vivo. A Expedição mostra em "Ver o que falta" o produto do pedido que ficou sem OP (era a causa do "75% com 4/4 OPs").
  - Excluir OP: só o Master (perfil administrador-master, aberto no cliente) vê "Excluir OP (Master)" no menu da OP e a "Lixeira de OPs" na fila; a OP vai para a lixeira (`production_order_trash`), some da fila, quadros e impressões; "Restaurar" devolve. Pedido novo na mesma linha e dia faz a OP voltar. Nada é apagado.
  - Sair do sistema desconecta só aquele aparelho (antes derrubava a mesma conta em todos os computadores).
  - Lembrete às lojas: dentro do sistema a loja vê em cada data do lote "Prazo para pedir: dd/mm às hh:mm", em destaque ("Faltam N h") nas últimas 24 h e "Prazo encerrado" depois. Envio por e-mail: pausado pelo Lucas (24/10); não fazer até ele retomar.

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

## Quadro #1 (Lucas, 27/10) — tirar métricas de produção da Visão Geral
- Pedido: "essas métricas de produção não são necessárias, precisamos primeiro fazer o básico operacional rodar".
- Feito (no teste): sai o alerta "Produção abaixo do planejado" e os cards "Tempo médio de produção" e "Produção por etapa". Ficam "Entregas no prazo", "Lojas sem pedido no prazo" e os alertas de entrega.
- Decisão do Hefesto (Lucas: "siga sua recomendação e registre"): saíram também os alertas da mesma família — "Produção acima do planejado" e "Atraso na etapa" — inclusive da rotina que abre ocorrência automática. Voltam quando o assunto for capacidade/velocidade (histórico no Git, `factory-alerts.ts`).

## Quadro #2 (Lucas, 27/10) — Pedidos compacto, como planilha
- Pedido: "trabalhar essas listas como uma tabela de excel ... margens estreitas; o cabeçalho mata 25% da área útil".
- Feito (no código): cabeçalho da página numa linha (caminho, título e botões juntos, sem selo); janela, Abrir lote, Auto-liberar e os números (no período, liberados, em produção, prontos) numa faixa só — os 3 cartões grandes de números saíram; avisos "Lote não aberto" numa faixa só com um botão por data; lotes viraram tabela compacta (uma linha por entrega, até ~4 à vista, o resto rola dentro da caixa); filtros numa linha; linhas de pedido com 37 px (antes ~65 px), entrega + D+N + "Produz" na mesma linha e ações em botões pequenos ("Liberar" no lugar de "Liberar para produção"). Medido a 1280×800: lista de pedidos começa em 501 px, sem rolagem lateral.
- Decisão do Hefesto: o cabeçalho compacto (`PageLayout compact`) foi aplicado só em Pedidos; as outras telas seguem iguais até aprovação.

## Quadro #3 (Lucas, 27/10) — lotes duplicados
- Pedido: abrindo o lote de uma data pelo aviso e depois "a semana pelo cronograma", o sistema gerou lotes duplicados (cartões 28/10 e 31/10 repetidos).
- Causa: abrir lote não olhava os lotes já existentes; o modo semana recriava loja × data já cobertas, e o painel mostrava um cartão por lote × data.
- Feito (no código): abrir lote (data ou semana) pula loja × data que outro lote já cobre — aberto ou já liberado; se não sobra nada, avisa "Já existe lote para todas essas datas e lojas". O painel mostra um cartão por data de entrega, juntando os lotes que cobrem a data; "Liberar lote" vai pela data.
- Dados do teste: duplicados removidos (cada loja × data ficou no lote que tem o pedido; sem pedido, no lote mais antigo); antes, cópia em `hefesto_backup._bak_order_batches_20261027` no banco de teste. Só lotes abertos foram mexidos.
- Produção: conferir duplicados antes de publicar o pacote (mesma limpeza, com cópia antes).

## Quadro #4 (Lucas, 27/10) — liberar por lote na lista, nada de liberar dentro do prazo
- Pedido: pedidos de várias lojas do mesmo lote apareciam um por linha, cada um com "Liberar para produção", mesmo com o prazo das lojas aberto.
- Feito (no código): na lista "Pedidos Auditáveis", os pedidos do mesmo lote ficam juntos sob uma faixa "Lote · entrega dd/mm" (lojas que pediram, prazo, quem falta) com o botão "Liberar lote (N)"; na linha do pedido de lote o botão vira "No lote". Enquanto as lojas ainda podem pedir, a faixa mostra "Aguardando prazo" (desabilitado) e o cartão do topo também fica desabilitado.
- Decisão do Hefesto: dentro do prazo o lote não é liberado nem com "liberar mesmo assim" (o servidor recusa, tanto o lote quanto um pedido do lote sozinho) — segue a frase do Lucas "a opção de liberar não deveria estar disponível". Libera quando todas as lojas pediram ou o prazo acabou. Pedido fora de lote continua com "Liberar" na linha.

## Quadro #5 (Lucas, 27/10) — OPs antigas sem "Avançar" na fila
- Pedido: OP-260924-004 e OP-260928-012 (Em espera, atrasadas) sem o botão "Avançar" na Fila de OPs.
- Causa: são da linha Panetones, com produtos POR BATIDA. O "Avançar" da fila só contava produtos que avançam por etapa; produto por batida só avançava abrindo a OP e concluindo a batida — sem pista na fila.
- Feito (no código): "Avançar" aparece também em OP com produtos por batida; ao clicar, pede confirmação e registra a próxima batida de cada produto (a última batida conclui o produto, como dentro da OP; dá para desfazer na OP). Vale para a fila do gestor e do chão; a seleção em lote também passa a aceitar essas OPs.
- Conferido local contra o banco de teste: OP-260928-012 mostrou "Avançar", avançou para Aguardando expedição; a faixa 26/10 continuou. OP-260924-004 já estava concluída no banco de teste (Aguardando expedição) quando conferimos.

### Correções pós-aceite (27/10, D11–D14)
- Auto-liberar não solta pedido de loja × data coberta por lote que ainda espera as lojas, nem pedido sem lote (centralizado) da mesma entrega — liberar um deles fechava a entrega para as lojas que faltam.
- "Pedido centralizado" e "Importar Excel" abriam "Pedido não encontrado" (a janela de detalhe capturava "centralizado" como código); agora abrem a página.
- Celular (390 px): coluna Ações e botão da faixa de lote não ficam fixos por cima do pedido e do prazo.
- "Já existe lote para todas essas datas e lojas" aparece como aviso, não como erro.
- Botão "Avançar" da fila de OPs mostra o texto em todas as larguras.

### Correção pós-aceite D14 (27/10, noite)

- Achado do agente revisor: depois de "Liberar lote", a faixa do lote sumia da lista de Pedidos (o lote era fechado e o painel só lia lotes abertos), e as linhas ficavam soltas.
- Correção: o painel lê os lotes abertos e, dos fechados, as datas de entrega dos últimos 7 dias (`batchesForOverview`). A faixa passa a "Lote liberado" e continua agrupando os pedidos. O cartão do topo continua saindo (o painel só mostra lotes não liberados).
- Dados de teste criados no sistema de teste para o aceite (PD-261027-0101 a 0114, nota "Dado de teste (Hefesto, aceite quadros 27/10)"); ajustes de lote com cópia em `hefesto_backup._bak_order_batches_20261027c`.

### Quadro #4 — Liberar na Visão Geral e no Detalhe (Lucas, 28/10)

- Pedido: "faz igual à tela de Pedidos: pedido de lote no prazo fica sem Liberar na Visão Geral e no detalhe do pedido."
- Visão Geral, coluna Aberto: pedido de lote no prazo mostra "No prazo" (dica com a entrega e o prazo das lojas) no lugar de "Liberar"; "Liberar tudo do dia" e "Liberar todos em espera" não contam nem liberam esses pedidos.
- Detalhe do pedido: botão desabilitado "Aguardando prazo do lote", com o prazo escrito abaixo.
- O servidor continua recusando (409) — a tela só deixa de oferecer a ação. Código: `src/lib/waiting-batch-orders.ts`, `src/components/production/use-waiting-batch-orders.ts`.

### Quadro #7 — Cabeçalho mais baixo em todas as telas (Lucas, 27/10)

- Pedido do cliente: "ERPs costumam ter linhas próximas, margens pequenas… ali está bem difícil de trabalhar". Corrigir primeiro no teste.
- Feito no cabeçalho padrão (vale para todas as telas que usam `PageLayout`): margem de cima da página menor (`py-3`), caminho (breadcrumb) numa linha fina, selo + título + ajuda na mesma linha (título menor, selo menor e sem animação), ações ao lado; espaço entre cabeçalho e conteúdo de 24 px para 8 px e entre blocos de 24 px para 12 px.
- Barra "Janela" com contagens: espaçamento menor em Expedição, Visão Geral, Ordens de Produção, Consumo de Insumos e Sobras (mesmo padrão).
- Medido no local (1528×800, Expedição): cards de indicadores começam ~40 px mais acima; cabeçalho ~60 px de altura (antes ~140 px).
- Decisão: aplicar em todas as telas (o pedido cita Expedição como exemplo; o problema é o mesmo componente).
- Ajuste (28/10): no computador o cabeçalho virou UMA linha — caminho (sem repetir a tela atual, que já é o título), selo, título e ajuda, com as ações à direita. Expedição local 1280×800: cards de indicadores em y≈141 px (antes ≈180+). No celular continua em linhas curtas, à direita do botão de menu.
- D16 (aceite): Detalhe do pedido no celular tinha rolagem lateral — botões do topo agora quebram linha e a janela do detalhe não alarga com a tabela de itens (coluna `minmax(0,1fr)` no `RouteModal`).

## Quadro #8 — Lentidão da produção depois do Supabase Pro (28/10)

- Plano Pro ativo na organização, mas o projeto `casaexpress` seguia sem compute (Nano, sem reinício desde 22/04).
- Com autorização do Lucas (quadro-8-2), aplicado compute **Micro** (`ci_micro`, ~US$ 10/mês, coberto pelo crédito do Pro) às 13:51 UTC; banco reiniciou às 13:52:44 UTC (shared_buffers 256 MB).
- Conta de medição criada em produção: `hefesto-medicao@dizevolv.com`, gestor de fábrica do Grupo Chama (uso só para leitura). Senha no 1Password, cofre "Hefesto - Clientes", etiqueta xpan.
- Medição (navegador, 1280 px, tempo até o último dado chegar; runner fora do Brasil):
  - Visão Geral: antes 6,8–7,8 s (metrics/planning 3–6 s cada, em paralelo) → depois 1,5–2,7 s.
  - Pedidos: 1,6–1,7 s → 1,4–1,6 s. Ordens de Produção: 1,7–3,1 s → 1,5 s. Expedição: 1,5–1,7 s → 1,6 s. Ocorrências: 1,4 s → 1,3 s.
  - Consulta trivial ao banco x30: 23/10 0,20–5,13 s; 28/10 (Micro) mediana 0,43 s, máx 1,48 s.
- O que ainda pesa (~1,3–1,6 s por tela): cada tela chama 2–6 APIs de 0,4–0,9 s (factory-planning e master-data ~0,7 s), com checagem de sessão/perfil em toda chamada. A Visão Geral de produção ainda chama as métricas (removidas no cartão #1, que só sobe com o pacote aprovado).
