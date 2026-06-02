# Brief de execução — Claude Code

> **Como usar:** abra o Claude Code na raiz do repo e diga: *"Leia
> `Docs/11 - Ajustes/Brief Claude Code — Ajustes 26-05 + gaps 13-05.md` e
> execute na ordem listada, um AJ por vez, parando para `tsc --noEmit` + `npm test`
> + eslint após cada um."*
>
> Estudo completo de origem: `Docs/11 - Ajustes/Estudo Trello — Analise 26-05 + Reuniao 13-05.md`.
> Padrão de backlog: `Docs/11 - Ajustes/Backlog de Ajustes.md` (registrar como AJ-0024…AJ-0028 + gaps).

## Regras de execução (ler antes)

- **Um item por vez.** Após cada item: `tsc --noEmit` limpo, `npm test` verde, `eslint` sem erros novos. Só então seguir.
- **Não remover funcionalidade sem confirmar.** Itens marcados `⛔ DECISÃO DE CLIENTE` **não devem ser codados** — só preparar/abrir questão.
- Seguir os padrões já existentes (ex.: `InfoHint` para tooltips, `useConfirm` para diálogos, endpoints existentes — não criar endpoint novo se houver um).
- Ao concluir, atualizar `Backlog de Ajustes.md` (status + commit) e `10 - Changelog Vivo/2026-05.md`.

---

## ORDEM 1 — 🔴 AJ-0025 · Editar receita não pode zerar o cronograma silenciosamente
**Card Trello:** `ltvmA8RE` (26/05 #5) · **Dívida:** D14

**Causa-raiz (confirmada):**
`src/lib/supabase-data/master-data-admin.ts` (~linha 946) — ao salvar produto,
a reconstrução de revisão de cronograma faz `schedule_lines.delete(...)` das
revisões `pendente` e recria uma nova `pendente`. Resultado: OPs derivadas
somem, pedidos voltam a não-planejáveis, e `releaseOrder` →
`OrderReleaseValidationError` → **HTTP 400** em
`src/app/api/factory-planning/workflow/route.ts` (bloco `catch`).

**O que fazer:**
1. Em `master-data-admin.ts`, **não deletar cego**: reaproveitar/rebasear a revisão pendente existente, herdando prioridades de `prioritySourceItemsByProductId` (já carregado na função) em vez de zerar. Se a recriação for inevitável, retornar metadados do impacto (quantas revisões/itens foram afetados).
2. Expor um **aviso de confirmação** antes do salvamento destrutivo no formulário de produto (`src/components/production/product-form-dialog.tsx`), usando `useConfirm`: "Editar este produto vai reconstruir a revisão pendente do cronograma e os pedidos afetados precisarão ser reauditados/reliberados. Continuar?".
3. **UX do erro 400:** no caminho que mostra o erro de liberação (dialog de `AlertDialog`), adicionar `AlertDialogTitle` + `aria-describedby` (corrige os warnings do console) e traduzir `OrderReleaseValidationError.reason` para mensagem acionável (ex.: "Cronograma reconstruído após editar o produto — reaudite antes de liberar").

**Aceite:**
- Editar receita de um produto com OPs/pedidos ativos **não** apaga silenciosamente; usuário é avisado.
- Após reauditar, os pedidos voltam a ser liberáveis sem 400 espúrio.
- Console sem warning de `AlertDialogContent`/`aria-describedby` no fluxo de liberação.

**Testes:** caso em `release-validation.test.ts` / workflow cobrindo "editar produto → reauditar → liberar OK"; snapshot/teste do dialog com título acessível.

---

## ORDEM 2 — 🔴 AJ-0024 · Cronograma escolhe variante/data errada + falha no 1º salvamento
**Card Trello:** `Xc8jwCfH` (26/05 #4) — **maior risco, blindar com testes**

**Causa-raiz (confirmada):**
`src/lib/factory-planning/engine.ts` — `resolveProductionDateInWindow` (~linha 339).
A busca regressiva procura dia de produção tal que `produção + lead = entrega`.
Quando a variante pedida não produz no dia necessário (ex.: Pao6 só sexta, mas
entrega sexta exigiria produção quinta), a busca falha e cai no **branch
"delayed" que avança até 14 dias** (linhas ~363–371) → produção 05/06 → dispara
`blockedReason` da **linha 294** ("cai após a entrega prevista"). O catálogo
permitiu pedir a variante incompatível em vez de oferecer a correta (Pao5).

**O que fazer:**
1. **Ler primeiro, por inteiro:** `src/lib/store-order-catalog.ts` e `src/lib/factory-planning/recipe-expansion.ts` antes de mudar o motor.
2. **Catálogo:** por data de entrega, oferecer a **variante cujo dia de produção é compatível** com a janela; bloquear/marcar como indisponível a variante incompatível **na entrada do pedido** (não aceitar e estourar depois). Reusar a sinalização de `blockedReason`/`available` que já existe.
3. **Motor:** quando `resolveProductionDateInWindow` cair no branch `delayed`/futuro, garantir que o item seja marcado `available:false` com motivo claro **antes do save** — não agendar +7 dias como se fosse válido.
4. **1º salvamento:** invalidar/forçar recomputo do snapshot de planejamento antes de persistir o primeiro pedido do tenant (ver cache ~10s citado no AJ-0011 e `server-data-cache.ts`/`planning-snapshot.ts`), eliminando o "salvou com 0 itens".

**Aceite:**
- Cenário do card: produto que só produz sexta, entrega sexta com lead +1 → sistema **oferece a variante de quinta (Pao5)** ou bloqueia, **nunca agenda +7 dias**.
- 1º pedido de um tenant novo salva com os itens corretos na primeira tentativa.

**Testes (obrigatórios em `engine.test.ts`):**
- "produz só sexta + entrega sexta + lead 1" → bloqueado/variante correta, não delayed +7.
- regressão do branch delayed: só ativa quando realmente não há janela ≤ lead.

---

## ORDEM 3 — 🟡 AJ-0026 · Criar categoria inline no modal "Nova Linha de produção"
**Card Trello:** `cUKnjx9p` (26/05 #1)

**O que fazer:** no modal de criação rápida de linha (aberto de dentro do
cadastro de produto), adicionar opção **"+ Nova categoria"** no dropdown
**Categoria**, reusando `POST /api/master-data/categories`. Ao criar,
selecionar a categoria automaticamente. **Preservar** o estado do formulário
de produto/linha ao abrir o sub-modal.
*Área:* `src/app/gestor-dados/linhas-producao/*`, `src/components/production/*`, `src/app/api/master-data/categories`.

**Aceite:** fluxo produto → criar linha → criar categoria sem sair/perder dados; nenhum "cancelar e recomeçar".

---

## ORDEM 4 — 🟡 AJ-0027 · Pedido: visualização do input numérico
**Card Trello:** `KiGOg0hB` (26/05 #2) — **só a parte visual**

**O que fazer (visual):** em `src/app/loja/pedidos/page.tsx`, na grade de
pedido: alinhar à direita, aumentar `min-width` da célula, formatar milhar
pt-BR ao `blur`, `tabular-nums`, e validar `max` razoável por célula para não
induzir duplicação de dígito.

**⛔ DECISÃO DE CLIENTE (não codar agora):** "liberar preenchimento nas outras
colunas" (multi-dia) está amarrado ao **AJ-0009** (fábrica abre N dias). Deixar
para a onda do AJ-0009. Apenas anotar no backlog.

**Aceite:** números longos legíveis e formatados; não trava a edição da 1ª coluna.

---

## ORDEM 5 — 🟢 AJ-0028 · Tooltip "Sequência Operacional" bugado
**Card Trello:** `hQn2Z2YC` (26/05 #3)

**O que fazer:** ajustar o layout do popover **Janela Operacional / Sequência
Operacional (Pedido → entrega → venda)** em `src/app/loja/pedidos/page.tsx`
(componente `InfoHint`/tooltip do AJ-0018): `min-width`, `grid` de 4 colunas
de largura igual, `tabular-nums` e quebra controlada para as datas não
sobreporem os rótulos das etapas. Só CSS/layout — não tocar regra.

**Aceite:** as 4 etapas e datas aparecem sem sobreposição/corte em desktop e mobile.

---

## GAPS de 13/05 (fazer após os de 26/05)

### 🟢 AJ-0003.1 · Justificativa (commit) ao editar produto, visível na auditoria
**Card:** `QW11M8T0` (ps2) · **Dívida:** D20
Campo obrigatório "motivo da alteração" no salvar produto; ampliar
`product_changelog.snapshot_data` (hoje só `name+description`) para registrar o
motivo + campos alterados; renderizar na auditoria de cronograma. Destacar
visualmente no diff (ps1) o que mudou.
*Área:* `src/lib/supabase-data/master-data-admin.ts` (~1216), `gestor-fabrica/sublinhas-producao/page.tsx`.

### 🟢 AJ-0004.1 · Decimal da receita propagado a jusante
**Card:** `ZcZQpu9D`
Auditar `src/lib/factory-planning/recipe-expansion.ts` + `src/lib/production-data-utils.ts`
para garantir que as frações finais usem o **decimal preciso** (ex.: 8,542857) em
todo o pipeline (demanda, OP, pré-pesagem) — não só na exibição (AJ-0004).
Adicionar teste de propagação.

### 🟡 AJ-0006.1 · Lote mínimo consolidado na fábrica (não por loja) + validação na API
**Card:** `c8HOkNBG` · **Dívida:** D09
Mover a noção de lote mínimo para a **consolidação da fábrica** (alerta no gestor
sobre a soma de todas as lojas). Garantir que a API não dependa só de
`window.confirm` do front. Remover qualquer resquício de mínimo por loja.

### ⛔ AJ-0009 · DECISÃO DE CLIENTE — fábrica abre o pedido (não codar)
**Card:** `8n2gpTPJ` (13/05 #5)
**Não implementar.** ADR pronto em `decisoes/ADR_modelo_fabrica_abre_pedido.md`
(recomendação: modelo C híbrido). Levar as 8 perguntas abertas para
Daniel + Adriano + Leonora. Desbloqueia também as colunas multi-dia do AJ-0027.

### ⛔ AJ-0005.1 / AJ-0008.1 · DECISÃO DE CLIENTE — confirmar expectativa
- **Itens inativos** (`fwgCb6xw`): hoje ocultos por padrão **com toggle**. Confirmar se o cliente aceita o toggle ou quer "nunca mostrar". Não mudar sem confirmar.
- **Ingrediente misturado puro → OP** (`sodx77wP`): AJ-0008 cobre produto-MPI; o ingrediente `type='misturado'` puro **não** vira OP por decisão de ADR. Confirmar se o Daniel quer estender (Fase 3) antes de codar.

---

## Resumo de prioridade

| Ordem | AJ | Card | Tipo | Codar agora? |
|---|---|---|---|---|
| 1 | AJ-0025 | 26/05 #5 | 🔴 Bug crítico (D14) | ✅ |
| 2 | AJ-0024 | 26/05 #4 | 🔴 Bug crítico (motor) | ✅ |
| 3 | AJ-0026 | 26/05 #1 | 🟡 UX | ✅ |
| 4 | AJ-0027 | 26/05 #2 | 🟡 UX (só visual) | ✅ parcial |
| 5 | AJ-0028 | 26/05 #3 | 🟢 Bug visual | ✅ |
| 6 | AJ-0003.1 | 13/05 #1 | 🟢 Auditoria (D20) | ✅ |
| 7 | AJ-0004.1 | 13/05 #3 | 🟢 Cálculo | ✅ |
| 8 | AJ-0006.1 | 13/05 #4 | 🟡 Regra/API (D09) | ✅ |
| — | AJ-0009 | 13/05 #5 | ⛔ Modelo | ❌ decisão |
| — | AJ-0005.1 / AJ-0008.1 | 13/05 #6/#2 | ⛔ | ❌ decisão |
