# UX Audit — Sistema

> Onda 0 — inventário de problemas de UX do Xpan / Daniel Augusto v2.
> Gerado pelo agente PM/UX em 2026-05-19. Read-only sobre `src/app/**` e `src/components/**`.
> Evidência citada como `arquivo:linha` ou wikilink do vault. Sem mudança de regra de negócio.

> Cada problema mapeia para um item `UX-####` no [[Backlog UX (RICE)]] e tem severidade
> 🔴 crítico · 🟡 importante · 🟢 polimento (convenção do [[12 - Iniciativa UX/README|README]]).
> Categorias: Visual · Estado · Responsivo · A11y · IA-na-tela · Terminologia · Token.

---

## 0. Sumário do diagnóstico

O sistema é **funcionalmente sólido** (ver [[Saúde do Sistema]]) mas a UX é **reativa e
inconsistente na camada de feedback e de apresentação**. A dívida é **majoritariamente
transversal**: vive nos primitivos compartilhados, não nas telas. Corrigir os primitivos
cascateia para as ~45 telas de uma vez — por isso a Onda 1 (fundação) é pré-requisito
estrito da Onda 2 (piloto).

**Os 4 problemas-raiz (todos transversais):**

1. **Sem canal de feedback.** Não existe toast/notificação em `src/components/`
   (varredura: zero `sonner`/`useToast`/`toast(`). Ações que salvam não confirmam sucesso
   nem erro de forma consistente; **17 ocorrências de `window.alert`/`window.confirm`
   nativos** em 6 telas substituem feedback de produto por diálogos do browser.
2. **Sem estados de carregamento estruturados.** Zero `Skeleton` no projeto.
   **26 telas** usam o texto literal "Carregando..."; KPIs mostram `"..."`
   (`gestor-fabrica/page.tsx:460-492`). Layout pula quando o dado chega (CLS).
3. **Tabelas inutilizáveis no mobile.** `DataTable` força
   `min-w-[640px]` + `overflow-x-auto` (`data-table.tsx:243-248`) sem fallback
   card/empilhado. Telas reais chegam a `min-w-[1500px]`
   (`administrador/usuarios/page.tsx:879`) e `min-w-[1120px]`
   (`loja/pedidos/page.tsx:979`) — scroll horizontal cego.
4. **Tokens aplicados ad-hoc.** Opacidades arbitrárias (`/15 /18 /22 /35 /70`) e cores
   OKLCH hardcoded fora dos tokens em `status-badge.tsx:43-248`; sem escala de
   espaçamento canônica em `globals.css` (só radius/shadow/cor). Resultado: contraste
   não auditado (risco WCAG AA) e visual inconsistente entre telas.

Estes 4 são a **FUNDAÇÃO** (Onda 1). Os problemas por-tela abaixo são em sua maioria
**instâncias** destes 4 — serão em grande parte resolvidos pela cascata, restando só o
polimento específico de cada arquétipo na Onda 2/3.

---

## 1. Problemas transversais (FUNDAÇÃO — Onda 1)

> Estes vivem nos primitivos. Resolver aqui propaga para todas as telas. **Pré-requisito
> da Onda 2.** Mapeiam para os itens FUNDAÇÃO do [[Backlog UX (RICE)]].

### F-1 — Ausência de sistema de feedback (toast/notificação) · 🔴 · Estado

- **Onde:** não existe em `src/components/`. Substituído por `window.alert`/`window.confirm`.
- **Evidência:** `loja/pedidos/page.tsx:612,623,643,673`;
  `gestor-fabrica/pedidos/page.tsx:203,207,217`;
  `gestor-dados/produtos/page.tsx` (4×); `loja/pedidos/[orderId]/page.tsx` (2×);
  `gestor-fabrica/pedidos/[orderId]/page.tsx` (2×); `gestor-dados/linhas-producao/page.tsx` (2×).
- **Heurística (Nielsen #1 Visibilidade do estado):** após salvar/cancelar/liberar, o
  usuário não recebe confirmação de produto. `window.confirm` bloqueia a UI, não é
  estilizável, não é acessível e quebra o fluxo touch da loja.
- **Personas mais afetadas:** loja (cria pedido às pressas, não sabe se gravou →
  re-submete → duplicidade, cruza com [[Dívida Técnica#D03]]),
  gestor-fabrica (libera ordem, ação crítica, sem confirmação).
- **Item:** `UX-0002`.

### F-2 — Sem skeletons; carregamento textual e CLS · 🔴 · Estado

- **Onde:** zero `Skeleton` no projeto. `DataTable` loading = spinner + "Carregando
  registros..." (`data-table.tsx:208-217`). 26 telas com "Carregando..." literal.
  KPIs do dashboard exibem `"..."` (`gestor-fabrica/page.tsx:460-492`).
- **Heurística (Nielsen #1; performance percebida):** sem placeholder de forma, a tela
  pula quando o dado chega (layout shift), e o usuário não sabe quanto falta.
- **Personas:** todas — mais sensível em gestor-fabrica (dashboards densos) e chão
  (consulta rápida no piso).
- **Item:** `UX-0003`.

### F-3 — DataTable não-responsivo (scroll horizontal cego no mobile) · 🔴 · Responsivo

- **Onde:** `src/components/shared/data-table.tsx:243-248` — `overflow-x-auto` +
  `min-w-[640px] xl:min-w-full`. Sem estratégia card/empilhado < 640px.
- **Instâncias reais:** `administrador/usuarios/page.tsx:879` (`min-w-[1500px]`),
  `loja/pedidos/page.tsx:979` (`min-w-[1120px]`) e `:1176` (`min-w-[760px]`),
  `gestor-fabrica/ordens-producao/page.tsx:586` (`min-w-[920px]`).
- **Heurística (Fitts; ergonomia mobile):** loja opera em celular no balcão; tabela de
  pedido com scroll horizontal de 1120px é inutilizável com o polegar.
- **Personas:** loja (crítico — touch-first), chão (tablet/celular no piso). Item de
  **maior alavancagem** — alimenta 15+ telas de tabela + fila de OPs + matriz de usuários.
- **Item:** `UX-0001`.

### F-4 — Tokens/opacidade ad-hoc; sem escala de espaçamento · 🟡 · Token

- **Onde:** `status-badge.tsx:43-248` (opacidades `/15 /18 /22 /35 /70` + ~20 cores
  OKLCH hardcoded fora dos tokens `--success/--warning/...`). `globals.css:67-131`
  define cor/radius/shadow/fonte mas **nenhuma escala de espaçamento**.
- **Heurística (Nielsen #4 Consistência; WCAG 1.4.3 Contraste):** mesma cor semântica
  renderiza diferente entre componentes; contraste texto/fundo nunca auditado.
- **Personas:** todas (consistência visual + legibilidade).
- **Itens:** `UX-0005` (escala de espaçamento + degraus canônicos de opacidade),
  `UX-0006` (auditoria de contraste WCAG AA dos pares token).

### F-5 — Sem convenção de "botão enviando"; empty state genérico · 🟡 · Estado

- **Onde:** `src/components/ui/button.tsx:11-71` não tem prop `isLoading`/spinner —
  cada autor reimplementa manualmente (feito em `loja/pedidos/page.tsx:1235`
  `{isSubmitting ? "Salvando..."}`, **ausente na maioria das telas**). Empty state do
  DataTable é texto cinza sem ícone/ilustração/CTA padrão (`data-table.tsx:219-238`).
- **Heurística (Nielsen #1; prevenção de erro):** sem desabilitar+spinner no submit, o
  usuário clica duas vezes → duplica ação (reforça [[Dívida Técnica#D03]]).
- **Personas:** todas; loja em destaque (duplo-clique = pedido duplicado).
- **Itens:** `UX-0004` (convenção de botão enviando — prop no `button.tsx`),
  `UX-0007` (`empty-state.tsx` primitivo: ícone + mensagem + CTA opcional).

### F-6 — Terminologia "Setores" vs "Categorias" inconsistente · 🟡 · Terminologia

- **Onde:** `src/lib/permission-modules.ts:256-258` — `id: "gestor-dados.setores"`,
  `route: "/gestor-dados/setores"`, `label: "Categorias"`. Cruza com
  [[Dívida Técnica#D26]].
- **Heurística (Nielsen #2 Correspondência sistema↔mundo real):** rota/URL diz "setores",
  tela diz "Categorias" — usuário e suporte se confundem.
- **Escopo:** apenas o **label visível na tela** é unificável aqui (IA-na-tela permitida);
  renomear rota/slug é mudança estrutural → **fora** desta iniciativa, fica como nota.
- **Personas:** gestor-dados, administrador.
- **Item:** `UX-0008`.

### F-7 — Normalização de espaçamento/token nos shared de layout · 🟡 · Visual/Token

- **Onde:** `page-header.tsx`, `page-hero.tsx`, `page-layout.tsx`, `kpi-card.tsx`,
  `status-badge.tsx`, `module-card.tsx`, `profile-page.tsx` e
  `src/components/layout/{app-shell,sidebar,area-shell-layout,page-container}.tsx`.
  Cada um usa paddings/raios próprios (`rounded-xl` vs `rounded-2xl`, `px-5 py-6` vs
  `px-5 py-7`, `border-border/70` vs `/65`).
- **Heurística (Nielsen #4 Consistência):** ritmo vertical e moldura variam entre telas
  do mesmo arquétipo.
- **Personas:** todas. `profile-page.tsx` cobre as 6 telas de perfil de uma vez.
- **Item:** `UX-0009` (normalização token/espaçamento dos shared+layout, após `UX-0005`).

### F-8 — Densidade não-diferenciada por persona · 🟢 · Responsivo

- **Onde:** shell em `src/components/layout/*` aplica a mesma densidade para loja
  (touch/mobile-first) e gestor/admin (densa, desktop). Sem alvo de hit-target ≥44px
  no shell para a loja.
- **Heurística (Fitts; ergonomia por contexto):** loja opera de pé no balcão; alvos
  pequenos custam toques errados.
- **Personas:** loja (ganho), chão (ganho), gestor/admin (neutro/positivo se densa
  permanecer no desktop).
- **Item:** `UX-0010` (densidade responsiva no shell — só espaçamento, sem mexer em nav).

---

## 2. Problemas por tela (piloto Onda 2 — em sua maioria instâncias da fundação)

> Após a Onda 1, a maior parte destes some por cascata. O que resta aqui é o polimento
> específico do arquétipo. **Guard-rail:** nenhuma mudança de regra; AJ-0009 FORA.

### Arquétipo: Grid / POS — `loja/pedidos` (mais usada pela loja, mais mobile-sensível)

- **Arquivo:** `src/app/loja/pedidos/page.tsx` (1263 linhas)
- **Persona:** [[Loja]] (crítico, touch-first)
- **Problemas (instâncias de F-1/F-2/F-3 + específicos):**
  - `window.alert`/`window.confirm` (l.612, 623, 643, 673) → migrar p/ toast+dialog
    (resolve via `UX-0002`; aplicação específica = `UX-0011`).
  - Duas tabelas `min-w-[1120px]` (l.979) e `min-w-[760px]` (l.1176) — scroll horizontal
    no celular do balcão (resolve via `UX-0001`; grade semanal precisa de tratamento
    responsivo dedicado = `UX-0011`).
  - "Carregando dados do pedido…" textual (l.766) → skeleton (`UX-0003`).
  - **Bom padrão a preservar:** botão de submit já troca texto/disabled
    (l.1235) — generalizar isso vira `UX-0004`, não regredir aqui.
  - **Guarda:** só apresentação. **AJ-0009 (redesenho do modelo de pedido) FORA**
    — cross-link [[Backlog de Ajustes#AJ-0009]]. Não tocar fluxo/modelo, só
    hierarquia visual, estados, responsividade e a11y da grade.
- **Item agregador da tela:** `UX-0011`.

### Arquétipo: Data-table — `gestor-fabrica/ordens-producao`

- **Arquivo:** `src/app/gestor-fabrica/ordens-producao/page.tsx` (650 linhas)
- **Persona:** [[Gestor de Fábrica]], [[Chão de Fábrica]] (visualizar)
- **Problemas:** tabela 8+ colunas `min-w-[920px]` (l.586) — pior caso de tabela larga;
  loading textual via `emptyMessage`. Valida o fix responsivo do `DataTable` (`UX-0001`).
- **Item:** `UX-0012`.

### Arquétipo: Data-table — `gestor-fabrica/pedidos`

- **Arquivo:** `src/app/gestor-fabrica/pedidos/page.tsx` (670 linhas)
- **Persona:** [[Gestor de Fábrica]]
- **Problemas:** `window.alert` (l.203) e dois `window.confirm` (l.207, 217) em ações
  críticas (cancelar pedido / liberar) — sem feedback de produto, diálogo do browser
  numa operação irreversível. Resolve via `UX-0002`; aplicação = `UX-0013`.
- **Item:** `UX-0013`.

### Arquétipo: Dashboard+settings — `gestor-fabrica/page.tsx`

- **Arquivo:** `src/app/gestor-fabrica/page.tsx` (578 linhas)
- **Persona:** [[Gestor de Fábrica]]
- **Problemas:** KPIs exibem `"..."` literal enquanto `isLoading` (l.460-492) — sem
  skeleton, layout pula; bloco de settings (l.369) com grid próprio. Valida
  skeleton/empty/KPI da fundação (`UX-0003`, `UX-0007`).
- **Item:** `UX-0014`.

### Arquétipo: Grid drag-drop — `gestor-fabrica/sublinhas-producao`

- **Arquivo:** `src/app/gestor-fabrica/sublinhas-producao/page.tsx` (1456 linhas)
- **Persona:** [[Gestor de Fábrica]]
- **Problema A11y (específico, crítico):** reordenação por **drag-and-drop só de mouse**
  (`onDragStart`/`onDragOver`/`onDragEnd`, l.1299-1313, `draggable` l.1308) — **sem
  alternativa por teclado, sem ARIA, sem foco visível na ação de mover**. Falha WCAG
  2.1.1 (Teclado) / 4.1.2 (Nome, Função, Valor). Loading textual ("Carregando linhas...",
  l.990).
  - **Guarda:** não tocar o engine de prioridade/cronograma — só adicionar afordância de
    teclado/ARIA + estado visual; comportamento de negócio idêntico.
- **Item:** `UX-0015` (🔴 por ser barreira de acessibilidade total para teclado).

### Arquétipo: Matriz densa — `administrador/usuarios`

- **Arquivo:** `src/app/administrador/usuarios/page.tsx` (1591 linhas)
- **Persona:** [[Administrador]], [[Administrador Master]] (read-only-tenant)
- **Problemas:** matriz de permissão `tableClassName="min-w-[1500px]"` (l.879) — **pior
  caso de scroll horizontal do sistema**; loading textual via `emptyMessage` (l.876);
  dezenas de `min-w-[8-17rem]` em células (l.235-341) tornam o fallback responsivo não
  trivial. **Guarda:** zero mudança na lógica de permissão (`sanitizePermissionsForRole`).
  Read-only-tenant: afordância **desabilitada, não removida** (já respeitado em
  `data-table.tsx:374-391`).
- **Item:** `UX-0016`.

---

## 3. Outras telas (Onda 3, condicional — herdam a cascata)

> Não detalhadas item-a-item nesta auditoria (decisão de escopo: piloto primeiro).
> Listadas para completude; a maioria é resolvida pela Onda 1 sem trabalho por-tela.

| Lote | Telas | Herda da fundação | Resíduo provável |
|---|---|---|---|
| A — Dashboards-home | 5 dashboards restantes (loja, chão, gestor-dados, admin, admin-master) | F-2 skeleton, F-4/F-7 token, F-8 densidade | Polimento de KPI por persona |
| B — Data-table | ~11 telas de tabela restantes | F-3 responsivo (auto), F-2 | Quase nenhum |
| C — Detalhe | 6 páginas `[id]` | F-1 toast, F-2 skeleton | Hierarquia de detalhe |
| D — Perfil | 6 perfis | F-7 (`profile-page.tsx` cobre todas) | Mínimo |
| E — Impressão | 4 rotas `src/app/impressao/` | F-4 token | Densidade/quebra de página — cross-link [[Backlog de Ajustes#AJ-0010]] (já feito) e [[Dívida Técnica#D17]] (guarda fora de `appAreaPath` — **não** abordar aqui, é segurança) |

---

## 4. Dedupe vs Backlog de Ajustes (AJ)

> Esta iniciativa usa namespace próprio `UX-####`. Cross-link só onde há sobreposição.

| Item UX | Sobrepõe AJ? | Tratamento |
|---|---|---|
| `UX-0011` (`loja/pedidos`) | [[Backlog de Ajustes#AJ-0009]] (modelo de pedido) | **Disjunto.** AJ-0009 = modelo (FORA, ADR). UX-0011 = só apresentação. Cross-link de fronteira. |
| `UX-0004` (botão enviando) | [[Backlog de Ajustes#AJ-0007]] (aviso duplicidade, feito) | Complementar. AJ-0007 resolveu o aviso; UX-0004 previne o duplo-clique na origem. Sem conflito. |
| `UX-0002` (toast) | AJ-0006 removeu `window.confirm` de lote mínimo | AJ-0006 já tirou 1 confirm; UX-0002 substitui os 17 restantes por sistema unificado. |
| `UX-0008` (Setores/Categorias) | [[Dívida Técnica#D26]] | Mesma raiz. UX-0008 unifica só o **label de tela**; renomear slug/rota fica na dívida técnica (fora). |
| Onda 3 lote E (impressão) | [[Backlog de Ajustes#AJ-0010]] (feito) | AJ-0010 já compactou impressão. Onda 3 só herda token. |

Os AJ concluídos nas Ondas 1–3 (AJ-0001…AJ-0018) são **bug/feature operacional**, não
re-auditados aqui. A iniciativa UX é a varredura **proativa** de qualidade, ortogonal.

---

## 5. Riscos da própria auditoria (assunções a validar no Gate 0)

1. **Cobertura amostral.** As 6 telas-piloto + primitivos foram lidos linha-a-linha; as
   ~39 telas restantes foram inferidas por padrão de arquétipo + varredura agregada
   (grep de `alert/confirm/Carregando/min-w`). Risco baixo (a dívida é transversal), mas
   pode haver resíduo por-tela na Onda 3.
2. **Contraste WCAG não medido numericamente.** `UX-0006` precisa de medição real dos
   pares OKLCH; a auditoria sinaliza o risco, não o quantifica (não executo código).
3. **DnD do sublinhas (`UX-0015`)** assume que dá para adicionar teclado/ARIA sem tocar
   o engine — a confirmar com o Refinador na spec.
4. **Suíte Playwright 17-PASS** é o canário de regressão (ver [[e2e-playwright-setup]] na
   memória do projeto) — pré-requisito de gate, confirmar runner no Gate 0.

→ Continua em [[Persona-Impact Matrix]], [[Backlog UX (RICE)]], [[UX PRD]].
