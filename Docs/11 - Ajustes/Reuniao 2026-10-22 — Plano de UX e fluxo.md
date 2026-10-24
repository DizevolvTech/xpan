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
- Fazer: multi-status em todas as listas; padrão gravado por usuário no servidor (tabela de preferências por perfil + página), localStorage só como cache.

### 3. Tela e rolagem
- Pedido (27:34): rolagem lateral horrível; botão Reabrir escondido à direita; monitor grande não é aproveitado.
- Hoje: `page-container` com `max-w-[1320px]`; tabelas largas; verificador viu rolagem em /administrador/usuarios a 390 px e cabeçalho do modal da OP espremido a 1280 px.
- Fazer: largura total (com limite alto só para leitura), tabelas compactas, ações principais à esquerda/visíveis, sem rolagem horizontal em 1280/1920/390 px.

### 4. Menos cliques
- Visão Geral (3:30): clicar no item abre o item (hoje leva à lista com `?status=`, e a Expedição nem lê o parâmetro).
- Expedição (7:20): pedido incompleto (83%) abre e mostra OPs/produtos faltantes (hoje só clica com produção 100%, e recarrega a página inteira).
- OP (9:03–9:39): mudar status direto da fila, várias de uma vez, informando quantidade; sem entrar produto a produto.
- OP Panetones travada (7:40–8:53): OP-260928-012, PR-61488 e PR-23307 em `em_preparacao` 20% no banco, tela "não iniciado" sem ação; itens por batida sem batidas na data. Reproduzir e garantir ação possível em toda OP.
- Imprimir OPs de amanhã (20:40): botão existe (`DayPrintButton`), deixar visível.

### 5. Resposta ao clique
- Pedido (6:50, 9:20): clique demora, parece que não funcionou.
- Fazer: indicador imediato de carregando; navegação sem recarga total. Upgrade do banco (Nano) é decisão do Lucas.

### 6. Dia de produção
- Pedido (10:50–19:47): o que produzir hoje/amanhã/atrasado; data de produção ao lado da entrega; antecipar com aviso.
- Hoje: fila de OPs por dia de produção no ar desde 23/10 (cliente não viu); lista de Pedidos só mostra entrega.
- Fazer: dias de produção na lista de Pedidos; filtro por dia de produção; trocar a trava de data futura por aviso (`workflow-date-guard.ts`).

### 7. Pedidos e lotes
- Pedido (20:50–30:22): painel de lotes (abertos, % de lojas, prazo, liberados; liberado sai); aviso de lote esquecido; "Pedido para entrega em dd/mm"; auto-liberar só com lote completo ou prazo encerrado.
- Hoje: só contador "Lote aberto X/Y"; lotes nunca fecham (Grupo Chama: 3 abertos, 2 desde 24/09); `autoReleaseEligibleOrders` libera pedido a pedido; aviso de lojas pendentes só na liberação manual.

### 8. Extras
- Lembrete por e-mail às lojas X horas antes do prazo (25:40) — não existe envio de e-mail.
- Soma por produto antes de liberar (28:16).
- Cadastro alterado não mexe em lote/OP já gerados (36:25–38:35) — receita já congelada na liberação; data de produção ainda recalculada.
- Excluir OP, só Master, com lixeira (39:03).

## Ambiente de teste
Prometido na reunião (38:35): o cliente testa numa cópia, sem risco para a operação.

## Fora de mudança
- Mix de produtos: esboço prometido pelo Lucas (segue adiado no snapshot).
- Cronograma Blumenau D-4 já ajustado pelo Daniel; D-3 é o prazo final.
- A confirmar: admin Márcio (Casa Express) não vê Pedidos.
