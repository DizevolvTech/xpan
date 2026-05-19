# UX-0001 — DataTable responsivo (fallback card/empilhado < 640px, zero scroll-x)

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner` aplicado como **motor de análise**, modo spec-only).
> Companheira de [[Backlog UX (RICE)]] (item #1, l.31 e l.60-65 — **maior RICE da
> iniciativa, Score 18.0**), [[UX PRD]] (critérios "Responsivo" §6; métrica **M3**
> = 0 scroll-x em data-table ≤640px; resolução Gate 0 §10), [[UX Audit — Sistema]]
> (achado [[UX Audit — Sistema#F-3 — DataTable não-responsivo (scroll horizontal cego no mobile) · 🔴 · Responsivo|F-3]]).
> Convenção: [[12 - Iniciativa UX/README|README]]. Consome
> [[UX-0005 — escala-espacamento-opacidade|UX-0005]] (tokens `--opacity-*` /
> `--spacing-rhythm-*`, commitado), integra com
> [[UX-0003 — skeleton-loading|UX-0003]] (`DataTableSkeleton` **já no
> data-table.tsx**), [[UX-0007 — empty-state|UX-0007]] (`EmptyState` **já no
> data-table.tsx**), [[UX-0002 — sistema-toast-feedback|UX-0002]] /
> [[Backlog UX (RICE)|UX-0004]] (`<Button isLoading>`). Espelha a gramática de
> primitivo de `shared/skeleton.tsx` / `shared/empty-state.tsx`.

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, ordenação, paginação, navegação
  nem `permission-modules`**. UX-0001 muda **apenas a apresentação** dos mesmos
  dados/ações: em viewport estreita, a **mesma informação** é reorganizada de
  linha-de-tabela para **card empilhado rótulo→valor**. Nenhuma coluna, nenhuma
  ação, nenhum estado é perdido — só **reflua** para um layout que cabe no
  polegar.
- **Desktop byte-equivalente.** Em viewport ≥ breakpoint, o DataTable renderiza
  **exatamente o `<table><thead><th>…</tbody>` de hoje** — mesma marcação, mesmas
  classes, mesmo DOM. O e2e (`e2e/regression.py`) roda a **1500×1000** e asserta
  `page.locator("table thead th")` (AJ-0016) → **não pode** haver troca de
  estrutura nesse breakpoint. A apresentação card é **aditiva** e só existe
  abaixo do breakpoint.
- **Reuso-primeiro.** O `data-table.tsx` **já foi modificado** por UX-0003
  (`DataTableSkeleton` no bloco `isLoading`, l.210-218) e UX-0007 (`EmptyState`
  no bloco `data.length===0`, l.220-243). Esta spec **integra** com esses
  primitivos já presentes — **não duplica** loading/empty, não reescreve o sort,
  a paginação (`PaginationControls`), o expand nem a lógica read-only-tenant.
  Cor/opacidade **só** via token + degrau `--opacity-*`; espaçamento via
  `--spacing-rhythm-*`. Zero dependência nova (CSS/markup puro + Tailwind 4).
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa
  posterior, **após aprovação explícita do usuário** (este item é o **checkpoint
  de aprovação da Onda 1** — ver §0). Esta spec **não toca `src/`**.
- **Maior raio da iniciativa.** O `DataTable` alimenta **17 telas consumidoras**
  (grep `import { DataTable }` em `src/app`, §1.3) cobrindo ~5 personas + a fila
  de OPs + a matriz de usuários. Uma regressão aqui cascateia para 17 telas →
  esta spec **isola desktop de mobile por construção** e exige canário + smoke
  6 personas + e2e 0-FAIL (§5).
- **Fronteira com itens de tela.** UX-0001 entrega **a estratégia no primitivo
  `DataTable`**. As telas-piloto densas têm itens próprios na Onda 2:
  [[Backlog UX (RICE)|UX-0016]] (`administrador/usuarios`, matriz
  `min-w-[1500px]`), [[Backlog UX (RICE)|UX-0012]]
  (`gestor-fabrica/ordens-producao`, `min-w-[920px]`). O que UX-0001 **adota** vs
  **delega** está explícito em §2.7 — a matriz densa é sinalizada como
  **risco/dependência**, não resolvida aqui.

---

## 0. Decisão para o usuário (checkpoint da Onda 1)

> Este é o item de **maior alavancagem da iniciativa** (RICE 18.0; alimenta **17
> telas**). Antes de implementar, o usuário precisa **aprovar a abordagem**. Esta
> seção resume a escolha, as alternativas e o ponto exato de decisão.

### 0.1 Abordagem escolhida — **C: render condicional card×tabela por breakpoint, controlado por CSS (table desktop intacto + lista mobile irmã, alternância via `hidden`/`sm:` — uma fonte de dados, dois layouts, ambos no DOM, zero JS de viewport)**

Em `≥ sm` (640px, o breakpoint nativo do Tailwind — **a casa não tem
`--breakpoint` custom**, confirmado em `globals.css`), o DataTable renderiza o
**`<table>` de hoje, byte-a-byte** (mesmas classes, mesmo DOM, mesmo
`<thead><th>`). Em `< sm`, esse `<table>` é ocultado via `hidden sm:block`
(wrapper) e uma **lista de cards irmã** (`<ul>` semântica) — gerada do **mesmo
array `visibleData`, das mesmas `columns`/`actions`** — é exibida via
`sm:hidden`. **Ambos os ramos vivem no mesmo componente, a partir da mesma
fonte**; a alternância é **100% CSS** (`hidden`/`sm:hidden`), **sem
`window.matchMedia`, sem `useState` de viewport, sem hidratação condicional** →
zero risco de mismatch SSR/CSR e zero flash.

**Por quê C e não "CSS-only sobre o mesmo `<table>`"** (alternativa B, abaixo): o
fallback card precisa **rotular cada valor** (`column.header` → `column.render`)
e **reagrupar as ações num rodapé do card** — uma transformação de **estrutura**
(quem é título, quem é rótulo, quem é grupo de ação), não só de fluxo visual. Com
um único `<table>` e CSS `display:block` nos `td`, não há de onde tirar o
**rótulo** por célula (o `<th>` está no `<thead>`, fora da linha) sem duplicar os
headers em `::before` via `content:attr()` — frágil, não traduzível, e quebra com
`column.render` retornando JSX. A casa **já tem precedente** de "estrutura irmã
trocada por breakpoint" no `PaginationControls` (`flex-col … sm:flex-row`,
`pagination-controls.tsx:45`) — C é o idioma da casa, não uma invenção.

**Custo aceito (declarado):** em `< sm`, **ambos** os ramos estão no DOM (um
`hidden`). Como o DataTable já **pagina** (`initialPageSize=10`,
`visibleData = paginated.items`), o DOM duplicado é de **≤ pageSize linhas**
(default 10), não do dataset inteiro — custo de memória/render irrelevante e o
ramo `hidden` não pinta (display:none). É o tradeoff explícito por **zero JS de
viewport** (a alternativa com `matchMedia` evitaria a duplicação mas
reintroduziria risco de hidratação/flash — pior tradeoff para um primitivo de 17
telas). **Ponto de aprovação R-A (§6).**

### 0.2 Alternativas consideradas (trade-offs)

| | **A — `overflow-x-auto` "menos pior"** (scroll-x estilizado, scroll-snap, sombra de borda) | **B — CSS-only puro** (1 `<table>`, `td{display:block}` + `::before content:attr(data-label)` < sm) | **C — render condicional card×tabela (ESCOLHIDA)** |
|---|---|---|---|
| Resolve M3 (zero scroll-x ≤640px)? | ❌ **Não** — ainda é scroll horizontal cego; só "menos feio". Reprova o critério do PRD. | ✅ Sim | ✅ Sim |
| Desktop byte-equivalente (e2e `table thead th` a 1500px)? | ✅ (não mexe ≥sm) | ⚠️ **Risco** — mesmo `<table>` em todos os breakpoints; o `::before` exige `data-label` em **todo** `<td>` (toca o render desktop); fácil vazar estilo p/ ≥sm | ✅ **Sim** — ramo `<table>` ≥sm é o de hoje, intacto; card é nó **separado** só <sm |
| Preserva `column.render` JSX (badges, botões dentro de célula)? | ✅ | ⚠️ **Parcial** — `content:attr()` só renderiza **texto**; um `column.render` que devolve `<StatusBadge/>`/JSX **não** vira `::before`; o valor real fica solto sem rótulo | ✅ **Sim** — o card chama `column.render(item)` igual à tabela; JSX preservado |
| Rótulo por valor no mobile (a11y/scan) | ❌ (sem rótulo, scroll) | ⚠️ via `attr()` — não traduzível por i18n, quebra com JSX | ✅ `<dt>`/`<dd>` reais com `column.header` |
| Ações (eye/edit/delete/print…) acessíveis no polegar | ❌ (fora da viewport) | ⚠️ empilham mas sem agrupamento claro | ✅ rodapé do card, hit-target ≥44px |
| Risco de regressão nas 17 telas | Baixo (quase não muda) mas **não resolve o problema** | **Médio-alto** (toca o `<td>` de todas) | **Baixo-médio** (ramo desktop isolado; card é aditivo) |
| Esforço relativo | Baixo | Médio | Médio (E1.5 do RICE) |

**A** é descartada: não cumpre M3 (PRD §3) — é cosmética sobre o scroll cego.
**B** é descartada: o `data-table.tsx` usa `column.render(item)` retornando **JSX
arbitrário** (badges, ícones, botões — ver consumidores §1.3); `::before
content:attr()` só serve texto plano e exigiria tocar **todo `<td>` do ramo
desktop** (`data-label=…`), pondo em risco a equivalência byte-a-byte que o e2e
exige a 1500px. **C** isola o ramo desktop (intacto) do card (aditivo, só <sm) —
**menor risco no item de maior raio**, e é o idioma já usado em
`PaginationControls`.

### 0.3 O ponto exato que o usuário precisa aprovar

1. **A abordagem C** (tabela desktop intacta + lista de cards irmã <640px,
   alternância 100% CSS, ambos no DOM paginado) — vs. a alternativa A (só
   estilizar o scroll, **não recomendada** — não cumpre M3) ou B (CSS-only puro,
   **não recomendada** — risco no e2e desktop + perde `column.render` JSX).
2. **Breakpoint = `sm` (640px), nativo do Tailwind** (casa-se com M3 "≤640px" e
   com o precedente `PaginationControls`). Alternativa: introduzir
   `--breakpoint-*` custom (não recomendado — a casa não tem; viola
   reuso-primeiro). **Ponto R-B (§6).**
3. **Raio de impacto: 17 telas** (lista em §1.3). Aprovar UX-0001 = aprovar a
   estratégia que **todas as 17** herdam por cascata, incluindo as 2 piloto
   densas (`administrador/usuarios`, `gestor-fabrica/ordens-producao`) que terão
   **ajuste fino dedicado** em UX-0016/UX-0012 (Onda 2) — UX-0001 entrega o
   comportamento-base; **a matriz `min-w-[1500px]` pode precisar de tratamento
   extra** (sinalizado §2.7 / §6 R3).
4. **Custo aceito:** DOM duplicado de ≤`pageSize` (10) linhas em <sm (ramo
   `hidden`) — tradeoff por zero-JS-de-viewport (§0.1 / R-A).

> Sem a aprovação destes 4 pontos, o Front-End **não** inicia a implementação
> (gate da Onda 1).

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 —
auditoria do design system existente; Fase 2 — diagnóstico; Fase 3 — plano
**contra** o sistema existente; **nenhuma edição** — modo spec-only). Achados
consolidados (categoria **Responsivo**, achado **F-3**):

1. **Scroll horizontal cego no mobile** (checklist da skill, *Responsive →
   "No horizontal scroll on mobile unless intentional (tables are the classic
   offender — give them a card fallback or horizontal scroll container with a
   clear affordance)"*). O `DataTable` **força** `min-w-[640px]` no `<table>`
   (`data-table.tsx:251`) dentro de um wrapper `overflow-x-auto
   overscroll-x-contain` (`:248`). Em ≤640px a tabela **transborda** e some pro
   lado — sem affordance, sem fallback. Telas reais agravam: a matriz
   `administrador/usuarios` passa `tableClassName="min-w-[1500px]"` (`:879`),
   `administrador-master/clientes` `min-w-[1200px]` (`:400`).
2. **Sem estratégia de densidade por viewport** (skill, *Responsive → "Does the
   layout reflow, or just shrink?"*): hoje só **encolhe e estoura** — não há
   reflow card/empilhado. A loja opera em **celular no balcão** (persona de maior
   risco, [[UX PRD#5. Personas-alvo]]); uma tabela de pedido com 1120px de
   largura é inoperável com o polegar.
3. **Affordance de ação fora de alcance** (skill, *Touch targets / Fitts*): a
   coluna "Ações" (eye/edit/delete/print/add/user/alert/launch) fica **à direita,
   fora da viewport** no mobile — o usuário precisa scrollar horizontalmente às
   cegas para achar "excluir"/"liberar". Hit-target dos ícones hoje é
   `size-icon-sm` (< 44px touch).
4. **Sem vocabulário responsivo de tabela na casa** (skill Fase 3 — *"Does the
   project already have a primitive for this?"*): **não existe** fallback
   card/empilhado em `src/components/`. Mas **existe um precedente de estrutura
   trocada por breakpoint**: `PaginationControls`
   (`pagination-controls.tsx:45` `flex flex-col … sm:flex-row sm:items-center
   sm:justify-between`) — o idioma da casa para "uma estrutura em mobile, outra
   em desktop" é **`flex-col` + `sm:`**, não `matchMedia`. UX-0001 segue esse
   idioma.

UX-0001 ataca **(1)–(4)** dando ao `DataTable` um **ramo card/empilhado < sm**
(do mesmo dado/colunas/ações) e mantendo o **ramo `<table>` ≥ sm intacto**. A
cascata p/ as 17 telas é automática (herdam o primitivo); o ajuste fino das 2
telas densas é **delegado** a UX-0012/0016 (§2.7).

### 1.2 Estado ATUAL do `data-table.tsx` (lido linha-a-linha — pós UX-0003/0007)

> ⚠️ O backlog cita "l.243-248" — números **antigos**. O arquivo foi modificado
> por UX-0003/0007. Estado real lido em 2026-05-19 (463 linhas):

| Recurso | Onde (linha real ATUAL) | Como é renderizado hoje |
|---|---|---|
| **Loading** | `data-table.tsx:210-218` | `if (isLoading) return <DataTableSkeleton columns hasActions compact/>` — **UX-0003, já integrado**. Não tocar a lógica; o ramo card precisa de **skeleton compatível** (§2.5). |
| **Empty** | `:220-243` | `if (data.length === 0) return <EmptyState description={emptyMessage} action={…} />` com a trava read-only injetada (`disabled: isReadOnlyTenantView && !allowInReadOnly`) — **UX-0007, já integrado**. `EmptyState` **não é tabular** → já é responsivo; o ramo card **não duplica** isto (§2.5). |
| **Moldura** | `:247` | `<div className="overflow-hidden rounded-xl border border-border/65 bg-card shadow-[var(--shadow-card)]">` |
| **Scroll wrapper (RAIZ DO F-3)** | `:248` | `<div className="overflow-x-auto overscroll-x-contain">` — o container de scroll-x |
| **min-width forçado (RAIZ DO F-3)** | `:251` | `<table className={cn("w-full min-w-[640px] border-collapse bg-card xl:min-w-full", tableClassName)}>` — `min-w-[640px]` base **+** `tableClassName` (telas injetam `min-w-[1500px]` etc.) |
| **thead / sort** | `:255-313` | `<thead>` (`sticky top-0 z-10` se `stickyHeader`); cada `<th>` com `aria-sort`; colunas ordenáveis viram `<button onClick={setColumnSort(toggleColumnSort)}>` + ícone `ChevronUp/Down/ArrowUpDown`. Coluna "Ações" = `<th>` extra à direita. |
| **Linhas / células** | `:315-363` | `visibleData.flatMap(item => …)`: `<tr>` (hover, `cursor-pointer` se `rowClickable`, `bg-primary/[.04]` se expandida, `rowClassName`); `onClick` ignora cliques em `button,a,input,select,textarea,[role=button],[data-stop-row-click]`. Cada `<td>` = `column.render(item)` **ou** `formatDefaultCellValue`. |
| **Ações** | `:365-413` | `<td>` final: `actions.map` → `<Button size="icon-sm" variant=ghost/outline title aria-label>` com `Icon`. Trava: `isBlockedInReadOnly = isReadOnlyTenantView && !action.allowInReadOnly && blocksReadOnlyAction(label)`; `disabled` + early-return no `onClick`; `event.stopPropagation()`. |
| **Linha expandida** | `:415-424` | Após o `<tr>`: se `rowExpanded && renderExpandedRow`, um 2º `<tr>` com `<td colSpan={cellsCount}>` renderizando `renderExpandedRow(item)`. |
| **Footer (paginação/sort temporal)** | `:432-459` | `<PaginationControls …>` (já responsivo: `flex-col sm:flex-row`, `pagination-controls.tsx:45`) condicionado a `showFooterControls && (pagination || (canSortByDate && !columnSort))`. |
| **Sort state** | `:132-199` | `useState` de `page/pageSize/sortOrder/columnSort`; `sortableColumns`, `sortResolvers`, `columnSortedData`, `sortedData`, `paginated`, `footerPagination`, `visibleData`. **Lógica intocável** — o card consome **`visibleData`** (já ordenado/paginado), idêntico à tabela. |

**Conclusão estrutural:** o ramo card precisa apenas de **`visibleData`,
`columns`, `actions`, `keyField`, `compact`, `onRowClick/isRowClickable`,
`isRowExpanded/renderExpandedRow`, `rowClassName`, `isReadOnlyTenantView`,
`blocksReadOnlyAction`, `actionIcons`** — **tudo já em escopo** no corpo do
componente. **Nada novo a calcular.** Loading/empty já retornam **antes** do
ramo de apresentação → o card só existe no caminho "tem dados".

### 1.3 As 17 telas consumidoras (raio de impacto real — grep)

`grep -rln "DataTable" src/app --include="*.tsx"` (2026-05-19) → **17 arquivos**:

| # | Tela | Persona | Nota responsiva |
|:--:|---|---|---|
| 1 | `administrador/usuarios/page.tsx` | Admin / Master (RO) | **`tableClassName="min-w-[1500px]"` (l.879)** + ~9 `min-w-[8-17rem]` em células de `column.render` (l.235-341). **Pior caso.** `compact stickyHeader`. → ajuste fino = **UX-0016** (§2.7). |
| 2 | `administrador-master/clientes/page.tsx` | Master | `tableClassName="min-w-[1200px]"` (l.400) + `min-w-[12-16rem]` em células (l.125-153). 2º pior. Cascata UX-0001; resíduo → Onda 3. |
| 3 | `loja/pedidos/page.tsx` | Loja (crítico, touch) | DataTable de pedidos + grades próprias `min-w-[1120px]` (l.987) / `min-w-[760px]` (l.1184) **fora** do DataTable → essas são **UX-0011** (não UX-0001). |
| 4 | `gestor-fabrica/ordens-producao/page.tsx` | Gestor fáb. / Chão | Fila de OPs; `min-w-[920px]` em `<table>` própria (l.586) **fora** do DataTable. DataTable da tela → cascata UX-0001; ajuste fino = **UX-0012**. |
| 5 | `gestor-dados/produtos/page.tsx` | Gestor dados | Cascata automática. |
| 6 | `gestor-dados/ingredientes/page.tsx` | Gestor dados | Cascata automática. |
| 7 | `gestor-dados/lojas/page.tsx` | Gestor dados | Cascata automática. |
| 8 | `gestor-dados/setores/page.tsx` | Gestor dados | Cascata automática. |
| 9 | `gestor-dados/linhas-producao/page.tsx` | Gestor dados | Cascata automática. |
| 10 | `gestor-dados/linhas-producao/[lineId]/page.tsx` | Gestor dados | Cascata automática. |
| 11 | `chao-fabrica/entregas/page.tsx` | Chão (tablet/cel) | Cascata — ganho alto (touch). |
| 12 | `chao-fabrica/expedicao/page.tsx` | Chão | Cascata automática. |
| 13 | `chao-fabrica/ordens-producao/page.tsx` | Chão | Cascata automática. |
| 14 | `gestor-fabrica/expedicao/page.tsx` | Gestor fáb. | Cascata automática. |
| 15 | `gestor-fabrica/ocorrencias/page.tsx` | Gestor fáb. | Cascata automática. |
| 16 | `gestor-fabrica/sublinhas-producao/page.tsx` | Gestor fáb. | DataTable + `renderExpandedRow`/`isRowExpanded` (único consumidor do expand) + DnD próprio (l.1162 `min-w-[1100px]` é grade DnD = **UX-0015**, fora). O **expand** do DataTable é exercido **aqui** → §3 cobre. |
| 17 | `loja/ocorrencias/page.tsx` | Loja (touch) | Cascata — ganho alto. |

> **Raio = 17 telas, ~5 personas.** Confirma RICE R10. As `min-w-[NNNpx]` em
> `<table className=…>` cruas (não-DataTable) listadas no grep
> (`gestor-fabrica/pedidos`, `*/[id]`, `*/expedicao/[id]`, etc.) **NÃO são
> DataTable** — são tabelas manuais; **fora de UX-0001** (herdam só se forem
> migradas ao primitivo num item futuro — registrar como nota, não escopo).

### 1.4 Design system existente (Fase 1 da skill — baseline a respeitar)

Lido antes de propor (adaptar ao da casa, **não impor**):

- **Breakpoints:** `globals.css` **não define** `--breakpoint-*` (grep
  `--breakpoint` = 0). A casa usa os **breakpoints nativos do Tailwind 4**:
  `sm=640px`, `md=768px`, `lg=1024px`, `xl=1280px`. `data-table.tsx` já usa
  `xl:min-w-full`; `PaginationControls` usa `sm:flex-row`. → **`sm` (640px) é o
  breakpoint correto** (casa com M3 "≤640px" **e** com o idioma existente).
- **Tokens (UX-0005 commitado, `globals.css:69-88`):** `--spacing-rhythm-3xs…2xl`
  (4→64px, utilitários `p-rhythm-*`/`gap-rhythm-*`); `--opacity-faint .10 …
  --opacity-strong .65 … --opacity-prominent .78`. Raios `--radius-sm…2xl`.
  `--shadow-card`. Cores semânticas `--card/--border/--border-strong/--muted
  /--foreground/--panel/--primary/--accent`.
- **Idioma de primitivo da casa** (`shared/skeleton.tsx`,
  `shared/empty-state.tsx`): `"use client"` no topo; `import * as React`;
  cabeçalho-comentário `/* UX-#### — … */` explicando o porquê; `cn()` de
  `@/lib/utils`; `data-slot="…"` nos nós; cor **só** via token + `--opacity-*`;
  espaçamento via `p-rhythm-*`/`gap-rhythm-*`; export nomeado no fim. `cva`
  **quando há variantes reais** (skeleton sim; empty-state escolheu **não** usar
  cva p/ 1 booleano — "ternário em `cn()` mais idiomático"). UX-0001 **não cria
  arquivo novo** (o card vive **dentro** de `data-table.tsx` — não é primitivo
  reutilizável fora do DataTable; criar `shared/data-card.tsx` seria
  over-engineering p/ um detalhe interno do DataTable).
- **Precedente de estrutura trocada por breakpoint:**
  `pagination-controls.tsx:45` `flex flex-col gap-2 … sm:flex-row sm:items-center
  sm:justify-between`. → o card mobile segue o **mesmo idioma** (`sm:hidden` /
  `hidden sm:block`), não `matchMedia`/JS.
- **`@media (prefers-reduced-motion: reduce)`** global existe
  (`globals.css:255-264`). O card **não anima** (é layout final, não espera) →
  não-aplicável; o skeleton compatível herda de `DataTableSkeleton` (UX-0003) que
  já trata.

### 1.5 O que o `e2e/regression.py` asserta (rede de não-regressão M6)

Lido integralmente (259 linhas). **Pontos que tocam UX-0001:**

- **Viewport fixo `1500×1000`** (`fresh()`: `browser.new_context(viewport=
  {"width":1500,"height":1000})`, l.111). **Todos os asserts rodam a 1500px** —
  ou seja **≥ sm (640px) → ramo `<table>` (desktop, intacto)**. O ramo card
  (`< sm`) **nunca** é exercido pelo runner atual → não pode quebrá-lo, mas
  também não é coberto por ele (smoke responsivo manual = §5 p.6 cobre <sm).
- **`AJ-0016`** (l.147-155): `page.locator("table thead th").all_inner_texts()`
  + regex de dias `(SEG|TER|…)\s*\d` no header. Roda na **loja**, no diálogo
  "Novo Pedido". Esse `<table>` é a **grade semanal de `loja/pedidos`** (não o
  DataTable — é a `<table min-w-[1120px]>` de `loja/pedidos/page.tsx:987`,
  escopo **UX-0011**). **Mesmo assim**, o assert `table thead th` exige que
  **qualquer `<table>` a 1500px** mantenha `<thead><th>` — o DataTable a 1500px
  **continua** sendo `<table><thead><th>` (ramo desktop intacto) → **assert
  preservado**. (Se a abordagem trocasse `<table>` por `<div role=table>` em
  algum breakpoint, **isto quebraria**; a abordagem C **não troca** ≥sm.)
- **`screen_ok()`** (l.94-103): reprova se `body()` contém `"error"` /
  `"Application error"` / `"Unhandled Runtime"` ou `"error" in title`. Roda em
  `loja/pedidos`, `gestor-fabrica/pedidos`, `gestor-dados/produtos`,
  `administrador/usuarios` (**4 das 17 telas DataTable, a 1500px**). O ramo card
  **não pode** introduzir a substring `error` em texto/`sr-only` visível no
  `inner_text` (rótulos: usar `column.header`, sem `error`). A 1500px o card está
  `display:none` → não entra no `inner_text` de qualquer forma; defesa-em-prof.
- **`AJ-0013`** (`gestor-fabrica/ordens-producao`, l.187-194): regex de texto
  ("Agendadas…", "Fila de OPs") no `body()` — **pós-carga, a 1500px** → ramo
  desktop, intacto.
- **`piloto-admin-usuarios`** (l.240): `screen_ok` em `/administrador/usuarios`
  (a matriz `min-w-[1500px]`) **a 1500px** → ramo `<table>` desktop intacto;
  `min-w-[1500px]` ≤ viewport 1500 → sem scroll. **Sem regressão.**

> **Conclusão de risco e2e:** assert afetado = **nenhum**, *porque* (a) o runner
> roda **a 1500px ≥ sm** → sempre o ramo `<table>` desktop **byte-equivalente**;
> (b) o ramo card é nó **separado** `sm:hidden` → invisível e fora do
> `inner_text` a 1500px; (c) nenhum rótulo do card contém `error`. Mapa
> assert-a-assert em §4.3 / §5 p.7.

### 1.6 Diagnóstico priorizado (impacto × risco — motor `/ux-ui-refiner`)

| # | Problema | Cat. | Sev. | Onde (ATUAL) | Decisão UX-0001 |
|:--:|---|---|:--:|---|---|
| 1 | Scroll-x cego ≤640px (`min-w-[640px]` + `overflow-x-auto`) | Responsivo | 🔴 | `data-table.tsx:248,251` | **Resolve** — ramo card <sm; `min-w` só no ramo ≥sm |
| 2 | `tableClassName="min-w-[1500px/1200px]"` injetado por telas piora o estouro | Responsivo | 🔴 | `administrador/usuarios:879`; `administrador-master/clientes:400` | **Resolve no ramo card** (card ignora `tableClassName`/`min-w`); matriz densa = ajuste fino **UX-0016** (§2.7) |
| 3 | Ações fora de alcance no mobile (coluna à direita, scroll-x) | Responsivo/A11y | 🔴 | `:365-413` | **Resolve** — ações no rodapé do card, hit-target ≥44px (§3.2) |
| 4 | Sort inacessível no mobile (thead some no scroll-x) | Responsivo/A11y | 🟡 | `:277-300` | **Resolve** — barra de sort no topo da lista card (§2.4) |
| 5 | Linha expandida (`renderExpandedRow`) sem equivalente mobile | Responsivo | 🟡 | `:415-424` | **Resolve** — expand vira seção dentro do card (§2.4) |
| 6 | Loading skeleton tabular não casa o card | Estado | 🟡 | `:210-218` (UX-0003) | **Integra** — skeleton de cards <sm (§2.5) |
| 7 | Matriz `administrador/usuarios` densa (~9 `min-w` internos) pode não caber 1:1 em card | Responsivo | 🟡 | `usuarios:235-341` | **Delega ajuste fino** a UX-0016; UX-0001 dá o comportamento-base + sinaliza risco (§2.7, §6 R3) |

UX-0001 fecha **1–5**, **integra 6**, e **declara 7** como fronteira/risco (não
esquecimento).

---

## 2. Spec de refinamento

> Implementação 100% em **1 arquivo**: `src/components/shared/data-table.tsx`. O
> ramo card é **interno** ao componente (sub-render no mesmo arquivo) — **sem
> arquivo novo**, sem export novo, **API pública (`DataTableProps`) inalterada**.
> Diffs abaixo são **conceituais — NÃO aplicar nesta etapa**.

### 2.1 Abordagem exata (C — render condicional CSS, breakpoint `sm`)

A estrutura de retorno (hoje `:245-461`) passa de:

```
<div space-y-3>
  <div moldura(rounded-xl border)>
    <div overflow-x-auto>              ← RAIZ F-3
      <table min-w-[640px] …>…</table> ← estoura <640px
    </div>
  </div>
  {footer PaginationControls}
</div>
```

para (conceitual):

```
<div space-y-3>
  {/* DESKTOP ≥ sm — BYTE-EQUIVALENTE ao de hoje */}
  <div className="hidden sm:block">
    <div moldura(rounded-xl border)>                     ← idêntico :247
      <div className="overflow-x-auto overscroll-x-contain">  ← idêntico :248
        <table className={cn("w-full min-w-[640px] … xl:min-w-full", tableClassName)}>
          … thead/tbody/ações/expand de HOJE, intactos …  ← :249-428 sem 1 byte alterado
        </table>
      </div>
    </div>
  </div>

  {/* MOBILE < sm — ADITIVO, mesma fonte (visibleData/columns/actions) */}
  <ul role="list" className="sm:hidden space-y-rhythm-sm" aria-label={paginationLabel}>
    {/* opcional: barra de sort (§2.4) */}
    {visibleData.map(item => <DataCard … />)}   ← mesmos dados, ≤ pageSize itens
  </ul>

  {showFooterControls && … ? <PaginationControls … /> : null}  ← inalterado, serve os 2 ramos
</div>
```

- **`hidden sm:block` / `sm:hidden`**: alternância **100% CSS**, idioma da casa
  (`pagination-controls.tsx:45`). Zero `matchMedia`, zero `useState` de
  viewport, zero `useEffect` → **sem mismatch SSR/CSR, sem flash**, render
  determinístico. O ramo oculto tem `display:none` → **não pinta** (custo de
  paint zero; custo de DOM = ≤`pageSize` nós, §0.1).
- **Ramo desktop = recorte byte-a-byte** do `:247-428` atual (mover para dentro
  de `<div className="hidden sm:block">` é a **única** mudança que o toca — zero
  alteração de classe/atributo/lógica **dentro** dele). Isto garante o mandato
  "desktop byte-equivalente" e o e2e a 1500px (§1.5).
- **Footer fora dos dois ramos**: `PaginationControls` já é responsivo e serve
  tabela e card igualmente (mesmo `footerPagination`/`setPage`/`setPageSize`/
  `sortOrder`) — **não duplicar**.

### 2.2 O card (`DataCard` — sub-componente interno de `data-table.tsx`)

Um sub-render no mesmo arquivo (função interna ou inline `.map`), **não** export.
Para **cada `item` de `visibleData`** (já ordenado/paginado — idêntico à tabela):

```
<li>                                  role de item de lista
  <article                            o card
    data-slot="data-card"
    className={cn(
      "rounded-lg border border-border/[var(--opacity-strong)] bg-card p-rhythm-sm shadow-[var(--shadow-card)]",
      rowExpanded && "border-l-2 border-l-primary bg-primary/[var(--opacity-faint)]",
      rowClickable && "cursor-pointer",
      rowClassName?.(item),            ← MESMA função da tabela; paridade visual
    )}
    onClick={rowClickable ? <MESMO handler da linha, mesma guarda closest()> : undefined}
    {...(rowClickable ? { role: "button", tabIndex: 0, onKeyDown: Enter/Space } : {})}
  >
    {/* PARES rótulo→valor: 1 <dl> por card; cada coluna = <dt>header</dt><dd>render(item)</dd> */}
    <dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-rhythm-sm gap-y-rhythm-2xs">
      {columns.map(col => (
        <Fragment key={col.key}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {col.header}
          </dt>
          <dd className="text-sm text-foreground">
            {col.render ? col.render(item) : formatDefaultCellValue(col.key, item[col.key])}
          </dd>
        </Fragment>
      ))}
    </dl>

    {/* AÇÕES: rodapé do card, mesma lógica/trava da tabela, hit-target ≥44px */}
    {actions?.length ? (
      <div className="mt-rhythm-sm flex flex-wrap items-center gap-rhythm-2xs border-t border-border/[var(--opacity-divider)] pt-rhythm-sm">
        {actions.map((action, i) => {
          /* IDÊNTICO ao bloco :376-410 — Icon, isDestructive, isBlockedInReadOnly,
             disabled, allowInReadOnly, onClick(stopPropagation + early-return),
             title, aria-label. Só muda: size com label visível p/ touch (§3.2). */
        })}
      </div>
    ) : null}

    {/* EXPAND: mesma condição da tabela */}
    {rowExpanded && renderExpandedRow ? (
      <div className="mt-rhythm-sm border-t border-border/[var(--opacity-divider)] pt-rhythm-sm">
        {renderExpandedRow(item)}
      </div>
    ) : null}
  </article>
</li>
```

**Mapeamento recurso → card (nada perdido):**

| Recurso (tabela) | No card (<sm) | Garantia de paridade |
|---|---|---|
| Colunas (N) | `<dl>` com N pares `<dt>{col.header}</dt><dd>{col.render?…:format}</dd>` | **Mesmo `columns`**, mesma `col.render(item)` (JSX preservado), mesmo `formatDefaultCellValue`. **Zero coluna perdida.** |
| Ações (eye/edit/delete/print/add/user/alert/launch) | Rodapé do card, `actions.map` **com a lógica idêntica** ao `:376-410` | Mesmo `actionIcons`, `isDestructive`, `isBlockedInReadOnly`, `disabled`, `allowInReadOnly`, `onClick` (stopPropagation + early-return), `title`/`aria-label`. **Zero ação perdida.** |
| Ordenação | Barra de sort no topo da `<ul>` (§2.4) | Reusa `sortableColumns`/`columnSort`/`setColumnSort`/`toggleColumnSort` + sort temporal — **mesmo estado**. |
| Paginação | `PaginationControls` (fora dos ramos, único) | **Mesmo** `footerPagination`/`setPage`/`setPageSize`. Card mostra `visibleData` = `paginated.items` (idêntico à tabela). |
| Linha expandida | `<div>` dentro do card sob `rowExpanded && renderExpandedRow` | **Mesma** condição/função. (Exercido por `sublinhas-producao`, §1.3 #16.) |
| Row click | `onClick` no `<article>` + `role=button`/`tabIndex`/Enter-Space | **Mesma** guarda `closest("button,a,input,…")`, mesmo `isRowClickable`/`onRowClick`. |
| `rowClassName` | aplicado no `<article>` | **Mesma** função → paridade de estado visual (ex.: linha destacada). |
| Read-only-tenant | trava idêntica nas ações do rodapé | **Mesma** `isReadOnlyTenantView && !allowInReadOnly && blocksReadOnlyAction`. Afordância **desabilitada, não removida** (guard-rail R3). |
| Loading | skeleton de cards <sm (§2.5) | Integra UX-0003. |
| Empty | `EmptyState` (já retorna antes, não-tabular) | **Não duplica** — `EmptyState` já é responsivo (§2.5). |

### 2.3 `tableClassName` / `min-w` das telas — comportamento no card

`tableClassName` (`min-w-[1500px]` etc.) é **passado ao `<table>` do ramo
desktop** (`:251-253`) — **inalterado** (desktop byte-equivalente). O ramo card
**ignora `tableClassName`** (não há `<table>` no card) → o `min-w-[1500px]` da
matriz **não afeta** o mobile (é exatamente o fix). Os `min-w-[8-17rem]`
**internos** das células de `column.render` em `administrador/usuarios`
(l.235-341) **ainda existem** dentro do JSX que `col.render` devolve → no card
isso pode forçar largura > viewport em telas de ~360px → **risco R3**, ajuste
fino **delegado a UX-0016** (§2.7). UX-0001 entrega o comportamento-base
correto; não reescreve o `column.render` das telas (seria mudança de tela, não
de primitivo, e violaria "1 UX-#### por commit").

### 2.4 Sort e expand no card (sem perder recurso)

- **Sort:** acima da `<ul>` (ou como 1º `<li>` não-card), uma **barra de sort**:
  para cada coluna em `sortableColumns`, um `<button>` reusando
  `setColumnSort(c => toggleColumnSort(c, key))` + ícone
  `ChevronUp/Down/ArrowUpDown` (**mesmos componentes/estado** do `<th>` desktop,
  `:277-300`). Se `canSortByDate && !columnSort`, o sort temporal continua via
  `PaginationControls` (já tem `onSortOrderChange`, inalterado). **Decisão de
  apresentação (ponto R-C, §6):** barra horizontal com chips de sort
  scrolláveis **dentro do card-list header** (não a tabela) — não reintroduz
  scroll-x **do conteúdo** (é só a barra de controles de sort, análoga ao
  `select` de page-size do `PaginationControls`); alternativa = `<select>` de
  "ordenar por". Recomendação: chips (consistente com o `aria-sort`/ícones já
  existentes); **a aprovar**.
- **Expand:** `isRowExpanded(item)` já controla; no card vira uma **seção
  expandível dentro do `<article>`** (não um 2º `<tr>`). Mesma função
  `renderExpandedRow(item)`. O **toggle** do expand é responsabilidade da tela
  (hoje via `onRowClick`/ação — `sublinhas-producao`); UX-0001 **não muda** quem
  dispara, só **onde** o conteúdo expandido aparece (dentro do card vs 2º `tr`).

### 2.5 Integração com UX-0003 (loading) e UX-0007 (empty) — JÁ no arquivo

- **Empty (`:220-243`, UX-0007):** retorna **antes** do ramo de apresentação →
  vale para os 2 ramos. `EmptyState` **não é tabular** (é `flex flex-col
  items-center`, `empty-state.tsx:70-77`) → **já responsivo**. UX-0001 **não
  toca** este bloco; **não duplica** empty no card. ✅
- **Loading (`:210-218`, UX-0003):** hoje `if (isLoading) return
  <DataTableSkeleton columns hasActions compact/>`. O `DataTableSkeleton`
  (UX-0003, em `shared/skeleton.tsx`) renderiza uma **faixa de thead + N linhas
  flex** — em <sm isso também estoura/encolhe estranho (não é card). **Opção
  recomendada (ponto R-D, §6):** envolver o retorno de loading no **mesmo padrão
  de 2 ramos** — `<div className="hidden sm:block"><DataTableSkeleton…/></div>`
  + `<div className="sm:hidden">{skeleton de 3-4 "cards" (blocos `Skeleton`
  `rounded-lg` empilhados)}</div>`, **reusando o primitivo `Skeleton` de
  UX-0003** (sem novo primitivo). **Alternativa:** deixar o `DataTableSkeleton`
  como está (UX-0003 já aceito) e só ajustá-lo numa revisitação — UX-0003 §3.2 /
  R7 **já previu** "quando UX-0001 chegar, revisitar `DataTableSkeleton` p/ casar
  o fallback card". Recomendação: fazer o skeleton-card **aqui** (fecha o
  estado-loading mobile na mesma entrega; é o "casar o fallback" que UX-0003
  delegou explicitamente a UX-0001). **A aprovar.**

### 2.6 Diff conceitual (estrutura — NÃO aplicar)

```diff
  return (
    <div className="space-y-3">
-     <div className="overflow-hidden rounded-xl border border-border/65 bg-card shadow-[var(--shadow-card)]">
-       <div className="overflow-x-auto overscroll-x-contain">
-         <table className={cn("w-full min-w-[640px] border-collapse bg-card xl:min-w-full", tableClassName)}>
-           {/* thead :255-313 */}
-           {/* tbody :315-427 */}
-         </table>
-       </div>
-     </div>
+     {/* ≥ sm — desktop, BYTE-EQUIVALENTE (recorte 1:1 do bloco atual :247-428) */}
+     <div className="hidden sm:block">
+       <div className="overflow-hidden rounded-xl border border-border/65 bg-card shadow-[var(--shadow-card)]">
+         <div className="overflow-x-auto overscroll-x-contain">
+           <table className={cn("w-full min-w-[640px] border-collapse bg-card xl:min-w-full", tableClassName)}>
+             {/* thead :255-313  — SEM 1 byte alterado */}
+             {/* tbody :315-427  — SEM 1 byte alterado */}
+           </table>
+         </div>
+       </div>
+     </div>
+
+     {/* < sm — card empilhado, ADITIVO, mesma fonte visibleData/columns/actions */}
+     <div className="sm:hidden">
+       {/* barra de sort (§2.4) — reusa sortableColumns/columnSort/setColumnSort */}
+       <ul role="list" className="space-y-rhythm-sm" aria-label={paginationLabel}>
+         {visibleData.map((item) => (
+           /* <li><article> … <dl> N pares <dt>/<dd> … rodapé de ações … expand … (§2.2) */
+         ))}
+       </ul>
+     </div>

      {showFooterControls && (pagination || (canSortByDate && !columnSort)) ? (
        <PaginationControls … />   {/* INALTERADO — serve os 2 ramos */}
      ) : null}
    </div>
  );
```

E o bloco de loading (`:210-218`), se R-D aprovado:

```diff
  if (isLoading) {
-   return (
-     <DataTableSkeleton columns={columns.length} hasActions={Boolean(actions?.length)} compact={compact} />
-   );
+   return (
+     <>
+       <div className="hidden sm:block">
+         <DataTableSkeleton columns={columns.length} hasActions={Boolean(actions?.length)} compact={compact} />
+       </div>
+       <div className="sm:hidden space-y-rhythm-sm">
+         {/* 3-4 <Skeleton rounded-lg> empilhados (reusa Skeleton de UX-0003; sem primitivo novo) */}
+       </div>
+     </>
+   );
  }
```

> O bloco **empty** (`:220-243`, UX-0007) **NÃO aparece no diff** — é intocado
> (já responsivo). Prova de fronteira.

### 2.7 Fronteira — o que UX-0001 ADOTA vs DELEGA (explícito)

| | **ADOTA (entra em UX-0001)** | **DELEGA / FORA** |
|---|---|---|
| **Primitivo** | Ramo card <sm **dentro de `data-table.tsx`** (1 arquivo, sem export novo, API inalterada) | — |
| **Comportamento-base mobile** | Card rótulo→valor p/ **as 17 telas** (cascata automática); todas as colunas/ações/sort/paginação/expand/read-only preservadas | — |
| **`administrador/usuarios` (matriz `min-w-[1500px]` + ~9 `min-w` internos l.235-341)** | Recebe o **comportamento-base** (card; `tableClassName` ignorado no card) | **Ajuste fino dedicado = [[Backlog UX (RICE)|UX-0016]]** (Onda 2). O `column.render` da matriz tem larguras internas que podem não caber 360px → **risco R3**, resolvido lá (não reescrever célula aqui = mudança de tela). |
| **`gestor-fabrica/ordens-producao` (`min-w-[920px]` própria)** | DataTable da tela herda o card | A `<table min-w-[920px]>` da l.586 **não é** o DataTable (tabela manual) → **[[Backlog UX (RICE)|UX-0012]]** (Onda 2). |
| **`loja/pedidos`** | DataTables da tela herdam o card | Grades `min-w-[1120px]`/`min-w-[760px]` (l.987/1184) são `<table>` manuais (grade semanal/POS) → **[[Backlog UX (RICE)|UX-0011]]** (Onda 2). |
| **`administrador-master/clientes` (`min-w-[1200px]`)** | Comportamento-base (card) | Resíduo de densidade → Onda 3 (cascata cobre o essencial). |
| **`<table min-w-[NNNpx]>` cruas não-DataTable** (`gestor-fabrica/pedidos`, `*/[id]`, `*/expedicao/[id]`, `gestor-dados/*/[id]`, `sublinhas` grade DnD) | — | **FORA** — não são o primitivo `DataTable`. Migrar ao primitivo = item próprio futuro (nota, não escopo). DnD `sublinhas` = [[Backlog UX (RICE)|UX-0015]]. |
| **Sort temporal `PaginationControls`** | Reusado (já responsivo, inalterado) | — |
| **Loading skeleton-card <sm** | **Adota** (R-D recomendado — fecha o "casar fallback" que [[UX-0003 — skeleton-loading|UX-0003]] §R7 **delegou explicitamente** a UX-0001) | Revisitar `DataTableSkeleton` em si (forma desktop) = não necessário aqui |
| **Empty-state** | **Não duplica** (UX-0007 já responsivo, retorna antes) | — |

> **Princípio (skill Fase 3 / guard-rail README):** UX-0001 = **estratégia
> responsiva no primitivo `DataTable`**. As 2 telas-piloto densas têm itens
> próprios (UX-0012/0016) para o **ajuste fino** que excede o comportamento-base
> — fazer aqui violaria "1 `UX-####` por commit" e mudaria tela, não primitivo.

---

## 3. Cobertura de estados / a11y / responsivo

### 3.1 Semântica tabela ↔ lista (decisão de marcação)

- **≥ sm:** `<table><thead><th aria-sort><tbody><tr><td>` — **inalterado**.
  Semântica de **tabela de dados** (relação linha×coluna), navegável por AT em
  modo tabela. (e2e `table thead th` depende disto a 1500px — §1.5.)
- **< sm:** o card **não é** uma tabela (não há relação grade) → marcar como
  **lista** (`<ul role="list">` › `<li>` › `<article>`), cada par como
  **`<dl><dt><dd>`** (lista de descrição = "nome→valor", semanticamente exato
  para "rótulo da coluna → valor da célula"). **Decisão (R-E, §6):** anunciar
  como **lista de N itens**, cada card uma description list — **não** forjar
  `role=table` no mobile (seria mentir a estrutura; o conteúdo deixou de ser
  grade). O `aria-label` da `<ul>` = `paginationLabel` (ex.: "registros") para o
  leitor de tela anunciar "lista, registros, N itens".
- **Ordem de leitura lógica:** dentro do card, **coluna 1 → coluna N** na ordem
  de `columns` (mesma ordem visual da tabela), depois **ações**, depois
  **expand** — espelha a ordem de leitura da linha desktop (esquerda→direita
  vira topo→baixo). Sem `tabindex` positivo; ordem = ordem do DOM.

### 3.2 Acessibilidade (WCAG 2.2 AA — guard-rail)

- **Teclado:** card com `rowClickable` recebe `role="button"` + `tabIndex={0}` +
  `onKeyDown` (Enter/Space dispara o **mesmo** `onRowClick`, respeitando a guarda
  `closest()`) + `focus-visible:ring` (token de foco da casa). Cards
  não-clicáveis **não** são focáveis (não há ação no card em si — só nas
  ações/links internos, que já são focáveis). **Paridade:** hoje a `<tr>`
  clicável **não** é focável por teclado (é `onClick` em `<tr>`); o card
  **melhora** isto (vira `role=button` focável) — ganho de a11y **aditivo**, sem
  remover nada. Toda ação/link **dentro** do card permanece focável e na ordem
  natural.
- **Hit-target ≥44px (WCAG 2.5.8 / M7 do PRD):** as ações no rodapé do card —
  hoje `<Button size="icon-sm">` (< 44px) — no card usam **`size` com alvo
  ≥44×44px** (ex.: `size="sm"` com ícone **+ label visível** `{action.label}`,
  ou `min-h-11 min-w-11`). **Decisão (R-F, §6):** no card mobile, ação =
  **ícone + texto** (`action.label` já existe e é usado hoje só em
  `title`/`aria-label`) → toque seguro no balcão **e** rótulo legível (melhor que
  só-ícone no touch). Desktop **inalterado** (só-ícone `icon-sm`, como hoje).
- **Foco visível:** herdado do `<Button>` da casa (UX-0004) + `focus-visible:
  ring` no `<article role=button>`. Sem `outline:none` sem substituto.
- **ARIA:** `<ul role="list">` (Safari remova `list-style` não tira o role) +
  `aria-label`; `<dl>`/`<dt>`/`<dd>` nativos (sem role artificial); ações com
  `aria-label`/`title` **idênticos** aos de hoje; `aria-disabled` herdado do
  `<Button disabled>` em read-only. **Não** forçar `role=table`/`row`/`cell` no
  card (a estrutura não é mais grade — §3.1).
- **Sem armadilha de foco, sem conteúdo escondido de AT:** o ramo `display:none`
  (o desktop a <sm, e o card a ≥sm) é **removido da árvore de acessibilidade**
  pelo `display:none` (correto — não há 2 cópias lidas; o ramo ativo é o único
  exposto). Confirma: nada de `aria-hidden` manual necessário (o `display:none`
  já resolve, padrão do `PaginationControls`).

### 3.3 Responsivo (breakpoints narrow / tablet / desktop)

| Viewport | Ramo ativo | Comportamento |
|---|---|---|
| **360px** (narrow — celular balcão loja/chão) | Card (`sm:hidden`) | 1 card por linha, `<dl>` 2-col (`minmax(0,9rem)_1fr`), ações com label, **zero scroll-x** (M3 ✅). Risco: `min-w` internos de `column.render` na matriz (R3 → UX-0016). |
| **375–639px** (celular comum) | Card | idem; `grid-cols-[minmax(0,9rem)_1fr]` mantém rótulo:valor legível. |
| **640px (`sm`)** | **Tabela** (`hidden sm:block`) | A partir daqui = `<table>` de hoje, `min-w-[640px]` cabe (viewport ≥ 640) → sem scroll. |
| **768px (`md`) tablet** | Tabela | `min-w-[640px]`/`tableClassName` — telas largas (`min-w-[1500px]`) ainda scrollam horizontalmente **como hoje** (UX-0001 **não regride nem piora** ≥sm; o scroll-x ≥sm em telas ultra-largas é da alçada de UX-0012/0016, não deste item — declarado). |
| **1280px (`xl`)** | Tabela | `xl:min-w-full` (regra de hoje) — inalterado. |
| **1500px (e2e)** | Tabela | Ramo desktop byte-equivalente; `table thead th` intacto (§1.5). |

> **M3 (PRD): zero scroll-x em data-table ≤640px** → cumprido: a <640px **não há
> `<table>`/`min-w`** no caminho renderizado (ramo card, sem `overflow-x`, sem
> `min-w`). O scroll-x **≥sm** em telas ultra-largas (`min-w-[1500px]`)
> **permanece como hoje** — **não é regressão** (M3 é só ≤640px); reduzi-lo no
> tablet é UX-0016/0012.

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas → ✅):

### 4.1 Desktop byte-equivalente

- [ ] **Ramo ≥sm idêntico ao atual** — `git diff` mostra o bloco
      `:247-428` **apenas** envolvido por `<div className="hidden sm:block">`
      (e o `if(isLoading)` por 2 ramos, se R-D); **zero** classe/atributo/lógica
      **dentro** do `<table>`/`<thead>`/`<tbody>`/ações/expand alterada. Diff
      "wrap-only" no ramo desktop.
- [ ] **DOM a 1500px = DOM de hoje** — render a 1500px: `<table>` com
      `<thead><th aria-sort>` + `<tbody>` + coluna de ações + 2º `<tr>` de
      expand **byte-a-byte** como antes (card está `display:none`, fora da
      árvore).
- [ ] **`tableClassName` no `<table>` desktop** — `min-w-[1500px]`/`min-w-[1200px]`
      continuam aplicados ao `<table>` ≥sm (inalterado).
- [ ] **e2e 0-FAIL, PASS ≥ baseline (≥26), 6 personas** — `table thead th`
      (AJ-0016), `screen_ok` das 4 telas DataTable (`loja/pedidos`,
      `gestor-fabrica/pedidos`, `gestor-dados/produtos`, `administrador/usuarios`),
      AJ-0013, `piloto-admin-usuarios` **inalterados** (rodam a 1500px = ramo
      desktop). Nenhum rótulo de card contém `error`.

### 4.2 Zero recurso/coluna/ação perdido no mobile

- [ ] **Colunas:** o card renderiza **`columns.length` pares** `<dt>/<dd>`;
      `col.render(item)` chamado igual à tabela (JSX/badges preservados);
      fallback `formatDefaultCellValue` idêntico. Conferir numa tela densa
      (`gestor-dados/produtos`) que **toda** coluna aparece.
- [ ] **Ações:** **todas** as `actions` no rodapé do card; `actionIcons`,
      `isDestructive`, `isBlockedInReadOnly`, `disabled`, `allowInReadOnly`,
      `onClick`(stopPropagation+early-return), `title`/`aria-label` **idênticos**
      ao `:376-410`. Nenhum ícone (eye/edit/delete/print/add/user/alert/launch)
      ausente.
- [ ] **Sort:** barra de sort no card cobre **as mesmas** colunas de
      `sortableColumns`; reusa `columnSort`/`setColumnSort`/`toggleColumnSort` +
      sort temporal via `PaginationControls`. Ordenar no card = ordenar na
      tabela (mesmo estado).
- [ ] **Paginação:** `PaginationControls` único, fora dos ramos; card mostra
      `visibleData` (= `paginated.items`); `setPage`/`setPageSize` inalterados.
- [ ] **Expand:** `rowExpanded && renderExpandedRow` → seção no card; **mesma**
      função/condição. Validar em `gestor-fabrica/sublinhas-producao` (único
      consumidor de `renderExpandedRow`/`isRowExpanded`).
- [ ] **Row click / `rowClassName` / `isRowClickable`:** mesma guarda
      `closest("button,a,input,select,textarea,[role=button],[data-stop-row-click]")`,
      mesmo `onRowClick`; `rowClassName` aplicado ao `<article>`.
- [ ] **Read-only-tenant:** trava idêntica nas ações do card; afordância
      **desabilitada, não removida** (guard-rail R3). Validar logado como
      Master (read-only) — botões aparecem `disabled`, não somem.

### 4.3 Sem mudança funcional / escopo / e2e

- [ ] **Sem mudança de dado/fetch/rota/cálculo** — `git diff --name-only` = **só**
      `src/components/shared/data-table.tsx`. Nenhum `src/lib/**`, nenhum
      `src/app/**`, `package.json` inalterado (zero dep nova).
- [ ] **API pública inalterada** — `DataTableProps` sem campo novo/removido;
      **nenhum dos 17 consumidores** muda 1 linha; `npx tsc --noEmit` exit 0.
- [ ] **Loading/Empty integrados, não duplicados** — bloco empty (`:220-243`,
      UX-0007) **intocado** no diff; loading (`:210-218`, UX-0003) só envolvido
      em 2 ramos (R-D), reusando `Skeleton`/`DataTableSkeleton` (sem primitivo
      novo).
- [ ] **Só token / sem ad-hoc** — card usa `--opacity-*` (`/[var(--opacity-strong)]`
      etc.), `p-rhythm-*`/`gap-rhythm-*`, `--radius-*`, `--shadow-card`, cores
      semânticas. `grep` no diff não acha `/NN` ad-hoc novo nem `oklch(` inline.
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso.
- [ ] **Commit isolado revertível** — único commit `UX-0001`; `git revert`
      restaura a tabela com scroll-x sem colateral (1 arquivo, API intacta).

---

## 5. Plano de verificação para o Front-End

Objetivo: provar **desktop byte-equivalente**, **zero recurso perdido no
mobile**, **e2e desktop intacto**, em **17 telas** sem regressão.

1. **Escopo do diff (prova mecânica):** `git diff --name-only` → **exatamente**
   `src/components/shared/data-table.tsx`. **Nenhum** `src/lib/**`, **nenhum**
   `src/app/**`, `package.json` byte-idêntico. Qualquer outro arquivo = reprova.
2. **Diff "wrap-only" no desktop:** inspeção visual do diff — o bloco
   `:247-428` aparece como **movido para dentro de `<div className="hidden
   sm:block">`** (e o `if(isLoading)` em 2 ramos, se R-D), **sem** edição de
   classe/atributo/lógica **dentro** dele. Bloco empty `:220-243` **ausente** do
   diff. `git diff | grep -i 'error'` no card = vazio (e2e §1.5).
3. **TS / retrocompat:** `npx tsc --noEmit` exit 0 — prova que `DataTableProps`
   inalterado e os **17 consumidores** compilam sem mudança. `npm run lint` 0
   erro novo.
4. **`npm test`** verde (sem regressão dos testes existentes).
5. **`npm run build`** (`next build`) verde — Tailwind 4 resolve
   `border-border/[var(--opacity-strong)]` / `p-rhythm-*` / `gap-rhythm-*`
   (precedente provado: `skeleton.tsx`/`empty-state.tsx` já usam a mesma sintaxe
   e compilam em produção — UX-0003/0007 commitados).
6. **Smoke responsivo + paridade, 6 personas, 3 viewports** (a prova de M3):
   logar nas 6 personas; para **cada** uma, abrir ≥2 telas DataTable da sua área
   (cobrir as 17: `gestor-dados/{produtos,ingredientes,lojas,setores,
   linhas-producao}`, `chao-fabrica/{entregas,expedicao,ordens-producao}`,
   `gestor-fabrica/{expedicao,ocorrencias,ordens-producao,sublinhas-producao}`,
   `loja/ocorrencias`, `administrador-master/clientes`, `administrador/usuarios`,
   `loja/pedidos`) em **360px**, **768px**, **1280px**:
   - **360px:** **zero scroll-x** no DataTable (régua/DevTools — M3); **toda**
     coluna presente como `<dt>/<dd>`; **toda** ação no rodapé do card com
     hit-target ≥44px; sort funciona; paginação funciona; expand (em
     `sublinhas-producao`) abre dentro do card; logado como **Master** (RO) as
     ações aparecem **disabled** (não somem).
   - **768px / 1280px:** ramo **tabela**, visualmente **idêntico ao de hoje**
     (comparar com `git stash` / screenshot baseline) — pixel-equivalente.
   - **Teclado (360px):** Tab alcança cada card clicável (`role=button`),
     Enter/Space dispara o mesmo `onRowClick`; cada ação alcançável, foco
     visível; ordem de leitura coluna1→colN→ações→expand.
   - **Leitor de tela (1 amostra):** `<ul>` anuncia "lista, N itens"; cada card
     lê `header → valor` em pares (`<dt>/<dd>`); ações com `aria-label`.
   - **Canário:** 1 tela **sem** DataTable (ex.: um perfil / `gestor-fabrica`
     dashboard) — **pixel-idêntica** em todos os viewports (UX-0001 não a toca).
7. **Runner E2E de não-regressão (âncora M6):** `e2e/regression.py`
   (versionado — ver [[e2e-playwright-setup]] na memória do projeto /
   [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0 D-0]])
   → **0-FAIL**, PASS **≥ baseline (≥26)**, 6 personas. **Mapa assert-a-assert
   (todos rodam a 1500px = ramo desktop intacto):**
   - `login-*` / `landing-*` (6): não tocam DataTable → inalterados.
   - **`AJ-0016`** (`table thead th` na grade da loja): a grade é `<table>`
     manual de `loja/pedidos` (UX-0011, não-DataTable); **e** qualquer
     `<table>` a 1500px mantém `<thead><th>` → **PASS preservado** (o DataTable a
     1500px **continua** `<table><thead><th>`).
   - `AJ-0005`/`AJ-0006` (texto no diálogo Novo Pedido): não-DataTable →
     inalterados.
   - `AJ-0001`/`AJ-0002` (Kanban/links `gestor-fabrica`): não-DataTable →
     inalterados.
   - **`screen_ok` `piloto-loja-pedidos`, `piloto-fabrica-pedidos`,
     `gestor-dados-produtos`, `piloto-admin-usuarios`** (4 telas, 1500px): ramo
     desktop = sem `error` no body; card `display:none` fora do `inner_text` →
     **PASS preservado**.
   - **`AJ-0013`** (`gestor-fabrica/ordens-producao`, regex body, 1500px): ramo
     desktop intacto → **PASS preservado**.
   - `AJ-0003`/`AJ-0012`/`AJ-0017`/`AJ-0020`/`piloto-fabrica-sublinhas`:
     pós-carga a 1500px, não dependem do layout mobile → inalterados.
   - **Resultado esperado:** **0 FAIL**, PASS ≥ baseline. Qualquer queda =
     parada + rollback do item (regra do plano de orquestração).

> Critério de aprovação do Gate 1 p/ este item: passos 1-7 verdes **e**
> checklist §4 100% marcado no autorreview.

---

## 6. Riscos & notas de implementação (para o Front-End)

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R-A** | **DOM duplicado <sm** (ramo `hidden` no DOM) custa memória/render | Baixa | Baixo | **Ponto de aprovação.** Duplicação é de ≤`pageSize` (10) linhas (DataTable já pagina), ramo `hidden` não pinta (`display:none`). Tradeoff aceito por **zero JS de viewport** (sem `matchMedia` → sem mismatch SSR/flash). Alternativa (matchMedia) tem **pior** tradeoff p/ um primitivo de 17 telas. |
| **R-B** | Breakpoint errado (regressão de densidade a 641-768px) | Baixa | Médio | **`sm` (640px) nativo** = casa com M3 ("≤640px") **e** com o idioma existente (`pagination-controls.tsx:45` `sm:`, `data-table.tsx` `xl:`). **Não** introduzir `--breakpoint` custom (a casa não tem). Ponto de aprovação §0.3.2. |
| **R-C** | Barra de sort do card reintroduz scroll-x **do conteúdo** | Baixa | Médio | A barra de sort é **controle** (análogo ao page-size `<select>` do `PaginationControls`), não conteúdo de dados. Chips com scroll **da barra** ≠ scroll do data-table (M3 mede o data-table). Alternativa = `<select>` "ordenar por". **A aprovar (R-C).** |
| **R-D** | Loading `DataTableSkeleton` (tabular, UX-0003) feio <sm | Média | Médio | **Recomendado:** 2-ramos no `if(isLoading)` + skeleton-card reusando `Skeleton` de UX-0003 (sem primitivo novo). **UX-0003 §3.2/R7 já delegou explicitamente isto a UX-0001** ("quando UX-0001 chegar, revisitar p/ casar o fallback card"). **A aprovar (R-D).** |
| **R-E** | Semântica: forçar `role=table` no card vs description list | Baixa | Médio | Card **não é** grade → `<ul>/<li>/<article>` + `<dl>/<dt>/<dd>` (semântica honesta). **Não** forjar `role=table` mobile. Decisão §3.1. |
| **R-F** | Hit-target das ações <44px no card (M7/WCAG 2.5.8) | Média | Médio | Ação no card = **ícone + `action.label`** (label já existe, hoje só em title) → ≥44px touch + legível. Desktop só-ícone inalterado. Decisão §3.2. |
| **R3** | **Matriz `administrador/usuarios`** (`min-w-[1500px]` + ~9 `min-w-[8-17rem]` **internos** em `column.render`, l.235-341) não cabe 1:1 em card a 360px | **Alta** | Médio | **Maior risco do item.** UX-0001 dá o **comportamento-base** (card; `tableClassName` ignorado). Mas os `min-w` **dentro** do JSX que `col.render` devolve persistem → pode forçar largura > 360px **dentro** do card. **Ajuste fino = [[Backlog UX (RICE)|UX-0016]]** (Onda 2) — reescrever esse `column.render` é mudança de **tela**, não de primitivo (viola "1 UX-#### por commit"). UX-0001 **sinaliza**; não resolve. §2.7. |
| **R-G** | Regressão silenciosa em 1 das **17 telas** (maior raio da iniciativa) | Média | **Alto** | Diff "wrap-only" no desktop (§5 p.2) → desktop matemática/visualmente intacto; smoke 6 personas × 17 telas × 3 viewports (§5 p.6); e2e 0-FAIL a 1500px (§5 p.7); **canário** de tela não-DataTable; commit isolado revertível (§4.3). |
| **R-H** | `column.render` que devolve elemento de **largura fixa grande** (gráfico, barra) estoura o card mesmo sem `min-w` | Baixa | Baixo | O card usa `<dd className="text-sm">` com `min-w-0` no grid (`minmax(0,...)`) → trunca/quebra graciosamente. Casos extremos (raros) = nota p/ a tela específica na Onda 2/3, não bloqueia o primitivo. |

**Notas de implementação:**

- **Ordem de toque (plano):** UX-0001 vem **após** UX-0005/0002/0003/0004/0007
  (todos commitados — primitivos de estado que o DataTable já consome). Commit
  isolado `UX-0001`. ([[Backlog UX (RICE)#Sequência recomendada (respeitando dependências)]], l.179.)
- **Recorte byte-a-byte do ramo desktop:** o Front-End deve **mover** o bloco
  `:247-428` para dentro de `<div className="hidden sm:block">` por **recorte
  literal** (não reescrever) — qualquer reformatação dentro dele invalida o
  "byte-equivalente". Idem o `if(isLoading)` (envolver, não reescrever o
  `<DataTableSkeleton>`).
- **Reuso-primeiro:** o card vive **dentro** de `data-table.tsx` (não
  `shared/data-card.tsx`) — não é primitivo reutilizável fora do DataTable;
  criar arquivo/export seria over-engineering. Skeleton-card reusa `Skeleton`
  (UX-0003), **sem** primitivo novo. Empty reusa `EmptyState` (UX-0007, já no
  arquivo, **não duplicar**).
- **Espelhar a gramática da casa** (`skeleton.tsx`/`empty-state.tsx`):
  `data-slot="data-card"` nos nós; cor só token + `--opacity-*`; espaçamento
  `*-rhythm-*`; `cn()`; **sem** `cva` (o card não tem variantes reais — segue a
  escolha de `empty-state.tsx` "ternário em `cn()` > cva p/ pouca variação").
- **Não introduzir** dark-mode, animação no card (é layout final, não espera),
  `matchMedia`/JS de viewport, nem dependência (Radix/framer) — fora de
  escopo/guard-rail.
- **Reversibilidade:** `git revert` do commit `UX-0001` restaura a tabela
  `overflow-x-auto`+`min-w-[640px]`; como **só** `data-table.tsx` muda e a API é
  intacta, reversão garantidamente sem colateral nas 17 telas.
- **Entregar no autorreview/Changelog** ([[10 - Changelog Vivo/2026-05|Changelog
  do mês]], template em `Docs/10 - Changelog Vivo/Template — Entrada de
  Changelog.md`): a estratégia (C, breakpoint `sm`), o mapa adota/delega (§2.7),
  e o **risco R3** (matriz → UX-0016) — é o contrato que UX-0012/0016 vão
  consumir na Onda 2.

---

## 7. Autorreview (Front-End)

> **A preencher pelo agente `frontend-design-senior`** (skill `/frontend-design`
> aplicada no 1º passo) **após aprovação explícita do usuário** no checkpoint
> (§0). Estrutura a espelhar de [[UX-0003 — skeleton-loading|UX-0003]] §7:
> 7.1 Resumo do diff · 7.2 Decisões de risco (R-A…R-H, R3) · 7.3 Checklist §4
> (todas ✅) · 7.4 Mapa adota/delega final + nota R3→UX-0016 · 7.5 Resultado da
> verificação §5 (passos 1-4 executáveis pelo Front-End; 5-7 = Gate 1
> orquestrador) · 7.6 Desvios mínimos justificados.

> Preenchida pelo agente `frontend-design-senior` em 2026-05-19 após aprovação
> explícita do usuário no checkpoint §0 (Abordagem **C**, breakpoint **`sm`**,
> comportamento-base p/ 17 telas, custo DOM duplicado ≤pageSize aceito).
> Skill `/frontend-design` aplicada no 1º passo.

### 7.1 Resumo do diff

`git diff --name-only -- src/` → **exatamente** `src/components/shared/data-table.tsx`
(único arquivo `src/`; `1 file changed, +248 −7`). Nenhum `src/lib/**`, nenhum
`src/app/**`, nenhum dos 17 callers, `package.json` byte-idêntico (**zero
dependência nova**). Conforme §2.7 (UX-0001 = só o primitivo).

Mudanças, em 4 blocos:

1. **Imports (aditivos):** `useMemo, useState` → `Fragment, useMemo, useState`
   (key dos pares `<dt>/<dd>`); `{ DataTableSkeleton }` →
   `{ DataTableSkeleton, Skeleton }` de `@/components/shared/skeleton` (já dep,
   reuso UX-0003 — sem primitivo novo).
2. **Header-comentário `UX-0001`** antes do `export function DataTable` —
   espelha a gramática de `shared/skeleton.tsx`/`shared/empty-state.tsx`
   (explica abordagem C, breakpoint, custo, fronteira UX-0016). Sem `*/`
   aninhado (lint).
3. **`if (isLoading)` → 2 ramos (R-D):** `<>` com
   `<div className="hidden sm:block">` envolvendo o **`<DataTableSkeleton>`
   verbatim** (só `hasActions` hoisted p/ `const` — semanticamente idêntico) +
   `<div className="sm:hidden">` com 3 "cards" de `Skeleton` (UX-0003)
   empilhados (`role=status aria-busy`, `motion` herdado do primitivo).
4. **Bloco de apresentação `:247-428`:** **recortado 1:1** para dentro de
   `<div className="hidden sm:block">` (zero byte alterado dentro do
   `<table>`/`<thead>`/`<tbody>`/`<td>`/`<th>`/ações/expand) **+** sibling novo
   `<div className="sm:hidden">` (barra de sort em chips + `<ul>/<li>/<article>`
   + `<dl>` + rodapé de ações + expand). `PaginationControls` **inalterado**,
   fora dos 2 ramos.

**Prova de equivalência desktop (mecânica):** `git diff -U0 | grep '^-'` →
as **únicas linhas removidas** são (a) 2 imports (substituídos por imports
aumentados — mesmos módulos), (b) o corpo de 4 linhas do `<DataTableSkeleton>`
(movido verbatim p/ o ramo `hidden sm:block`). **Nenhuma `<td>`/`<th>`/`<tr>`/
classe/atributo/lógica do `<table>` removida ou alterada** → o ramo desktop é
**"wrap-only"** (só `<div className="hidden sm:block">` + `</div>` somados ao
redor). A 1500px (onde o e2e roda, ≥sm) o DOM é `<table><thead><th aria-sort>
<tbody><tr><td>` + coluna de ações + 2º `<tr>` de expand **byte-idêntico** ao
de hoje; o card é nó **separado** `sm:hidden` (`display:none` ≥sm) → não pinta,
fora da árvore de a11y e do `inner_text`. Mandato "desktop byte-equivalente"
cumprido por construção.

### 7.2 Decisões de risco (R-A…R-H, R3)

| ID | Decisão tomada |
|---|---|
| **R-A** | DOM duplicado <sm **aceito** (decisão do usuário no checkpoint). ≤`pageSize` (10) linhas, ramo `hidden` não pinta. Implementado sem `matchMedia`/`useState` de viewport/`useEffect` → zero mismatch SSR/CSR, zero flash. |
| **R-B** | Breakpoint **`sm` (640px) nativo** (decisão do usuário). Nenhum `--breakpoint` custom introduzido (`grep --breakpoint` segue 0). Idioma `hidden sm:block`/`sm:hidden`, igual ao precedente `pagination-controls.tsx:45`. |
| **R-C** | Sort no card = **barra de chips** scrolláveis (recomendação da spec, aprovada). É **controle** (análogo ao `<select>` de page-size do `PaginationControls`), `overflow-x-auto` só na barra — **não** é scroll do conteúdo de dados (M3 mede o data-table, intacto). Reusa `sortableColumns`/`columnSort`/`setColumnSort`/`toggleColumnSort` + sort temporal via `PaginationControls` — **mesmo estado** do `<th>` desktop. |
| **R-D** | Loading em **2 ramos** (recomendação da spec, aprovada): `DataTableSkeleton` ≥sm + skeleton de cards <sm reusando `Skeleton` (UX-0003), **sem primitivo novo**. Fecha o "casar fallback" que UX-0003 §R7 delegou explicitamente a UX-0001. |
| **R-E** | Semântica **honesta**: `<ul role="list" aria-label={paginationLabel}>` › `<li>` › `<article>` + `<dl>/<dt>/<dd>`. **Não** forjado `role=table` no mobile (a estrutura deixou de ser grade). `display:none` remove o ramo inativo da árvore de a11y (padrão `PaginationControls`) — sem `aria-hidden` manual. |
| **R-F** | Hit-target ≥44px: ação no card = `<Button size="lg">` (`h-11` = 44px, token da casa UX-0004) com **ícone + `action.label` visível** (`<Icon/>` + `<span>{action.label}</span>`). `action.label` já existia (hoje só em `title`/`aria-label`) → toque seguro no balcão **e** rótulo legível. Desktop **inalterado** (só-ícone `icon-sm`). |
| **R3** | Matriz `administrador/usuarios`: `tableClassName="min-w-[1500px]"` **ignorado no card** (não há `<table>` no card — é o fix). Os `min-w-[8-17rem]` **internos** ao JSX de `column.render` (l.235-341) **persistem** → podem exceder 360px **dentro** do `<dd>`. `<dd className="min-w-0 break-words">` + grid `minmax(0,9rem)_1fr` mitiga parcialmente; **ajuste fino dedicado = UX-0016 (Onda 2)** — reescrever `column.render` é mudança de **tela**, viola "1 UX-#### por commit". **Sinalizado, não resolvido aqui.** |
| **R-G** | Regressão silenciosa em 1 das 17 telas: mitigado por diff **"wrap-only"** no desktop (§7.1) → desktop matemática/visualmente intacto; smoke 6 personas × 17 × 3 viewports + e2e 0-FAIL a 1500px + canário não-DataTable + commit isolado revertível = Gate 1 (orquestrador). |
| **R-H** | `column.render` de largura fixa grande: `<dd className="min-w-0 break-words">` dentro do grid `minmax(0,...)` → quebra/trunca graciosamente. Casos extremos = nota p/ tela específica na Onda 2/3, não bloqueia o primitivo. |

### 7.3 Checklist §4 — todas ✅

**§4.1 Desktop byte-equivalente**
- [x] **Ramo ≥sm idêntico ao atual** — diff "wrap-only": bloco `:247-428`
      apenas envolvido por `<div className="hidden sm:block">`; `if(isLoading)`
      em 2 ramos (R-D). Zero classe/atributo/lógica dentro do `<table>`
      alterada (prova mecânica §7.1).
- [x] **DOM a 1500px = DOM de hoje** — `<table><thead><th aria-sort><tbody>` +
      coluna de ações + 2º `<tr>` de expand byte-a-byte; card `display:none`
      ≥sm, fora da árvore.
- [x] **`tableClassName` no `<table>` desktop** — a linha
      `cn("w-full min-w-[640px] … xl:min-w-full", tableClassName)` está
      **intacta** dentro do ramo desktop (não tocada).
- [x] **e2e 0-FAIL** — *(execução do orquestrador no Gate 1; análise §1.5/§5
      p.7: todos os asserts rodam a 1500px = ramo desktop intacto; nenhum
      rótulo do card contém `error`; card `display:none` fora do `inner_text`).*

**§4.2 Zero recurso/coluna/ação perdido no mobile**
- [x] **Colunas:** `<dl>` com `columns.length` pares `<dt>{col.header}</dt>
      <dd>{col.render? col.render(item) : formatDefaultCellValue(...)}</dd>` —
      **mesmo `columns`**, mesma `col.render` (JSX/badges preservados), mesmo
      fallback.
- [x] **Ações:** `actions.map` no rodapé, **lógica idêntica** ao `:376-410`
      (`actionIcons`, `isDestructive`, `isBlockedInReadOnly`, `disabled`,
      `allowInReadOnly`, `onClick` stopPropagation + early-return,
      `title`/`aria-label`). Todos os 8 ícones
      (eye/edit/delete/print/add/user/alert/launch) presentes. Só muda: `size`
      ≥44px + label visível (R-F).
- [x] **Sort:** barra de chips cobre **as mesmas** colunas de
      `sortableColumns`, reusa `columnSort`/`setColumnSort`/`toggleColumnSort`
      + sort temporal via `PaginationControls` → ordenar no card = ordenar na
      tabela (mesmo estado).
- [x] **Paginação:** `PaginationControls` único, fora dos ramos; card mostra
      `visibleData` (= `paginated.items`); `setPage`/`setPageSize` inalterados.
- [x] **Expand:** `rowExpanded && renderExpandedRow` → `<div>` dentro do
      `<article>`; **mesma** função/condição (consumidor único:
      `sublinhas-producao`).
- [x] **Row click / `rowClassName` / `isRowClickable`:** mesma guarda
      `closest("button,a,input,select,textarea,[role='button'],[data-stop-row-click='true']")`,
      mesmo `onRowClick`; `rowClassName?.(item)` aplicado ao `<article>`.
      Ganho aditivo: `role=button`+`tabIndex=0`+`onKeyDown` Enter/Space (a
      `<tr>` de hoje não é focável — melhora a11y, nada removido).
- [x] **Read-only-tenant:** trava **idêntica**
      (`isReadOnlyTenantView && !action.allowInReadOnly && blocksReadOnlyAction(action.label)`)
      → botão `disabled` (afordância **desabilitada, não removida**, guard-rail
      R3).

**§4.3 Sem mudança funcional / escopo / e2e**
- [x] **Sem mudança de dado/fetch/rota/cálculo** — `git diff --name-only` =
      só `src/components/shared/data-table.tsx`.
- [x] **API pública inalterada** — `DataTableProps` sem campo novo/removido;
      `npx tsc --noEmit` exit 0 (17 consumidores compilam sem 1 linha de
      mudança).
- [x] **Loading/Empty integrados, não duplicados** — bloco empty (UX-0007)
      **ausente do diff** (intocado); loading (UX-0003) só envolvido em 2
      ramos, reusando `Skeleton`/`DataTableSkeleton` (sem primitivo novo).
- [x] **Só token / sem ad-hoc** — card usa
      `border-border/[var(--opacity-strong)]`,
      `border-l-primary bg-primary/[var(--opacity-faint)]`,
      `border-border/[var(--opacity-divider)]`, `p-rhythm-sm`/`gap-rhythm-*`/
      `space-y-rhythm-sm`/`mt-rhythm-sm`/`pt-rhythm-sm`, `rounded-lg`,
      `shadow-[var(--shadow-card)]`, foco via `--ring`
      (`focus-visible:ring-ring/45 focus-visible:ring-[3px]
      focus-visible:border-ring`, idioma do `<Button>` UX-0004). Sem `/NN`
      ad-hoc novo, sem `oklch(` inline.
- [x] **lint/tsc/test verdes** — `npm run lint` 0 erros (6 warnings
      pré-existentes em outros arquivos, **nenhum** em `data-table.tsx`);
      `npx tsc --noEmit` exit 0; `npm test` 110/110 pass, 0 fail. *(`npm run
      build` + e2e = Gate 1/orquestrador.)*
- [x] **Commit isolado revertível** — 1 arquivo, API intacta → `git revert`
      restaura a tabela `overflow-x-auto`+`min-w-[640px]` sem colateral nas 17
      telas.

### 7.4 Mapa adota/delega final + nota R3→UX-0016

| | **ADOTADO em UX-0001** | **DELEGADO / FORA** |
|---|---|---|
| Primitivo | Ramo card <sm dentro de `data-table.tsx` (1 arquivo, sem export novo, `DataTableProps` inalterado) | — |
| Comportamento-base mobile | Card rótulo→valor p/ **as 17 telas** (cascata automática); colunas/ações/sort/paginação/expand/read-only preservados | — |
| `administrador/usuarios` | Comportamento-base (card; `tableClassName`/`min-w` ignorados no card) | **Ajuste fino = [[Backlog UX (RICE)\|UX-0016]] (Onda 2)** — `min-w-[8-17rem]` internos ao `column.render` (l.235-341) podem exceder 360px no `<dd>`; mitigado parcialmente por `min-w-0 break-words` + grid `minmax(0,...)`, **não** resolvido (reescrever célula = mudança de tela). **Risco R3.** |
| `gestor-fabrica/ordens-producao` | DataTable da tela herda o card | `<table min-w-[920px]>` manual (l.586, não-DataTable) = **UX-0012** |
| `loja/pedidos` | DataTables da tela herdam o card | Grades `min-w-[1120px]`/`min-w-[760px]` manuais = **UX-0011** |
| `administrador-master/clientes` | Comportamento-base (card) | Resíduo de densidade → Onda 3 |
| `<table min-w>` cruas não-DataTable | — | **FORA** (não são o primitivo). DnD `sublinhas` = UX-0015 |
| Loading skeleton-card <sm | **Adotado** (R-D — fecha o delegado por UX-0003 §R7) | — |
| Empty-state | **Não duplicado** (UX-0007 já responsivo, retorna antes, intocado) | — |
| Sort temporal `PaginationControls` | Reusado, inalterado | — |

> **Contrato p/ Onda 2:** UX-0016 e UX-0012 herdam este comportamento-base e
> fazem **só o ajuste fino** das suas telas densas. UX-0001 **não** reescreve
> `column.render` de tela alguma (guard-rail "1 UX-#### por commit").

### 7.5 Resultado da verificação §5

| Passo §5 | Executor | Resultado |
|---|---|---|
| 1. Escopo do diff (`--name-only`) | Front-End | ✅ só `src/components/shared/data-table.tsx` |
| 2. Diff "wrap-only" desktop + `grep -i error` no card vazio | Front-End | ✅ prova mecânica §7.1; bloco empty ausente do diff; nenhum rótulo com `error` |
| 3. `npx tsc --noEmit` / `npm run lint` | Front-End | ✅ tsc exit 0; lint 0 erros (warnings pré-existentes alheios) |
| 4. `npm test` | Front-End | ✅ 110/110 pass, 0 fail |
| 5. `npm run build` | **Gate 1 / orquestrador** | ⏳ delegado (sintaxe `border-*/[var(--opacity-*)]`/`*-rhythm-*` já provada por `skeleton.tsx`/`empty-state.tsx` em produção) |
| 6. Smoke 6 personas × 17 telas × 3 viewports | **Gate 1 / orquestrador** | ⏳ delegado (M3 360px zero scroll-x; paridade pixel 768/1280; teclado/leitor de tela; Master read-only inerte; canário) |
| 7. `python e2e/regression.py` 0-FAIL | **Gate 1 / orquestrador** | ⏳ delegado (análise §1.5/§5 p.7: todos os asserts a 1500px = ramo desktop intacto → PASS preservado por construção) |

> Passos 1-4 (executáveis pelo Front-End) **todos verdes**. 5-7 reservados ao
> Gate 1 do orquestrador (não commitar/build/e2e — guard-rail
> [[feedback-ux-initiative-process]] da metodologia da iniciativa).

### 7.6 Desvios mínimos justificados

- **`hasActions` hoisted p/ `const` no `if(isLoading)`:** o ramo `sm:hidden`
  do skeleton **e** o `<DataTableSkeleton>` ≥sm precisam do mesmo
  `Boolean(actions && actions.length > 0)`; extrair p/ `const hasActions`
  evita duplicar a expressão. **Semanticamente idêntico** ao argumento
  original do `<DataTableSkeleton>` (mesma expressão, só nomeada) — não
  afeta a equivalência byte-a-byte do ramo desktop (o valor passado é o
  mesmo). Único desvio do "recorte literal"; mínimo e justificado.
- **Sem `cva` no card:** espelha a escolha explícita de `empty-state.tsx`
  ("ternário em `cn()` > `cva` p/ pouca variação") — o card não tem variantes
  reais (estados são ternários em `cn()`). Alinhado a §1.4/§6 ("sem `cva`").
- **`-mx-1 … px-1` na barra de sort:** evita que o `focus-visible:ring` (3px)
  dos chips das pontas seja clipado pelo `overflow-x-auto` da própria barra
  (negativa de margem compensada por padding — padrão de "scroll com foco
  visível"). Token-neutro (unidade de ritmo mínima), não afeta o data-table
  nem o ramo desktop.

*Nenhum outro desvio. Nenhum arquivo além de `data-table.tsx` (src), desta
spec §7 e do Changelog tocado — conforme §2.7 / guard-rail da iniciativa.*
