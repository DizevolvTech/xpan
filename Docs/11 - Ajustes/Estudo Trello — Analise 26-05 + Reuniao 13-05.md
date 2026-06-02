# Estudo de Resolução — Trello (Analise 26 de maio + Reunião 13/05)

> Análise técnica dos cards do board **Xpan – Dizevolv – Asantos Assessoria**,
> colunas **"Analise 26 de maio"** (achados novos do teste do Daniel) e
> **"Reunião 13/05"** (itens da call, cruzados com o [[Backlog de Ajustes]]).
> Cada item traz: o que o cliente apontou, a evidência (print), a causa no
> código, o status atual e o plano de resolução.

**Levantado em:** 2026-05-29 · **Fonte:** Trello `b/aMUPyBHE` + leitura do código

---

## Resumo executivo

- A coluna **"Reunião 13/05"** corresponde à Call 2026-05-13 e **já está, em sua maior parte, implementada** (Ondas 1–3 e iniciativa A1–A8). Sobram 2 itens estruturais/abertos e 3 refinamentos.
- A coluna **"Analise 26 de maio"** são **achados novos** do Daniel testando o sistema no dia 26/05. **Nenhum está no backlog ainda.** Dois deles são **críticos** (cards 4 e 5) e atacam o coração do motor de cronograma.
- O fio condutor dos dois bugs críticos é o **cronograma**: salvar pedido pela primeira vez e editar receita de produto deixam o planejamento num estado inconsistente.

| Prioridade | Itens |
|---|---|
| 🔴 Crítico | 26/05 #4 (falha 1º salvamento / cronograma), 26/05 #5 (editar receita zera OPs → 400) |
| 🟡 Importante | 26/05 #1 (categoria inline), 26/05 #2 (input numérico + colunas travadas), 13/05 #5 (AJ-0009 fábrica abre pedido) |
| 🟢 Polimento | 26/05 #3 (tooltip bugado), 13/05 #1/#3/#4/#6 (refinos sobre AJs concluídos) |

---

# PARTE A — Coluna "Analise 26 de maio" (achados novos)

## 26/05 #1 — Cadastro de categoria por dentro do cadastro da linha de produção
**Card:** `cUKnjx9p` · **Tipo:** UX / fluxo travado · **Prioridade:** 🟡

**O que o cliente apontou:** Ao criar um produto sem linha cadastrada, clicou em
"criar linha"; no modal **Nova Linha de produção** o campo **Categoria** estava
vazio e **não havia como cadastrar categoria ali**. Teve que cancelar tudo, criar
a categoria fora e recomeçar o cadastro do produto.

**Evidência:** print do modal "Nova Linha de produção" com o dropdown
**Categoria \*** (obrigatório) sem opções.

**Causa no sistema:** o modal de criação rápida de linha (aberto de dentro do
cadastro de produto) só consome categorias já existentes — não oferece
criação inline, então o fluxo aninhado (produto → linha → categoria) quebra na
terceira camada.
*Área:* `src/app/gestor-dados/linhas-producao/*` · `src/components/production/*` (modal "Nova Linha de produção") · `src/app/api/master-data/categories`.

**Plano de resolução:**
1. Adicionar opção "**+ Nova categoria**" no dropdown Categoria do modal de linha (mesmo padrão "criar sem sair" já usado para a linha dentro do produto).
2. Reaproveitar `POST /api/master-data/categories`; ao criar, selecionar automaticamente a categoria nova.
3. Garantir que o estado do formulário de produto/linha seja preservado ao abrir o sub-modal (não perder o que já foi digitado).

**Esforço:** baixo-médio (UI + reuso de endpoint existente).

---

## 26/05 #2 — Pedido: visualização do campo e colunas travadas
**Card:** `KiGOg0hB` · **Tipo:** UX / regra · **Prioridade:** 🟡

**O que o cliente apontou:** "Digitei um número gigante proposital, a quantidade
de caracteres visíveis é pequena e pode induzir ao erro de duplicar um caracter.
Ajustar visualização. **Liberar possibilidade de preencher nas outras colunas.**"

**Evidência:** modal **Novo Pedido** — a célula mostra "123" mas o TOTAL é
**12341234 Kg** (o campo trunca o número). Só a coluna do primeiro dia (**SÁB 30**)
é editável; **DOM 31** em diante aparecem com "0" e travadas.

**Causa no sistema (2 partes):**
- **Visualização:** o input numérico da grade de pedido tem largura fixa pequena e trunca números longos sem feedback.
- **Colunas travadas:** hoje só o primeiro dia da janela é editável. Liberar os demais dias depende da regra **"fábrica abre vários dias"** — está amarrado ao **AJ-0009 / AJ-0014** (dias de cobertura).
*Área:* `src/app/loja/pedidos/page.tsx` (grade de pedido, células por dia).

**Plano de resolução:**
1. **Visualização (rápido):** alinhar à direita, aumentar largura/`min-width`, formatar milhar pt-BR ao perder o foco e validar `max` razoável por célula.
2. **Colunas (depende de modelo):** liberar edição multi-dia faz parte do AJ-0009 (fábrica abre N dias → soma cobre a semana). Tratar junto da decisão do modelo, não isolado.

**Esforço:** parte 1 baixo; parte 2 amarrada ao AJ-0009.

---

## 26/05 #3 — Pedido: instruções sobre a loja (visualização bugada)
**Card:** `hQn2Z2YC` · **Tipo:** Bug visual · **Prioridade:** 🟢

**O que o cliente apontou:** título do card já diz "visualização bugada".

**Evidência:** o popover **Janela Operacional / Sequência Operacional
(Pedido → entrega → venda)** renderiza as 4 etapas com **datas e rótulos
sobrepostos/cortados** ("26/05/202", "26/05/202", "29/05/2026" colados nos
rótulos das colunas).

**Causa no sistema:** o componente do popover/tooltip de sequência operacional
tem largura/grid insuficiente — as 4 colunas de etapa estouram o container e as
datas se sobrepõem aos títulos.
*Área:* `src/app/loja/pedidos/page.tsx` + componente de tooltip/`InfoHint` da sequência operacional (introduzido no AJ-0018).

**Plano de resolução:** ajustar o layout do popover (largura mínima, `grid` com
colunas de largura igual, `white-space`/`tabular-nums` nas datas, quebra
controlada). É CSS/layout — não toca regra de negócio.

**Esforço:** baixo.

---

## 26/05 #4 — Falha no salvamento do 1º pedido + erro de cronograma 🔴
**Card:** `Xc8jwCfH` (8 anexos) · **Tipo:** Bug crítico (motor) · **Prioridade:** 🔴

**O que o cliente apontou (cenário reproduzido):**
- Empresa nova, padrão D+3 (entrega) e D+1 (venda); 2 produtos: **Pao5** (produz quinta) e **Pao6** (produz sexta).
- **1ª tentativa** parecia OK mas deu **erros de cronograma**; o pedido da 1ª loja **não liberou para produção** (salvou com **0 itens**).
- Erro no popup: **"Produção em 05/06/2026 +1 dia(s) cai após a entrega prevista (29/05/2026). (PR-99880)"** — produção calculada **uma semana depois**.
- Inconsistência de variante: para entrega 29 (sexta) o sistema puxou **Pao6**; deveria ter puxado **Pao5** (produção 28, quinta).
- Criar outras 2 lojas depois "funcionou aparentemente", mas o erro do cronograma se manteve no detalhe.

**Causa no sistema (duas frentes):**

1. **Seleção de data/variante errada — `resolveProductionDateInWindow`** (`src/lib/factory-planning/engine.ts:339`). A busca regressiva procura um dia de produção que, somado ao lead de expedição, bata exatamente na data de entrega. Quando o produto não produz no dia necessário (Pao6 só produz sexta, mas a entrega de sexta exigiria produção quinta), a busca regressiva falha e cai no **branch "delayed" que avança até 14 dias no futuro** (linhas 363–371) → produção em **05/06** → dispara o `blockedReason` da linha **294** ("cai após a entrega prevista"). Ou seja: o catálogo permitiu pedir um produto para uma data que ele não consegue produzir, em vez de oferecer a variante correta (Pao5).

2. **1º salvamento com 0 itens / inconsistência transitória.** O snapshot de planejamento é derivado em runtime com **cache de ~10s** (citado no AJ-0011) e o status "aguardando_expedicao" é derivado, não persistido. No primeiro salvamento de um tenant recém-criado, o pedido grava antes de o cronograma estar coerente → salva sem itens planejáveis; nas tentativas seguintes (outras lojas) o cache já está aquecido e "funciona".

**Plano de resolução:**
1. **Não deixar a loja pedir o que não é produzível para a data:** o catálogo de pedido (`store-order-catalog.ts`) deve, por data de entrega, oferecer a **variante cujo dia de produção é compatível** (Pao5 para entrega que exige produção quinta) e bloquear/ocultar a incompatível — em vez de aceitar e estourar no cronograma.
2. **Tornar explícito o branch "delayed":** quando `resolveProductionDateInWindow` cai no futuro (>14d ou delayed), o item deve sinalizar "sem janela compatível" **na entrada do pedido**, não só no detalhe pós-save.
3. **1º salvamento:** invalidar/forçar recomputo do snapshot antes de persistir o primeiro pedido do tenant (ou reduzir a janela de cache no salvamento) para eliminar o "salvou com 0 itens".
4. Cobrir com testes no `engine.test.ts` o caso "produto produz só sexta, entrega sexta com lead +1" (deve resolver para a variante de quinta ou bloquear, nunca agendar +7).

**Esforço:** médio-alto (motor + catálogo + testes). É o item de maior risco.

---

## 26/05 #5 — Editar receita de produto zera OPs e quebra liberação (400) 🔴
**Card:** `ltvmA8RE` · **Tipo:** Bug crítico (dados/fluxo) · **Prioridade:** 🔴 · **Relacionado:** depende do #4, casa com **Dívida Técnica D14**

**O que o cliente apontou:**
1. Lançou 2 OPs para produção.
2. Percebeu erro numa receita.
3. **Ao salvar o produto com nova receita, as OPs existentes sumiram e os pedidos voltaram ao status "pendente de liberação".**
4. Ao tentar liberar novamente, **deu erro** (print do console).

**Evidência (console):** múltiplos **`Failed to load resource: 400` em
`/api/factory-planning/workflow`**, além de warnings de acessibilidade
(`AlertDialogContent` sem `AlertDialogTitle`/`aria-describedby`).

**Causa no sistema (confirmada no código):**
- Editar produto dispara a **reconstrução da revisão de cronograma** em
  `src/lib/supabase-data/master-data-admin.ts:946`: se há revisões **pendentes**,
  elas são **deletadas** (`schedule_lines.delete(...)`) e uma nova revisão `pendente`
  é criada. Isso é exatamente a **Dívida Técnica D14** ("reconstrução de cronograma
  deleta pendentes sem aviso").
- Com o cronograma de volta a `pendente` (não auditado/ativo), o motor não planeja
  os pedidos → as OPs derivadas "somem" e os pedidos voltam a não-liberáveis.
- O `releaseOrder` então valida via `assertPlanningAllowsRelease` e lança
  `OrderReleaseValidationError` (`release-validation.ts`), que o endpoint
  `PATCH /api/factory-planning/workflow` converte em **HTTP 400**
  (`route.ts`, bloco `catch`). É o 400 do print.

**Plano de resolução:**
1. **Avisar antes de destruir (D14):** ao salvar produto que dispara reconstrução, exibir confirmação explicando que revisões pendentes/OPs derivadas serão recriadas (e o impacto nos pedidos já liberados).
2. **Preservar o que dá:** em vez de `delete` cego das pendentes, reaproveitar/rebasear a revisão pendente quando possível (a função já carrega `prioritySourceItemsByProductId` — usar para herdar prioridades em vez de zerar).
3. **Re-liberar automaticamente** os pedidos afetados quando a nova revisão for auditada, ou deixar claro na UI que precisam ser reauditados/reliberados.
4. **UX do erro 400:** o dialog de erro precisa de `AlertDialogTitle` + `aria-describedby` (corrige os warnings) e deve traduzir o `reason` para uma mensagem acionável ("o cronograma foi reconstruído após editar o produto X — reaudite o cronograma antes de liberar").

**Esforço:** médio (lógica de reconstrução + UX). Boa parte é "não destruir silenciosamente".

---

# PARTE B — Coluna "Reunião 13/05" (cruzamento com o backlog)

> Esta coluna é a Call 2026-05-13. A maior parte já foi entregue. Abaixo, o
> status real de cada card e o **gap** que ainda sobra.

## 13/05 #1 — Relação entre dia de produção e expedição (na auditoria de cronograma)
**Card:** `QW11M8T0` · **Mapeia:** AJ-0003 ✅ + AJ-0012 ✅ — **gap parcial**

- ✅ Coluna `expedition_lead_days` na auditoria (AJ-0003).
- ✅ Diff por produto na auditoria (AJ-0012).
- ⚠️ **Gap (ps2 do card):** exigir **justificativa (COMMIT) ao alterar um produto** e exibi-la na auditoria do cronograma — **não implementado**. Esbarra na Dívida Técnica **D20** (`product_changelog` só guarda `name+description`).
- ⚠️ **Gap (ps1):** "destacar quais dados do cronograma foram alterados" — o diff existe, mas falta destaque visual explícito do que mudou.

**Plano:** adicionar campo obrigatório de "motivo da alteração" no salvar produto, persistir em `product_changelog` (ampliar snapshot — resolve D20) e renderizar na auditoria.

## 13/05 #2 — OP para ingrediente Misturado
**Card:** `sodx77wP` · **Mapeia:** AJ-0008 ✅ **Concluído / ativado em produção (2026-05-20)**

- ✅ Produto-MPI (`is_mpi_ingredient`) gera OP separada via `recipe-expansion.ts`, default ON (`EXPAND_MPI_INTO_OPS`).
- ℹ️ **Nuance:** o caminho **ingrediente `type='misturado'` puro continua sem virar OP** (fica como composição na pré-pesagem) — decisão registrada no ADR. O card pede exatamente isso ("se um ingrediente é setado como Misturado, deve participar de uma OP"). **Confirmar com o Daniel** se o caminho canônico produto-MPI atende, ou se ele quer o ingrediente-misturado puro também gerando OP (Fase 3).

**Plano:** validar com o cliente; se exigido, estender a expansão para `ingredients.type='misturado'`.

## 13/05 #3 — Produto: cadastro de receita (frações decimais)
**Card:** `ZcZQpu9D` · **Mapeia:** AJ-0004 ✅ — **gap de cálculo**

- ✅ Exibição com 3 casas decimais (AJ-0004) — não arredonda mais para unidade na tela.
- ⚠️ **Gap (pergunta do card):** "não sei como o sistema considera esse número a partir daqui". O AJ-0004 tratou **exibição**; falta confirmar se o **cálculo a jusante** (engenharia/expansão de receita, demanda, OP) usa o decimal preciso (`8,542857`) ou o valor arredondado. Comentário do Daniel: "tenho pontos a revisar sobre pesos e taxas de conversão".

**Plano:** auditar `recipe-expansion.ts` + `production-data-utils.ts` para garantir que a quantidade final em frações seja propagada como decimal em todo o pipeline (não só na UI). Card 8 é meio-feito.

## 13/05 #4 — Mínimo de produção indevido (lado loja)
**Card:** `c8HOkNBG` · **Mapeia:** AJ-0006 ✅ — **gap de API (D09)**

- ✅ Alerta "abaixo do mínimo" e `window.confirm` removidos do lado loja (AJ-0006). O print do card é anterior ao fix.
- ⚠️ **Gap:** **D09** — a validação de lote mínimo nunca existiu na API; a regra correta ("mínimo é problema da fábrica, soma das lojas") deve viver no nível **consolidado da fábrica**, não por loja. Hoje não há validação consolidada.

**Plano:** mover a noção de lote mínimo para a consolidação da fábrica (alerta no gestor, sobre a soma de todas as lojas) e remover qualquer resquício por loja.

## 13/05 #5 — Meus Pedidos: DUPLICIDADE (fábrica abre o pedido)
**Card:** `8n2gpTPJ` (importante) · **Mapeia:** AJ-0007 ✅ (UX) + **AJ-0009 ⏸️ implementado, parqueado (flag OFF)**

- ✅ Aviso proativo de pedido duplicado no diálogo "Novo Pedido" (AJ-0007).
- ⏸️ **Estrutural (AJ-0009):** o modelo "**fábrica abre os pedidos por dia da semana → loja só preenche os disponíveis**" foi **decidido (Aceito, Opção C) e implementado** (fundação + UI + migration aplicada) na Sprint 23, **mas fica parqueado atrás da flag `NEXT_PUBLIC_FACTORY_OPENS_ORDERS` (OFF)** — ver `decisoes/ADR_modelo_fabrica_abre_pedido.md`. O card descreve exatamente esse modelo (1 pedido por dia, sem repetir, comparação com "lotes" do Consinco).

> **Resolução (2026-05-30):** na validação ficou claro que **a LOJA é quem cria os pedidos** (1 por janela). A inversão "fábrica abre → loja só preenche" trancava a loja quando a fábrica não havia aberto nada. Decisão: **manter a flag OFF**; o código fica como recurso opcional. Ver [[Backlog de Ajustes#AJ-0009 — Mudar modelo: fábrica abre pedido → loja preenche|AJ-0009]].

**Plano (histórico):** este era o item de maior impacto de modelo. As **8 perguntas abertas** do ADR (entidade `order_windows` vs estado em `store_orders`) seguem pendentes para uma eventual **Fase 4b** — só se o modelo for redesenhado.

## 13/05 #6 — Pedido da loja: itens inativos não devem aparecer
**Card:** `fwgCb6xw` (importante) · **Mapeia:** AJ-0005 ✅ — **gap de default**

- ✅ Implementado: indisponíveis vão para o fim da lista + toggle **"Ocultar indisponíveis"**, **ligado por padrão** (`hideUnavailable = true`, `loja/pedidos/page.tsx:242`). O print do card é de 31/03 (antes do fix).
- ⚠️ **Gap:** o card pede "**não devem aparecer**" (sem opção). Hoje aparecem ocultos por padrão **mas com toggle** que permite mostrá-los. Confirmar com o cliente se o toggle pode ficar (recomendado, ajuda diagnóstico) ou se deve sumir totalmente.

**Plano:** provavelmente já atende; alinhar expectativa do "nunca mostrar" vs "ocultar por padrão com opção".

---

# Ordem de ataque sugerida

1. **🔴 26/05 #5** — parar a destruição silenciosa do cronograma ao editar receita (D14) + UX do erro 400. Alto valor, risco contido.
2. **🔴 26/05 #4** — corrigir seleção de variante/data no catálogo + motor; é o mais arriscado, blindar com testes.
3. **🟡 26/05 #1, #2(visual), #3** — quick wins de UX que destravam o cadastro e a tela de pedido.
4. **🟡 13/05 #5 (AJ-0009)** — decisão de modelo com o cliente; desbloqueia também 26/05 #2 (colunas multi-dia).
5. **🟢 Gaps remanescentes** — 13/05 #1 (commit/justificativa), #3 (decimal a jusante), #4 (mínimo consolidado na API/D09).

# Próximos passos

- Transformar os 5 cards de **26/05** em entradas formais **AJ-0024…AJ-0028** no [[Backlog de Ajustes]] (hoje não estão lá).
- Para cada gap de 13/05, decidir se reabre o AJ ou abre um AJ-filho.
- As decisões de cliente pendentes (AJ-0009; ingrediente-misturado puro virar OP; toggle de indisponíveis) precisam de uma call curta antes de codar.
