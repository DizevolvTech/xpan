# Backlog UX (RICE)

> Lista única `UX-####`, priorizada por RICE. Onda 0, 2026-05-19.
> Convenção: [[12 - Iniciativa UX/README|README]]. Companion de [[UX Audit — Sistema]],
> [[Persona-Impact Matrix]], [[UX PRD]]. Guard-rails: sem mudança de regra; AJ-0009 fora;
> dark mode fora; nav/`permission-modules` fora.

## Método RICE (escala explícita)

- **Reach (0–10):** fração de [personas × telas] alcançada. Primitivo que cascateia a
  ~45 telas/6 personas ≈ 9–10. Item de 1 tela/1 persona ≈ 1–2.
- **Impact (escala discreta):** 3 = massivo (destrava uso/bloqueia erro de dado) ·
  2 = alto · 1 = médio · 0.5 = baixo · 0.25 = mínimo.
- **Confidence (50–100%):** evidência direta no código + heurística clara = 90–100%;
  depende de spec do Refinador = 70–80%; assume não-explorado = 50–60%.
- **Effort (pessoa-semana, menor = melhor):** estimativa de esforço relativo
  (PM não dá estimativa de engenharia absoluta — é ordinal para priorizar).
- **Score = (Reach × Impact × Confidence) ÷ Effort.** Maior = primeiro.

> ⚠️ Itens marcados **[FUNDAÇÃO]** cascateiam para todas as telas e são **pré-requisito
> estrito** dos itens de tela (Onda 2/3). Mesmo quando um item de tela tem RICE alto,
> ele **não inicia antes** da fundação correspondente — a ordem RICE abaixo já reflete
> isso (fundação no topo por construção, não por acaso).

---

## Tabela priorizada (ordenada por RICE Score)

| # | ID | Título | Cat. | Sev. | R | I | C | E | **Score** | Onda | Tipo |
|---|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | `UX-0001` | DataTable responsivo (fallback card/empilhado < 640px, zero scroll-x) | Responsivo | 🔴 | 10 | 3 | 0.9 | 1.5 | **18.0** | 1 | **[FUNDAÇÃO]** |
| 2 | `UX-0002` | Sistema de toast/feedback (substitui 17 `alert/confirm`) | Estado | 🔴 | 10 | 3 | 0.95 | 1.7 | **16.8** | 1 | **[FUNDAÇÃO]** |
| 3 | `UX-0003` | Primitivo `skeleton.tsx` + adoção no DataTable/KPI | Estado | 🔴 | 10 | 2 | 0.95 | 1.2 | **15.8** | 1 | **[FUNDAÇÃO]** |
| 4 | `UX-0004` | Convenção "botão enviando" (prop no `button.tsx`) | Estado | 🟡 | 9 | 2 | 0.9 | 1.0 | **16.2** | 1 | **[FUNDAÇÃO]** |
| 5 | `UX-0007` | Primitivo `empty-state.tsx` (ícone + msg + CTA) | Estado | 🟡 | 9 | 1 | 0.9 | 0.7 | **11.6** | 1 | **[FUNDAÇÃO]** |
| 6 | `UX-0005` | Escala de espaçamento + degraus canônicos de opacidade em `globals.css` | Token | 🟡 | 10 | 1 | 0.85 | 0.8 | **10.6** | 1 | **[FUNDAÇÃO]** |
| 7 | `UX-0006` | Auditoria de contraste WCAG AA dos pares de token | A11y | 🔴 | 10 | 2 | 0.7 | 1.5 | **9.3** | 1 | **[FUNDAÇÃO]** |
| 8 | `UX-0008` | Unificar label "Setores"→"Categorias" (só tela) | Terminologia | 🟡 | 3 | 1 | 0.95 | 0.3 | **9.5** | 1 | **[FUNDAÇÃO]** |
| 9 | `UX-0009` | Normalizar token/espaçamento dos 7 shared + 4 layout | Visual | 🟡 | 10 | 1 | 0.8 | 1.2 | **6.7** | 1 | **[FUNDAÇÃO]** |
| 10 | `UX-0015` | A11y no DnD de `sublinhas-producao` (teclado + ARIA) | A11y | 🔴 | 2 | 3 | 0.7 | 1.0 | **4.2** | 2 | Tela |
| 11 | `UX-0010` | Densidade responsiva no shell (loja/chão touch) | Responsivo | 🟢 | 4 | 1 | 0.75 | 0.8 | **3.8** | 1 | **[FUNDAÇÃO]** |
| 12 | `UX-0011` | Polimento `loja/pedidos` (visual/estado/responsivo/a11y da grade) | Visual | 🔴 | 2 | 3 | 0.8 | 1.5 | **3.2** | 2 | Tela |
| 13 | `UX-0016` | Matriz `administrador/usuarios` responsiva (sem tocar lógica) | Responsivo | 🔴 | 2 | 2 | 0.75 | 1.2 | **2.5** | 2 | Tela |
| 14 | `UX-0013` | `gestor-fabrica/pedidos`: confirm→dialog+toast | Estado | 🟡 | 2 | 2 | 0.85 | 1.0 | **3.4** | 2 | Tela |
| 15 | `UX-0012` | `gestor-fabrica/ordens-producao` polimento data-table | Responsivo | 🟡 | 2 | 1 | 0.85 | 0.8 | **2.1** | 2 | Tela |
| 16 | `UX-0014` | `gestor-fabrica/page.tsx` dashboard (skeleton/KPI/empty) | Estado | 🟡 | 2 | 1 | 0.85 | 0.7 | **2.4** | 2 | Tela |

> Nota de ordenação: a tabela está agrupada **fundação primeiro** (linhas 1–9, 11) e
> **tela depois** (10, 12–16), porque um item de tela com Score isolado mais alto que um
> de fundação **ainda assim não pode iniciar antes da fundação que ele consome**. Dentro
> de cada bloco, ordenado por Score. `UX-0015` aparece cedo no bloco-tela por ser a única
> barreira de acessibilidade **total** (teclado) — sobe na Onda 2.

---

## Detalhe dos itens

### [FUNDAÇÃO] — Onda 1 (cascateiam; pré-requisito da Onda 2)

#### `UX-0001` — DataTable responsivo · 🔴 Responsivo · Score 18.0
- **Problema:** [[UX Audit — Sistema#F-3 — DataTable não-responsivo]].
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/shared/data-table.tsx` (l.243-248).
- **Escopo:** estratégia card/empilhado < 640px; preservar 100% das colunas/ações/sort/
  paginação/expand/read-only. Sem mudar dados. Maior alavancagem (15+ telas + OPs + matriz).
- **RICE:** R10 (todas as tabelas, ~5 personas) · I3 (loja inutilizável hoje) · C0.9 · E1.5.
- **Status:** ✅ Concluído em 2026-05-19 (Abordagem C aprovada no checkpoint: tabela desktop byte-equivalente ≥sm + lista de cards irmã <640px, 100% CSS, zero JS de viewport; data-table.tsx +248/-7 wrap-only no ramo desktop; sort/ações/expand/paginação/loading/empty/read-only preservados no card; e2e 26 PASS/0 FAIL desktop; lint/tsc/test verdes). Ajuste fino matriz densa → UX-0016, ordens-producao → UX-0012 (Onda 2). Ver spec §7.

#### `UX-0002` — Sistema de toast/feedback · 🔴 Estado · Score 16.8
- **Problema:** [[UX Audit — Sistema#F-1]]. **17 `alert/confirm`** mapeados.
- **Arquivos:** novo primitivo em `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/shared/` (Radix já nas deps — reuso-primeiro). Substituições em `loja/pedidos/page.tsx:612,623,643,673`; `gestor-fabrica/pedidos/page.tsx:203,207,217`; `gestor-dados/produtos/page.tsx`; `loja/pedidos/[orderId]/page.tsx`; `gestor-fabrica/pedidos/[orderId]/page.tsx`; `gestor-dados/linhas-producao/page.tsx`.
- **Escopo:** sucesso/erro/info; confirmação destrutiva vira dialog acessível (não
  `window.confirm`). Não muda **o que** a ação faz, só **como** comunica.
- **Dedupe:** complementa [[Backlog de Ajustes#AJ-0006]] (já tirou 1 confirm) e [[Backlog de Ajustes#AJ-0007]] (aviso duplicidade).
- **RICE:** R10 · I3 (sem isso, loja re-submete → duplicidade) · C0.95 · E1.7.
- **Status:** ✅ Concluído em 2026-05-19 (toast.tsx + confirm-dialog.tsx via radix-ui, zero dep nova; provider em layout.tsx; 17/17 sítios trocados §2.5; confirm→await preservando semântica §2.4; e2e 26 PASS/0 FAIL; lint/tsc/test verdes). Ver spec §7.

#### `UX-0003` — `skeleton.tsx` + adoção · 🔴 Estado · Score 15.8
- **Problema:** [[UX Audit — Sistema#F-2]]. 26 telas "Carregando..."; KPI "..." (`gestor-fabrica/page.tsx:460-492`).
- **Arquivos:** novo `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/shared/skeleton.tsx`; adoção em `src/components/shared/data-table.tsx:208-217` e KPI.
- **Escopo:** placeholder de forma que elimina CLS; sem mudar tempo de carga (só percebido).
- **RICE:** R10 · I2 · C0.95 · E1.2.
- **Status:** ✅ Concluído em 2026-05-19 (skeleton.tsx Skeleton+DataTableSkeleton via cva, zero dep nova; adotado em data-table.tsx + kpi-card.tsx + 5 callers gestor-fabrica/page.tsx; alturas CLS-matched; ~41 sítios de tela adiados p/ UX-0009/Onda 2-3; e2e 26 PASS/0 FAIL; lint/tsc/test verdes). Ver spec §7.

#### `UX-0004` — Convenção "botão enviando" · 🟡 Estado · Score 16.2
- **Problema:** [[UX Audit — Sistema#F-5]]. `button.tsx:11-71` sem `isLoading`.
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/ui/button.tsx`. Padrão de referência a generalizar: `loja/pedidos/page.tsx:1235`.
- **Escopo:** prop opcional `isLoading` (spinner + disabled + texto), retrocompatível.
  Previne duplo-clique (mitiga [[Dívida Técnica#D03]] na origem da UI).
- **RICE:** R9 · I2 · C0.9 · E1.0.
- **Status:** ✅ Concluído em 2026-05-19 (button.tsx +67/-4: props opcionais isLoading/loadingText, Loader2 reusado zero dep nova, read-only/asChild/disabled preservados byte-idêntico; adoção 100% adiada p/ UX-0009/Onda 2; e2e 26 PASS/0 FAIL; lint/tsc/test verdes). Ver spec §7.

#### `UX-0007` — `empty-state.tsx` · 🟡 Estado · Score 11.6
- **Problema:** [[UX Audit — Sistema#F-5]]. `data-table.tsx:219-238` texto cinza só.
- **Arquivo:** novo `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/shared/empty-state.tsx`; integra ao DataTable (já tem `emptyStateAction`).
- **RICE:** R9 · I1 · C0.9 · E0.7.
- **Status:** ✅ Concluído em 2026-05-19 (empty-state.tsx ícone+título+desc+CTA, sem cva, zero dep nova; integrado no data-table.tsx preservando emptyMessage/emptyStateAction 1:1 e trava read-only explícita; 8+ molduras ad-hoc adiadas p/ UX-0009/Onda 2-3; e2e 26 PASS/0 FAIL; lint/tsc/test verdes). Ver spec §7.

#### `UX-0005` — Escala de espaçamento + opacidade canônica · 🟡 Token · Score 10.6
- **Problema:** [[UX Audit — Sistema#F-4]]. `globals.css:67-131` sem escala; `status-badge.tsx:43-248` opacidades ad-hoc.
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/globals.css`. Só token/tema, **zero comportamento**. Pré-requisito de `UX-0009`.
- **RICE:** R10 · I1 · C0.85 · E0.8.
- **Status:** ✅ Concluído em 2026-05-19 (Estratégia A 8 degraus; namespace `--spacing-rhythm-*` por R5; aditivo +25 linhas; e2e 26 PASS/0 FAIL; lint/tsc/test verdes). Ver spec §7 autorreview.

#### `UX-0006` — Auditoria de contraste WCAG AA · 🔴 A11y · Score 9.3
- **Problema:** [[UX Audit — Sistema#F-4]] / risco WCAG 1.4.3. Pares OKLCH nunca medidos.
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/globals.css` + `src/components/shared/status-badge.tsx`.
- **Escopo:** medir cada par texto/fundo de token e badge; ajustar L do OKLCH onde
  reprovar AA (4.5:1 texto / 3:1 UI). Sem mudar semântica de cor. C0.7 (depende de
  medição na spec — PM sinaliza, não quantifica).
- **RICE:** R10 · I2 · C0.7 · E1.5.
- **Status:** ↩️ **REVERTIDO em 2026-05-19 por feedback do usuário no Gate 1.** O escurecimento `--border` 0.90→0.65 deixou as bordas feias ("ruim demais"). Valores restaurados ao original (`--border` 0.90, `--border-strong` 0.78, `--ring` 0.68). **Lição:** WCAG 1.4.11 **não** exige 3:1 em borda decorativa/estrutural — só em fronteira que é único meio de identificar componente/estado acionável. Aplicação foi ampla demais. Se reabrir: só anel de foco + bordas com significado, ajuste sutil, validação visual ANTES de commitar. Não reabrir sem pedido explícito.

#### `UX-0008` — Unificar label "Setores"→"Categorias" · 🟡 Terminologia · Score 9.5
- **Problema:** [[UX Audit — Sistema#F-6]] / [[Dívida Técnica#D26]].
- **Arquivo:** label visível em `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/lib/permission-modules.ts:256-258` (label, **não** slug/route) + telas que renderizam "Setores".
- **Escopo:** só o **texto exibido**. Renomear rota/slug = estrutural → **fora** (fica em
  [[Dívida Técnica#D26]]). **Termo canônico (Gate 0): "Categorias".**
- **RICE:** R3 (só gestor-dados/admin) · I1 · C0.95 · E0.3.
- **Status:** ✅ Concluído em 2026-05-19 — **no-op de código** (Δ=∅). Verificação constatou que a UI já diz "Categorias" em 100% dos sítios renderizados (F-6 obsoleto). 16 famílias estruturais (slug/rota/permission/tipo/campos) preservadas e delegadas a [[Dívida Técnica#D26]]. `permission-modules.ts:257` label display-only já canônico. Ver spec §7.

#### `UX-0009` — Normalizar shared + layout · 🟡 Visual · Score 6.7
- **Problema:** [[UX Audit — Sistema#F-7]].
- **Arquivos:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/shared/{page-header,page-hero,page-layout,kpi-card,status-badge,module-card,profile-page}.tsx` + `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/layout/{app-shell,sidebar,area-shell-layout,page-container}.tsx`.
- **Depende de:** `UX-0005` (consome a nova escala). `profile-page.tsx` cobre 6 perfis.
- **RICE:** R10 · I1 · C0.8 · E1.2.
- **Status:** ✅ Concluído em 2026-05-19 (~75 opacidades ad-hoc → tokens `--opacity-*` via de-para UX-0005 §7.4, Estratégia A, em 8 arquivos; 28 tokens de cor novos em globals.css — 5 famílias `--status-*` + 4 `--kpi-trend-*` + 2 `--module-*` com valores OKLCH AA-validados UX-0006; 1 convergência de raio page-header; sidebar /45/85/90 → input UX-0005; e2e 26 PASS/0 FAIL; lint/tsc/test verdes). ⚠️ **Smoke visual Gate 1**: 5 pontos Δ=5pp (maior: /70→0.65 cascateia em todas as telas) + raio page-header. Ver spec §7.

#### `UX-0010` — Densidade responsiva no shell · 🟢 Responsivo · Score 3.8
- **Problema:** [[UX Audit — Sistema#F-8]].
- **Arquivos:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/layout/{app-shell,sidebar,area-shell-layout,page-container}.tsx`.
- **Escopo:** só espaçamento/hit-target por breakpoint; **não** mexer em navegação nem
  `permission-modules`. Ganho concentrado em loja/chão.
- **RICE:** R4 · I1 · C0.75 · E0.8.
- **Status:** ✅ Concluído em 2026-05-19 (app-shell.tsx +3/-1, sidebar.tsx +21/-4; 6 controles do shell → ≥44×44px mobile via base touch + `lg:`/`sm:` reafirmando desktop byte-a-byte; zero primitivo/token novo; nav/permission/colapso/rota intactos; e2e 26 PASS/0 FAIL desktop; lint/tsc/test verdes). ⚠️ Smoke responsivo loja/chão 360/768 no Gate 1. Ver spec §7.

### Tela — Onda 2 (piloto; consomem a fundação)

#### `UX-0015` — A11y no DnD de `sublinhas-producao` · 🔴 A11y · Score 4.2
- **Problema:** [[UX Audit — Sistema#Arquétipo: Grid drag-drop]]. DnD só mouse
  (`sublinhas-producao/page.tsx:1299-1313`), sem teclado/ARIA → WCAG 2.1.1 reprovado.
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/gestor-fabrica/sublinhas-producao/page.tsx`.
- **Guarda:** não tocar engine de prioridade/cronograma. Só afordância de teclado +
  ARIA + foco visível. Comportamento de negócio idêntico. **Sobe na Onda 2** por ser a
  única barreira de acessibilidade total (teclado) do sistema.
- **RICE:** R2 (1 tela, gestor-fabrica) · I3 (bloqueio total p/ teclado) · C0.7 · E1.0.

#### `UX-0011` — Polimento `loja/pedidos` · 🔴 Visual · Score 3.2
- **Problema:** [[UX Audit — Sistema#Arquétipo: Grid / POS]].
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/loja/pedidos/page.tsx`.
- **Guarda absoluta:** **só apresentação.** [[Backlog de Ajustes#AJ-0009]] (modelo de
  pedido) **FORA** — não tocar fluxo/modelo. Preservar o bom padrão de submit (l.1235).
- **Depende de:** `UX-0001`, `UX-0002`, `UX-0003`, `UX-0004`.
- **RICE:** R2 (loja, tela mais usada) · I3 · C0.8 · E1.5.

#### `UX-0013` — `gestor-fabrica/pedidos`: confirm→dialog · 🟡 Estado · Score 3.4
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/gestor-fabrica/pedidos/page.tsx` (l.203,207,217).
- **Depende de:** `UX-0002`. **Guarda:** cancelar/liberar continuam com a mesma regra.
- **RICE:** R2 · I2 · C0.85 · E1.0.

#### `UX-0014` — `gestor-fabrica/page.tsx` dashboard · 🟡 Estado · Score 2.4
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/gestor-fabrica/page.tsx` (l.460-492).
- **Depende de:** `UX-0003`, `UX-0007`. Cross-link [[Backlog de Ajustes#AJ-0001]]/[[Backlog de Ajustes#AJ-0002]] (Kanban/cards já feitos — **não regredir**).
- **RICE:** R2 · I1 · C0.85 · E0.7.

#### `UX-0016` — Matriz `administrador/usuarios` responsiva · 🔴 Responsivo · Score 2.5
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/administrador/usuarios/page.tsx` (l.879 `min-w-[1500px]`).
- **Guarda:** zero mudança em `sanitizePermissionsForRole`/lógica de permissão.
  Read-only-tenant: afordância desabilitada, **não** removida.
- **Depende de:** `UX-0001` (mas pode precisar de tratamento dedicado por ser a matriz
  mais densa). **RICE:** R2 · I2 · C0.75 · E1.2.

#### `UX-0012` — `gestor-fabrica/ordens-producao` data-table · 🟡 Responsivo · Score 2.1
- **Arquivo:** `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/gestor-fabrica/ordens-producao/page.tsx` (l.586 `min-w-[920px]`).
- **Depende de:** `UX-0001`. Valida o fix responsivo no campo. Cross-link
  [[Backlog de Ajustes#AJ-0013]] (painel de agendadas — não regredir).
- **RICE:** R2 · I1 · C0.85 · E0.8.

---

## Sequência recomendada (respeitando dependências)

**Onda 1 (fundação, ordem de toque do plano):**
1. `UX-0005` (tokens — base de tudo, zero comportamento, reversível trivial)
2. `UX-0002` → `UX-0003` → `UX-0004` → `UX-0007` (primitivos de estado, 1 commit cada)
3. `UX-0001` (DataTable — maior alavancagem; depende dos primitivos de estado p/ loading)
4. `UX-0006` (contraste — após tokens estabilizados)
5. `UX-0008` (terminologia — independente, rápido, pode paralelizar)
6. `UX-0009` (normalização shared/layout — consome `UX-0005`)
7. `UX-0010` (densidade shell — por último na fundação, menor risco/menor reach)

**→ GATE 1** (lint+build+tsc+test+Playwright 17-PASS+smoke 6 personas) antes da Onda 2.

**Onda 2 (piloto, 6 telas):** `UX-0011` → `UX-0012` → `UX-0013` → `UX-0014` →
`UX-0015` → `UX-0016`. Um `UX-####` por commit/branch.

**→ GATE 2** (revisão do piloto com o usuário) → decide Onda 3.

## O que está deferido/fora (e por quê)
- **Onda 3** (telas restantes): só após Gate 2. A maioria herda a cascata da Onda 1 —
  esforço por-tela mínimo (ver [[UX Audit — Sistema#3. Outras telas]]).
- **AJ-0009** (modelo de pedido): fora — segue no ADR ([[Backlog de Ajustes#AJ-0009]]).
- **Renomear slug/rota `setores`**: estrutural, fica em [[Dívida Técnica#D26]].
- **Guarda `/impressao` (D17)**: segurança, não UX — não abordar aqui.
- **Dark mode / navegação / `permission-modules` lógica**: fora por decisão de escopo.
