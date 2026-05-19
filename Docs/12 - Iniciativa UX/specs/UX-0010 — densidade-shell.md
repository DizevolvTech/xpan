# UX-0010 — Densidade responsiva no shell (loja/chão touch)

> **Spec de refinamento** (Onda 1 — Fundação, **último item**). Produzida pelo
> agente Refinador (`/ux-ui-refiner` aplicado como motor de análise; **modo
> spec-only — não toca `src/`**, ver [[feedback_spec-only-mode|memória do agente]]).
> Companheira de [[Backlog UX (RICE)]] (item #11, l.41 e l.127-132 — Score 3.8,
> 🟢 Responsivo), [[UX PRD]] (critérios "Responsivo" §6 — *"persona loja/chão no
> shell, em mobile, alvos interativos ≥44×44px"*; métrica **M7** = hit-target
> ≥44×44px no shell loja/chão; resolução [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0]]),
> [[UX Audit — Sistema]] (achado
> [[UX Audit — Sistema#F-8 — Densidade não-diferenciada por persona · 🟢 · Responsivo|F-8]]).
> Convenção: [[12 - Iniciativa UX/README|README]].
> **Consome como contrato:** [[UX-0005 — escala-espacamento-opacidade|UX-0005]]
> **§7** (escala `--spacing-rhythm-*` 8 degraus, ancorada em `--space-unit`=4px) e
> o estado **pós-[[UX-0009 — normalizacao-shared-layout|UX-0009]]** dos 4 arquivos
> de layout (opacidades já tokenizadas — **não reintroduzir sufixo ad-hoc**).
> Espelha o rigor/formato de [[UX-0001 — datatable-responsivo|UX-0001]] e
> [[UX-0009 — normalizacao-shared-layout|UX-0009]].

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  navegação, ordem/itens de menu, `permission-modules`, lógica/estado de colapso,
  rota, comportamento, regra, dado, fetch, prop, evento ou cálculo**. O único tipo
  de mudança proposto (e **não aplicado** — esta spec não toca `src/`) é
  **dimensão/espaçamento responsivo por breakpoint**: elevar o hit-target dos
  controles interativos do shell para **≥44×44px em mobile** (`<lg`/`<sm`),
  **preservando a densidade desktop atual byte-a-byte** (`lg:` reafirma o valor
  hoje vigente).
- **Mobile-first aditivo, desktop congelado.** Toda mudança é **aditiva em
  classe utilitária base + neutralizada em `lg:`** (ou `sm:`). O DOM, a árvore de
  componentes, os seletores e a aparência **a ≥1024px (`lg`) não mudam** — é
  pré-condição da não-regressão E2E (o runner roda a **1500×1000**, ver §5).
- **Ganho concentrado em loja/chão; gestor/admin neutro.** Loja opera de pé no
  balcão (touch); gestor/admin operam denso no desktop. A spec **não degrada** a
  densidade desktop de nenhuma persona — só **adiciona respiro touch onde o
  viewport é estreito**, contexto onde loja/chão de fato operam.
- **Reuso-primeiro.** Consumir os tokens já commitados: `--spacing-rhythm-*`
  (UX-0005) para respiro, e as primitivas `Button`/`size` existentes
  ([[#1.4 Design system existente|§1.4]]) — **não criar variante de size nova**,
  **não reintroduzir opacidade ad-hoc** que a UX-0009 removeu, **não inventar
  breakpoint** fora do vocabulário da casa (`sm` / `lg`).
- **a11y AA é o objetivo, não efeito colateral.** WCAG 2.2 **2.5.8 Target Size
  (Minimum, AA, 24px)** já seria atendido; o alvo do projeto (**M7 ≥44×44px**,
  mais estrito que o mínimo AA, alinhado a Material/HIG para touch) governa.
  Foco visível (`focus-visible:ring` da `Button`), ordem de tab e
  `prefers-reduced-motion` **intactos**; banner read-only-tenant **preservado**
  (afordância desabilitada, não removida).
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior numa etapa posterior, **após aprovação
  explícita do usuário** (modo spec-only do Refinador).

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 auditoria
do design system existente → Fase 2 diagnóstico de UX/Responsivo → Fase 3 plano
**contra o sistema existente**, sem impor estilo novo; modo spec-only — nenhuma
edição de código). Regra operante da skill aqui: *"follow the existing breakpoint
vocabulary; don't introduce a new token; the result should feel like it always
belonged in this codebase — touch only what needs touching"*. Achado consolidado
(categoria **Responsivo**, achado **F-8**):

1. **Hit-target uniforme < alvo touch (Fitts / WCAG 2.5.8).** O shell aplica a
   **mesma densidade** para todas as personas. Os controles interativos do shell
   usam `size-icon-sm` (32px), `size-sm`/`h-8` (32px) ou nav-item `px-3 py-2.5`
   (~40px). Em **mobile** — onde **loja/chão** operam (balcão, celular, touch) —
   **nenhum** controle do shell atinge **≥44×44px** (M7). Gestor/admin operam no
   desktop e a densidade atual lá é adequada (não mexer).
2. **A divergência é por-contexto, não por-componente.** O motor confirma: não há
   "componente errado" — há **um breakpoint faltando**. O fix correto é
   **adicionar o degrau touch no viewport estreito e reafirmar o denso em `lg:`**,
   não trocar a primitiva. Isso mantém o desktop **byte-idêntico** (mandato) e
   concentra 100% do ganho em loja/chão (mobile), exatamente o recorte de F-8.
3. **`area-shell-layout` e `page-container` não têm controle interativo.**
   `area-shell-layout.tsx` é server-side puro (roteamento/redirect, zero JSX
   interativo); `page-container.tsx` é só `<main>` + padding. **Nenhum hit-target
   a corrigir** neles — entram só pela faceta "respiro do container <sm" (R-A).

> Conclusão do motor: **6 sítios de controle interativo do shell reprovam ≥44px
> em mobile** (tabela §1.3). O trabalho é **adição mecânica de degrau touch
> mobile + reafirmação `lg:` do valor atual** — risco baixo, concentrado no shell,
> sem cascata para telas internas (redesenho de tela = Onda 2/3).

### 1.2 Design system existente (Fase 1 da skill — baseline a respeitar)

- **Stack:** Next.js 16 (App Router; `app-shell`/`sidebar` `"use client"`,
  `area-shell-layout` server, `page-container` server) + Tailwind v4 (tokens via
  `@theme`/`:root` em `globals.css`) + shadcn/ui (`new-york`) + lucide.
- **Breakpoints em uso no shell:** **só `lg`** (`lg:grid`, `lg:flex`,
  `lg:hidden`, `lg:px-6`) e **`sm`** (`sm:max-w-sm` no Sheet, `sm:px-6` no
  container). Vocabulário da casa = **`sm` / `lg`**. `md`/`xl` **não** são usados
  no shell → **não introduzir** (regra da skill: seguir o vocabulário existente).
- **`Button`/size** (`src/components/ui/button.tsx:28-40`): `default` `h-10`;
  `sm` `h-8`; `lg` `h-11` (44px ✓); `icon` `size-10` (40px); `icon-sm` `size-8`
  (32px); `icon-lg` `size-11` (44px ✓). **Já existe** size com 44px (`lg` /
  `icon-lg`) → **reuso, não criar variante**. Foco: `focus-visible:ring-ring/45
  ring-[3px]` herdado por todo `Button` (a11y intacta ao trocar size).
- **Escala de espaçamento (UX-0005, `globals.css:69-76`):** `--spacing-rhythm-*`
  ancorada em `--space-unit`=4px. Degraus relevantes: `xs`=12px, `sm`=16px,
  `md`=24px. **Usar via classe Tailwind equivalente** (a casa não usa
  `var(--spacing-rhythm-*)` cru em `p-[…]` — usa o utilitário Tailwind do mesmo
  valor; ver UX-0009 §2.3, mesma decisão). Hit-target ≥44px = `min-h-11`/`h-11`
  (44px) — Tailwind `11`=2.75rem=44px, é a expressão canônica do alvo.
- **Idiomas do shell:** `cn()` para merge; `aria-label`+`title` em todo controle
  só-ícone; `Sheet` (Radix) para nav mobile; densidade desktop deliberada
  (sidebar `w-72`/`w-20` colapsada, nav `py-2.5`). Pós-UX-0009: opacidades já em
  `/[var(--opacity-*)]` — **não reverter para `/NN`**.

### 1.3 Inventário de controles interativos do shell (grep real — estado ATUAL, pós UX-0009)

> Hit-target calculado: Tailwind `1`=4px; `size-8`=32px, `size-10`=40px,
> `h-8`=32px, `h-11`=44px. Nav-item: `text-sm` line-height ≈20px + `py-2.5`
> (10px×2) ≈ **40px** de altura efetiva. Critério: **≥44×44px em mobile (M7)**.

| # | Arquivo:linha | Controle | Classe atual (dimensão) | Alt./alvo atual | Visível em | ≥44px mobile? |
|--:|---|---|---|---|:--:|:--:|
| 1 | `app-shell.tsx:55-64` | Trigger do menu mobile (`<Menu>`) | `Button size="icon-sm"` `lg:hidden` | **32×32** | **mobile só** (loja/chão) | ❌ **reprova** |
| 2 | `app-shell.tsx:77-85` | "Voltar ao painel master" (banner read-only) | `Button size="sm"` (`h-8`) | **h-32** | todas (admin-master) | ❌ **reprova** |
| 3 | `sidebar.tsx:199-220` | Itens de navegação (`<Link>` por módulo) | `navItemBaseClass` `px-3 py-2.5` | **≈40** | todas (mobile via Sheet) | ❌ **reprova** (borderline) |
| 4 | `sidebar.tsx:243-256` | "Meu Perfil" (`<Link>`, estado expandido) | `navItemBaseClass` `px-3 py-2.5` | **≈40** | todas (mobile via Sheet) | ❌ **reprova** (borderline) |
| 5 | `sidebar.tsx:258-268` | "Sair" / logout (`Button`, expandido) | `Button size="sm"` (`h-8`) `w-full` | **h-32** | todas (mobile via Sheet) | ❌ **reprova** |
| 6 | `sheet.tsx:69-71` (consumido pelo Sheet do shell) | Fechar nav mobile (`SheetPrimitive.Close`) | `p-1` + `size-4` ≈ **24×24** | **≈24** | **mobile só** (Sheet) | ❌ **reprova** |
| — | `sidebar.tsx:316-326` | Toggle colapsar/expandir (desktop) | `Button size="icon-sm"` (32) | 32×32 | **desktop só** (`lg:flex`) | ⚪ **fora de M7** (não-mobile; gestor/admin denso — **não mexer**) |
| — | `sidebar.tsx:273-297` | Perfil/Sair colapsados (`p-2` / `icon-sm`) | `p-2`/`size-8` (≈32) | ≈32 | **desktop só** (sidebar colapsada) | ⚪ **fora de M7** (estado colapsado **só existe em `lg:flex`**; mobile usa `collapsed={false}`) |

**Resultado: 6 controles interativos do shell reprovam ≥44×44px em viewport
mobile** (#1–#6). Os 2 itens "⚪" são **desktop-only por construção** (Sidebar
colapsada existe só no `desktopSidebar` `lg:flex`; o Sheet mobile chama
`<SidebarNav collapsed={false}>`, `sidebar.tsx:348`) → fora do recorte M7
(loja/chão **mobile**), **não tocar** (preserva densidade desktop gestor/admin).

### 1.4 Estado pós-UX-0009 (não reintroduzir o que foi normalizado)

UX-0009 (recém-aplicado nestes arquivos, em verificação) **só tokenizou sufixo de
opacidade** (`/70`→`/[var(--opacity-strong)]`, `/80`→`/[var(--opacity-prominent)]`
etc.) e **não tocou nenhuma dimensão/padding/hit-target** (UX-0009 §2/§7:
*"substituição mecânica … zero comportamento … page-container não tocado"*).
Confirmado lendo o estado ATUAL dos 4 arquivos:

- `app-shell.tsx` — opacidades já em `/[var(--opacity-strong)]`/`/[var(--opacity-border)]`/`/[var(--opacity-faint)]`; faixa `amber-*` intacta (UX-0009 §2.4 delegou). **Dimensões inalteradas pela UX-0009.**
- `sidebar.tsx` — opacidades com entrada exata já tokenizadas; `/45 /85 /90`
  **intactos** (UX-0009 R4 registrou como input p/ UX-0005). **Dimensões
  inalteradas.**
- `area-shell-layout.tsx`, `page-container.tsx` — **UX-0009 não os tocou**
  (sem opacidade ad-hoc; §1.2 J/K da UX-0009).

→ **UX-0010 é ortogonal à UX-0009**: UX-0009 = opacidade (cor); UX-0010 =
dimensão (espaço/alvo). Nenhuma sobreposição de linha-alvo. Risco de interação:
**baixo** — UX-0010 **não reescreve** as classes de opacidade tokenizadas pela
UX-0009 (só **adiciona** utilitário de tamanho/padding na mesma `className`).
Registrado em [[#6. Riscos & notas|§6]].

### 1.5 O que o `e2e/regression.py` asserta (rede de não-regressão M6)

Lido linha-a-linha (`e2e/regression.py`):

- **Viewport do runner: `{width: 1500, height: 1000}`** (`fresh()`, l.111) →
  **sempre `lg`** (≥1024). O shell mobile (`lg:hidden` trigger, Sheet) **nunca é
  exercitado** pelo E2E. Toda mudança UX-0010 é **mobile-first sob `lg:`** → a
  1500px o shell é **byte-idêntico** → **0 impacto E2E por construção**.
- **Seletores que o runner usa no shell:** `button[type=submit]` (login, fora do
  shell), `get_by_role("button", name=/Novo Pedido/)`, `get_by_text(...)`,
  `a[href*="/gestor-fabrica/..."]` (KPI cards de tela, não shell), navegação por
  `page.goto()` (URL direta — **não** clica item de sidebar). **Nenhum seletor
  depende de dimensão/classe do shell**; mudar `size`/`min-h`/`px` **não altera**
  texto, `role`, `href`, DOM nem rota. Confirmação em [[#4. Checklist "funcionalidade preservada"|§4]] e [[#5. Plano de verificação para o Front-End|§5]].
- **Asserts AJ** (`AJ-0001/0002/0005/0006/0013/0016/0017/0020`): todos por
  `inner_text`/`get_by_text`/`href` em **conteúdo de tela**, a 1500px — **fora do
  shell e fora do viewport mobile**. Intocados.

### 1.6 Diagnóstico priorizado (impacto × risco — motor `/ux-ui-refiner`)

| Prioridade | Sítio | Impacto (loja/chão mobile) | Risco desktop | Ação |
|--:|---|---|---|---|
| 1 | #1 trigger menu mobile (`lg:hidden`) | Alto — porta de entrada da nav touch; 32px | **Zero** (já `lg:hidden`) | `size-icon-sm`→`icon-lg` (44px); sem `lg:` (já não renderiza ≥lg) |
| 2 | #6 fechar Sheet (`p-1`) | Alto — 24px, pior alvo do shell, só mobile | **Zero** (Sheet só mobile) | Ampliar área de toque do `SheetPrimitive.Close` no **shell** (wrapper local) |
| 3 | #3/#4 nav-items + Meu Perfil | Alto — alvos primários da nav; ~40px | Médio (visível ≥lg também) | `min-h-11` base + `lg:min-h-0` (desktop volta a `py-2.5` denso) |
| 4 | #5 logout (expandido) | Médio — 32px | Médio (visível ≥lg) | `size="sm"`→responsivo: `h-11` base + `lg:h-8` |
| 5 | #2 "Voltar ao painel master" | Baixo — admin-master, raro, banner | Baixo (admin-master desktop) | `size="sm"`→`h-11` base + `lg:h-8` |
| — | R-A respiro container/Sheet `<sm` | Médio — densidade de borda touch | **Zero** (só `<sm`) | `px`/`py` base maior + `sm:`/`lg:` volta ao atual |

---

## 2. Spec de refinamento

> **Padrão único (regra de ouro da spec):** *base = touch (≥44px) · `lg:` (ou
> `sm:`) = reafirma o valor desktop ATUAL byte-a-byte.* Assim o desktop não muda
> (mandato + E2E a 1500px) e loja/chão mobile ganham o alvo. Toda classe `lg:`
> abaixo **repete o valor que o arquivo já tem hoje** — não é densificação nova,
> é **trava de não-regressão desktop**.

### 2.1 `app-shell.tsx` — trigger do menu mobile (sítio #1)

- **Atual** (l.55-64): `<Button size="icon-sm" className="fixed top-4 left-4 z-30 lg:hidden" …>` → 32×32, **só renderiza `<lg`** (loja/chão mobile).
- **Ajuste:** `size="icon-sm"` → **`size="icon-lg"`** (reuso da variante
  existente = `size-11` = **44×44** ✓, `button.tsx:36`). **Sem `lg:`** — o
  elemento já é `lg:hidden`, então **não existe** a ≥lg → **zero risco desktop,
  zero impacto E2E** (runner a 1500px nunca o vê).
- **Diff conceitual (NÃO aplicar):**
  ```
  - <Button type="button" variant="outline" size="icon-sm"
  + <Button type="button" variant="outline" size="icon-lg"
      className="fixed top-4 left-4 z-30 lg:hidden" … aria-label="Abrir navegação">
  -   <Menu className="size-5" />
  +   <Menu className="size-5" />   {/* ícone inalterado; size-lg dá 44px de alvo */}
  ```
- **Adota:** variante `icon-lg` (44px, já existe). **Delega:** nada.

### 2.2 Sheet do shell — botão fechar nav mobile (sítio #6)

- **Atual:** o `SheetContent` (`src/components/ui/sheet.tsx:69-71`) renderiza um
  `SheetPrimitive.Close` com `p-1` + `<XIcon className="size-4">` ≈ **24×24**.
  É **primitivo compartilhado** (consumido por outras telas).
- **Fronteira (regra da skill — não reescrever primitivo compartilhado num item
  de shell):** **NÃO** alterar `sheet.tsx` (cascataria para todo Sheet do app =
  fora do escopo "shell"; possível item próprio futuro). **Adota** a estratégia:
  no **shell** (`sidebar.tsx`, ramo `Sheet`), **renderizar um `SheetClose`
  explícito** com alvo ≥44px **dentro** do `SheetContent` da nav — `SheetClose`
  já é exportado por `sheet.tsx:113` (reuso-primeiro, zero primitivo novo). O
  Close default do `SheetContent` continua existindo (não removido — afordância
  preservada); o shell **adiciona** um alvo touch acessível.
- **Diff conceitual (NÃO aplicar — em `sidebar.tsx`, ramo mobile l.343-349):**
  ```
    <SheetContent side="left" className={cn("w-[90%] p-0 sm:max-w-sm", className)}>
      <SheetHeader className="sr-only"> … </SheetHeader>
  +   {/* alvo de fechar touch ≥44px — só mobile (Sheet só existe <lg) */}
  +   <SheetClose
  +     aria-label="Fechar navegação"
  +     className="absolute right-3 top-3 z-10 inline-flex size-11 items-center
  +                justify-center rounded-lg text-muted-foreground
  +                hover:bg-secondary focus-visible:ring-ring/45
  +                focus-visible:ring-[3px] focus-visible:outline-none"
  +   >
  +     <X className="size-5" />
  +   </SheetClose>
      <SidebarNav navigationContext={…} collapsed={false} onNavigate={onMobileClose} />
    </SheetContent>
  ```
  (`SheetClose` importado de `@/components/ui/sheet`; `X` de `lucide-react` — já
  em uso no projeto. `size-11`=44px. Sem `lg:` — Sheet só existe `<lg`.)
- **Adota:** `SheetClose` (já exportado). **Delega:** redesenhar o Close default
  do `sheet.tsx` (primitivo compartilhado — **fora**; nota p/ Onda 2/Dívida).

### 2.3 `sidebar.tsx` — itens de navegação + "Meu Perfil" (sítios #3, #4)

- **Atual:** `navItemBaseClass` (l.98-99) = `… flex items-center gap-3 rounded-lg
  px-3 py-2.5 text-sm …` → altura efetiva ≈40px. Usado por: itens de nav
  (l.203-211), "Meu Perfil" expandido (l.246-252).
- **Ajuste (no `navItemBaseClass`, fonte única — propaga aos dois sítios):**
  adicionar **`min-h-11`** (44px, garante o alvo touch sem mudar tipografia/ícone)
  na base + **`lg:min-h-0`** (desktop volta ao comportamento atual exato —
  altura governada por `py-2.5`/conteúdo, **byte-idêntico** ao de hoje).
- **Por que `min-h` e não trocar `py`:** trocar `py-2.5` mudaria a densidade
  **também no desktop** (regressão proibida) e mexeria no ritmo visual da nav.
  `min-h-11` só **expande até 44px se o conteúdo for menor** — em mobile garante o
  alvo; em `lg:` `min-h-0` desliga, desktop intacto. Tab order, foco
  (`focus-visible` herdado), `active`/`hover`, `before:` indicador ativo,
  `title`, `onClick={onNavigate}` — **todos inalterados** (só +2 utilitários de
  altura mínima na string base).
- **Diff conceitual (NÃO aplicar — l.98-99):**
  ```
  - const navItemBaseClass =
  -   "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[…]";
  + const navItemBaseClass =
  +   "group relative flex min-h-11 lg:min-h-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[…]";
  ```
  (Demais classes da string — `transition-[…]`, `duration-300`, `ease-out` —
  **inalteradas**; só inserido `min-h-11 lg:min-h-0`.)
- **Adota:** `min-h-11`/`lg:min-h-0` (escala Tailwind = UX-0005 `--space-unit`
  ×11=44px). **Delega:** nada.

### 2.4 `sidebar.tsx` — logout "Sair" expandido (sítio #5)

- **Atual** (l.258-268): `<Button size="sm" … className="mt-2 w-full
  justify-start …">` → `h-8` = 32px.
- **Ajuste:** manter `size="sm"` (não trocar a variante — `lg` mudaria
  tipografia/padding e densificaria o desktop) e **adicionar altura responsiva
  via className**: `h-11 lg:h-8` (base 44px touch; `lg:` reafirma o `h-8`=32px
  atual do `size="sm"` → desktop **byte-idêntico**). `disabled={loggingOut}`,
  texto "Saindo…", ícone, `w-full` — **intactos**.
- **Diff conceitual (NÃO aplicar — l.258-265):**
  ```
    <Button type="button" variant="ghost" size="sm" onClick={handleLogout}
      disabled={loggingOut}
  -   className="mt-2 w-full justify-start text-muted-foreground hover:text-foreground">
  +   className="mt-2 h-11 w-full justify-start text-muted-foreground hover:text-foreground lg:h-8">
  ```
- **Adota:** `h-11`/`lg:h-8` (alvo + trava desktop). **Delega:** o **logout
  colapsado** (`size="icon-sm"`, l.285-296) e **Meu Perfil colapsado**
  (`p-2`, l.273-283) — estado colapsado **só existe em `lg:flex`** (desktop;
  Sheet mobile usa `collapsed={false}`) → **fora de M7**, densidade desktop
  gestor/admin **preservada** (não tocar).

### 2.5 `app-shell.tsx` — "Voltar ao painel master" (sítio #2)

- **Atual** (l.77-85): `<Button size="sm" disabled={isLeavingReadOnly} …>` no
  banner read-only-tenant (admin-master) → `h-8` = 32px.
- **Ajuste:** mesmo padrão de #5 — `h-11 lg:h-8` via className (base touch;
  `lg:` reafirma desktop atual). `disabled`/`onClick={handleLeaveReadOnly}` e
  **toda a faixa read-only intacta** (afordância preservada; UX-0009 §2.4 já
  manteve `amber-*` — não reverter).
- **Diff conceitual (NÃO aplicar — l.77-85):**
  ```
    <Button type="button" variant="outline" size="sm"
      disabled={isLeavingReadOnly} onClick={handleLeaveReadOnly}
  +   className="h-11 lg:h-8"
    >
      Voltar ao painel master
    </Button>
  ```
- **Adota:** `h-11`/`lg:h-8`. **Delega:** nada.

### 2.6 Respiro do container / Sheet em viewport estreito (R-A — `area-shell-layout` / `page-container`)

- **`area-shell-layout.tsx`:** server component de roteamento — **zero JSX
  interativo, nenhum hit-target, sem padding próprio**. **Nada a fazer**
  (registrado; cobertura completa dos 4 arquivos-alvo do escopo).
- **`page-container.tsx`** (l.11-14): `mx-auto w-full max-w-[1320px] px-4 py-6
  sm:px-6 lg:px-8 lg:py-8` — **já é escala 4/8 canônica e mobile-first**
  (`px-4`=16px em `<sm`). UX-0009 §1.2-K confirmou "nada a fazer". O respiro
  base já é adequado para touch (16px lateral, 24px vertical em `<sm`).
  **Recomendação: NÃO mudar** (qualquer aumento mexeria no enquadramento de
  **toda** tela = fora do escopo "hit-target do shell", vira polimento de tela =
  Onda 2/3). Registrado como **adota = status quo / delega o resto**.
- **Sheet do shell** (`sidebar.tsx:343`): `w-[90%] p-0 sm:max-w-sm` — `p-0` é
  intencional (o `SidebarNav` interno tem o próprio padding `p-3`/`p-4`, l.178/227).
  O alvo de fechar (§2.2) e os nav-items (§2.3) já resolvem o hit-target dentro
  do Sheet; o respiro interno do `SidebarNav` (`p-3`/`p-4` = 12/16px) é
  **adequado para touch em `<sm`** (≥`--spacing-rhythm-xs`). **Não mudar**
  (mexer densificaria a sidebar **também no desktop**, l.178/227 são
  compartilhados com `desktopSidebar`).

### 2.7 Fronteira — o que UX-0010 ADOTA vs DELEGA (explícito)

| Item | UX-0010 | Por quê |
|---|:--:|---|
| 6 controles do shell (#1–#6) → ≥44px em mobile | ✅ **adota** | É o escopo F-8/M7: dimensão/hit-target responsiva no shell. |
| Densidade **desktop** (≥lg) de qualquer persona | ⚪ **congela** | Todo ajuste tem `lg:`/`sm:` que reafirma o valor ATUAL → byte-idêntico. Mandato + E2E a 1500px. |
| Toggle colapsar, perfil/logout **colapsados** | ❌ **delega/N-A** | Estado colapsado só existe `lg:flex` (desktop); mobile usa `collapsed={false}`. Fora de M7. Densidade gestor/admin preservada. |
| Redesenhar o Close default do `sheet.tsx` | ❌ **delega** | Primitivo **compartilhado** — cascata p/ todo Sheet do app. Fora de "shell". Nota p/ Onda 2/[[Dívida Técnica]]. UX-0010 só **adiciona** `SheetClose` local. |
| Navegação, ordem/itens de menu, `permission-modules` | ❌ **fora** | Guard-rail [[12 - Iniciativa UX/README|README]] / [[UX PRD#4. Não-objetivos (escopo fora — confirmado com o usuário)|PRD §4]]. |
| Lógica/estado de colapso (`useState collapsed`), rota | ❌ **fora** | Sem mudança funcional/estado. Só `className`. |
| Opacidades tokenizadas pela UX-0009 | ⚪ **preserva** | Não reverter `/[var(--opacity-*)]`→`/NN`; só **adicionar** utilitário de dimensão na mesma string. |
| Faixa read-only-tenant (afordância) | ⚪ **preserva** | Só altura do botão (#2) base/`lg:`; `disabled`/`amber-*`/texto intactos. |
| Redesenho de telas internas (loja/pedidos etc.) | ❌ **fora** | Fronteira explícita: UX-0010 = densidade/hit-target do **shell**. Telas = Onda 2/3. |

---

## 3. Cobertura de estados / a11y / responsivo

### 3.1 Hit-target (WCAG 2.5.8 AA + M7 ≥44×44px)

- **Pós-spec, em mobile (`<lg`/`<sm`):** #1 = 44×44 (`icon-lg`); #2/#5 = h-44
  (`h-11`); #3/#4 = min-44 (`min-h-11`); #6 = 44×44 (`SheetClose size-11`).
  **6/6 ≥44px → M7 ✓.** WCAG 2.5.8 (24px mín) folgadamente atendido.
- **Desktop (≥lg):** todos revertem ao valor ATUAL via `lg:`/`sm:`
  (`min-h-0`/`h-8`/`icon-sm`-equivalente) → densidade gestor/admin **idêntica**.

### 3.2 Acessibilidade (WCAG 2.2 AA — guard-rail)

- **Foco visível:** todos os `Button` herdam `focus-visible:border-ring
  ring-ring/45 ring-[3px]` (`button.tsx:12`) — **inalterado** (trocar `size`/`h`
  não toca o anel). O `SheetClose` adicionado (§2.2) **inclui**
  `focus-visible:ring-ring/45 ring-[3px]` explícito (paridade com `Button`).
- **Ordem de tab:** **intacta** — nenhuma reordenação de DOM, nenhum
  `tabIndex`, nenhum elemento adicionado **antes** do conteúdo focável
  existente (o `SheetClose` §2.2 entra logo após `SheetHeader` `sr-only`,
  posição natural "fechar primeiro" — não desloca a sequência da nav).
- **Nome acessível:** `aria-label`/`title` de todos os controles só-ícone
  **preservados**; `SheetClose` novo recebe `aria-label="Fechar navegação"`.
- **`prefers-reduced-motion`:** nenhuma transição nova introduzida; as
  existentes (`transition-[…]` da nav, `hover:translate-x-0.5`) **não tocadas**.
  Não há regressão de movimento (spec só mexe em dimensão estática).
- **Contraste:** **nenhuma cor alterada** (só dimensão) → herda UX-0006/UX-0009
  byte-a-byte. `SheetClose` novo usa `text-muted-foreground`/`hover:bg-secondary`
  (tokens já validados, idênticos ao Close do `sheet.tsx`).

### 3.3 Responsivo (breakpoints narrow / tablet / desktop)

| Viewport | Largura | Shell | Hit-target |
|---|---|---|---|
| **Narrow (mobile)** | 360px | Sidebar = `Sheet` (`lg:hidden`); trigger `app-shell` visível | **≥44px** (#1 44, #3/#4 44, #5 44, #6 44; #2 44 se admin-master) |
| **Tablet** | 768px | Ainda `<lg` → Sheet + trigger; container `sm:px-6` | **≥44px** (mesmas regras `<lg`; `min-h-11` ativo) |
| **Desktop** | 1280px / 1500px | `lg:` ativo → sidebar fixa, sem trigger/Sheet; `lg:min-h-0`/`lg:h-8` | **densidade ATUAL** (32/40px) — gestor/admin denso preservado; E2E a 1500px byte-idêntico |

Limiar: o salto touch→denso ocorre em **`lg` (1024px)**, o mesmo limiar que o
shell **já usa** para trocar Sidebar↔Sheet (`lg:hidden`/`lg:flex`,
`app-shell.tsx:45-52`). **Nenhum breakpoint novo** — o degrau touch coincide
exatamente com o ponto onde o shell já muda de layout. `sm` reusado só no R-A
(status quo, não alterado).

### 3.4 Read-only-tenant

Faixa `app-shell.tsx:65-93` **preservada**: só a **altura** do botão "Voltar ao
painel master" (#2) ganha `h-11 lg:h-8`. `disabled={isLeavingReadOnly}`,
`onClick`, `leaveReadOnlyError`, paleta `amber-*` (UX-0009 §2.4), `data-app-*`
attrs — **intactos**. Afordância **desabilitada quando aplicável, nunca
removida**.

---

## 4. Checklist "funcionalidade preservada"

### 4.1 Desktop com densidade idêntica
- [ ] Todo ajuste tem `lg:` (ou `sm:`) que **reafirma o valor ATUAL**: #1 não
      renderiza ≥lg (`lg:hidden`); #3/#4 `lg:min-h-0`; #5/#2 `lg:h-8`; R-A status
      quo. → aparência **≥lg byte-idêntica** à de hoje.
- [ ] Sidebar `w-72`/`w-20`, nav `py-2.5`, paddings `p-3`/`p-4` **inalterados**
      no desktop (não tocados; só `min-h` que `lg:min-h-0` neutraliza).
- [ ] Toggle colapsar + perfil/logout colapsados **não tocados** (desktop-only).

### 4.2 Nav / itens / colapso / rotas intactos
- [ ] `navigationContext`, `sections`, `item.route`, `item.label`,
      `permission-modules` — **nenhuma** mudança (só `className`/`size`).
- [ ] Lógica de colapso (`useState collapsed`, `setCollapsed`), estado
      `mobileOpen`, `onMobileClose`, `handleLogout`, `handleLeaveReadOnly` —
      **byte-idênticos**.
- [ ] Ordem/itens de menu, `before:` indicador ativo, `title`,
      `onClick={onNavigate}` — **inalterados**.

### 4.3 Só dimensão responsiva / E2E desktop intacto
- [ ] Diff só toca `className`/prop `size` de controles do shell + adiciona 1
      `SheetClose` (reuso de export existente). **Zero** prop de dado, evento,
      fetch, rota, cálculo, texto de UI, DOM semântico.
- [ ] Opacidades UX-0009 (`/[var(--opacity-*)]`) **não revertidas**; nenhum
      `/NN` ad-hoc reintroduzido.
- [ ] `e2e/regression.py` (viewport 1500px = `lg`): seletores
      `button[type=submit]`/`get_by_role`/`get_by_text`/`href`/`page.goto`
      **não dependem** de dimensão do shell; a ≥lg shell byte-idêntico → **0
      FAIL esperado, PASS ≥ baseline (26)**. (Runner: orquestrador.)

---

## 5. Plano de verificação para o Front-End

> Executado pelo agente Front-End Sênior **após aprovação** desta spec. Gate 1
> (ver [[UX PRD#7. Plano em fases]]); âncora M6/M7. Runner versionado em
> `e2e/regression.py` (D-0 do Gate 0; ver [[e2e-playwright-setup]] na memória).

1. **Estático:** `npm run lint` (0 erro) · `npx tsc --noEmit` (exit 0) ·
   `npm test` (sem regressão). Esperado verde — mudança é só `className`/`size`.
2. **E2E não-regressão (M6 — âncora):** `python e2e/regression.py` →
   **0 FAIL e PASS ≥ 26** (baseline atual). Como o runner roda a **1500×1000
   (`lg`)** e todo ajuste é `lg:`-neutralizado, o shell é **byte-idêntico** lá →
   nenhum seletor (`button[type=submit]`, `get_by_role`, `href`, `page.goto`)
   afetado. **Qualquer FAIL = parada + rollback** do item (regra do plano).
3. **Smoke responsivo M7 — medir hit-target em loja/chão mobile:** logar como
   **`loja`** e **`chao`** (credenciais do runner) em **360, 768, 1280**:
   - `<lg` (360/768): abrir nav (trigger #1), medir #1, #3/#4 (nav-items),
     #5 (Sair), #6 (fechar Sheet) — **todos ≥44×44px** (DevTools box model /
     `getBoundingClientRect`). Logar como **`admin-master`** p/ medir #2 no
     banner read-only.
   - `1280` (`lg`): confirmar sidebar fixa, **sem** trigger/Sheet, nav
     `py-2.5`/`h-8` **idêntico ao baseline** (canário de densidade desktop).
4. **Smoke 6 personas (Gate 1):** `master/admin/dados/fabrica/chao/loja` em
   360/768/1280 — shell carrega, nav funciona, **sem overflow/quebra**;
   gestor/admin a 1280 **visualmente idênticos** ao pré-UX-0010 (densidade
   preservada — checklist §4.1).
5. **Canário desktop:** 1 tela densa não-relacionada (ex.: `gestor-fabrica`
   dashboard) a 1500px — enquadramento/sidebar idênticos (prova de não-cascata).
6. **Autorreview:** preencher checklist §4 (100% marcado) + registrar no
   [[10 - Changelog Vivo/2026-05|Changelog do mês]] (template em
   `Docs/10 - Changelog Vivo/Template — Entrada de Changelog.md`); status
   `UX-0010` → `Concluído` no [[Backlog UX (RICE)]]. Commit isolado `UX-0010`,
   revertível (`git revert` restaura `className`/`size` sem colateral — diff
   atômico, sem dependência de outro item).

---

## 6. Riscos & notas

| Risco | Prob. | Impacto | Mitigação |
|---|:--:|:--:|---|
| `lg:`-reafirmação esquecida em algum sítio → densidade desktop regride (gestor/admin) | Baixa | Médio | Regra de ouro §2 (todo ajuste tem par `lg:`/`sm:`); canário desktop §5.5; checklist §4.1; E2E a 1500px pega quebra de seletor (não de pixel — daí o smoke visual §5.4). |
| Interação com UX-0009 (recém-aplicado nestes 4 arquivos) | Baixa | Baixo | Ortogonal: UX-0009 = sufixo de opacidade (cor); UX-0010 = utilitário de dimensão. **Não** reescrever as classes `/[var(--opacity-*)]` — só **adicionar** `min-h-11`/`h-11`/`size`/`lg:` na mesma `className` (concat, sem conflito de utilitário Tailwind). §1.4. |
| `min-h-11` empurra layout da sidebar mobile (scroll) | Baixa | Baixo | `nav` já é `overflow-y-auto` (`sidebar.tsx:178`); +4px/item em mobile é o trade-off touch desejado (F-8). `lg:min-h-0` evita qualquer efeito desktop. |
| `SheetClose` adicional duplica afordância de fechar (já há o Close default do `sheet.tsx`) | Baixa | Baixo | Intencional — o default (24px) **não** é removido (afordância preservada); o novo é o alvo touch ≥44px. Redesenhar o default = item próprio (delegado §2.2/§2.7). |
| Escopo escorrega p/ densificar tela interna | Baixa | Médio | Fronteira explícita §2.7 + mandato: UX-0010 = **shell** só; container/Sheet interno = status quo (§2.6); telas = Onda 2/3. |
| Runner E2E não cobre viewport mobile (só 1500px) | — | — | **Por construção** o E2E não exercita o shell mobile; por isso o ganho M7 é validado pelo **smoke responsivo manual §5.3** (loja/chão em 360/768). E2E garante só a **não-regressão desktop** (que é o que ele cobre). Aceito — alinhado a como M7 é medido no [[UX PRD]] (inspeção do shell em breakpoint mobile). |

**Notas:**
- **Nenhum primitivo/token novo.** Reuso de `Button size="icon-lg"`/escala
  Tailwind `11` (=44px, = UX-0005 `--space-unit`×11) + `SheetClose` já exportado.
- **`/45 /85 /90` da sidebar** (UX-0009 R4, input p/ UX-0005) **não tocados** —
  UX-0010 não mexe em opacidade.
- **Cross-link:** `page-container.tsx`/`area-shell-layout.tsx` confirmados
  **sem ação** (não-interativos); cobertura dos 4 arquivos-alvo completa
  (escopo fechado).
- **Fronteira final:** redesenho do Close do `sheet.tsx` e densidade da sidebar
  colapsada desktop → **fora**; registrados como possível nota para
  [[Dívida Técnica]]/Onda 2 (não criam item UX por si).

---

## 7. Autorreview (Front-End)

> Implementação aplicada pelo agente Front-End Sênior (2026-05-19, loop autônomo
> Onda 1, **último item**). `/frontend-design` aplicado como metodologia. Estado
> ATUAL lido linha-a-linha pós-UX-0009 (linhas deslocaram vs. §1.3 por causa do
> bloco de import da UX-0009, mas os sítios são inequívocos — verificados por
> conteúdo, não por número de linha). **Zero primitivo/token novo.**

### 7.1 Diff por arquivo (`git diff --name-only -- src/` → exatamente 2)

Só `src/components/layout/app-shell.tsx` e `src/components/layout/sidebar.tsx`
alterados. `area-shell-layout.tsx`/`page-container.tsx` **não tocados** (§2.6
status quo — não-interativos). Nada além dos 4 arquivos-alvo; só 2 deles mudam.

**`app-shell.tsx`** (2 sítios):
| Sítio | Antes | Depois | Prova desktop byte-equiv. |
|---|---|---|---|
| #1 trigger menu mobile | `size="icon-sm"` (32px) | `size="icon-lg"` (44px) | Elemento é `lg:hidden` → **não existe a ≥lg**. Sem `lg:` necessário. Zero render desktop. |
| #2 "Voltar ao painel master" | `size="sm"` (`h-8`=32px) | `size="sm"` + `className="h-11 lg:h-8"` | `lg:h-8` reafirma o `h-8` que o `size="sm"` já dava → ≥1024px **idêntico** (mesma altura computada 32px). |

**`sidebar.tsx`** (4 sítios + 1 import):
| Sítio | Antes | Depois | Prova desktop byte-equiv. |
|---|---|---|---|
| import | `lucide-react` s/ `X`; `sheet` s/ `SheetClose` | `+X` (lucide já dep, idioma do arquivo) `+SheetClose` (export já existente `sheet.tsx:113`) | Sem efeito de render; só símbolos. |
| #3/#4 nav-items + "Meu Perfil" | `navItemBaseClass` `px-3 py-2.5` (≈40px) | `+min-h-11 lg:min-h-0` | `lg:min-h-0` desliga o `min-h` a ≥lg → altura volta a ser governada por `py-2.5`/conteúdo, **idêntica** ao atual. `px-3 py-2.5` **não tocados**. |
| #5 logout "Sair" | `size="sm"` (`h-8`) | `size="sm"` + `className="mt-2 h-11 … lg:h-8"` | `lg:h-8` reafirma `h-8` do `size="sm"` → ≥lg **idêntico**. `mt-2 w-full justify-start text-muted-foreground hover:text-foreground` preservados. |
| #6 fechar nav mobile | (só o Close default 24px do `sheet.tsx`) | `+<SheetClose size-11>` no ramo `Sheet` | Inserido **dentro** do `SheetContent` (só renderiza `<lg`). Sem `lg:` — Sheet não existe ≥lg. Close default **não removido** (afordância preservada). |

`git diff -U0` confirma: **nenhuma** linha de opacidade `/[var(--opacity-*)]`
(UX-0009) reescrita; **nenhuma** mudança de prop de dado/evento/fetch/rota/
cálculo/texto de UI/DOM semântico. Só `className`/`size` + 1 `SheetClose` (reuso)
+ 2 símbolos de import.

### 7.2 Prova de preservação desktop (≥1024px `lg` — onde o E2E roda a 1500px)

Garantia de byte-equivalência: **toda** mudança ou (a) está em elemento
`lg:hidden`/dentro do `Sheet` que **não renderiza a ≥lg** (#1, #6 → zero DOM
desktop), ou (b) tem par `lg:` que **repete o valor que o arquivo já tinha hoje**
(#2/#5 `lg:h-8` = o `h-8` do `size="sm"`; #3/#4 `lg:min-h-0` neutraliza o
`min-h-11`, devolvendo a governança de altura ao `py-2.5` intacto). Nenhum
`px`/`py`/`gap`/tipografia/ícone/cor desktop foi alterado. A 1500px (`lg`) o DOM,
seletores, classes computadas e aparência são **idênticos** ao pré-UX-0010 →
seletores do `e2e/regression.py` (`button[type=submit]`, `get_by_role`,
`get_by_text`, `href`, `page.goto`) **não afetados** (§1.5).

### 7.3 Hit-targets mobile resultantes (`<lg`/`<sm`) — M7 ≥44×44px

| # | Controle | Antes (mobile) | Depois (mobile) | ≥44px? |
|--:|---|---|---|:--:|
| 1 | Trigger menu mobile | 32×32 | **44×44** (`icon-lg`=`size-11`) | ✅ |
| 2 | "Voltar ao painel master" | h-32 | **h-44** (`h-11`) | ✅ |
| 3 | Itens de navegação | ≈40 | **min-44** (`min-h-11`) | ✅ |
| 4 | "Meu Perfil" | ≈40 | **min-44** (`min-h-11`) | ✅ |
| 5 | "Sair" / logout | h-32 | **h-44** (`h-11`) | ✅ |
| 6 | Fechar nav mobile | ≈24×24 | **44×44** (`SheetClose size-11`) | ✅ |

**6/6 ≥44×44px → M7 ✓.** `SheetClose` novo inclui
`focus-visible:ring-ring/45 ring-[3px]` (paridade com `Button`), `aria-label`,
ordem de tab natural ("fechar primeiro", logo após `SheetHeader sr-only` —
não desloca a sequência da nav). Nenhuma transição nova → `prefers-reduced-motion`
intacto. Nenhuma cor alterada (herda UX-0006/UX-0009).

### 7.4 Checklist §4 "funcionalidade preservada" (100%)

**§4.1 Desktop densidade idêntica**
- [x] Todo ajuste tem `lg:`/`sm:` que reafirma o ATUAL: #1 não renderiza ≥lg;
      #3/#4 `lg:min-h-0`; #5/#2 `lg:h-8`; R-A status quo → ≥lg byte-idêntico.
- [x] Sidebar `w-72`/`w-20`, nav `py-2.5`, paddings `p-3`/`p-4` inalterados no
      desktop (`min-h-11` neutralizado por `lg:min-h-0`).
- [x] Toggle colapsar + perfil/logout colapsados não tocados (desktop-only).

**§4.2 Nav / itens / colapso / rotas intactos**
- [x] `navigationContext`/`sections`/`item.route`/`item.label`/
      `permission-modules` — nenhuma mudança (só `className`/`size`).
- [x] `useState collapsed`/`setCollapsed`/`mobileOpen`/`onMobileClose`/
      `handleLogout`/`handleLeaveReadOnly` — byte-idênticos.
- [x] Ordem/itens de menu, `before:` indicador ativo, `title`,
      `onClick={onNavigate}` — inalterados.

**§4.3 Só dimensão responsiva / E2E desktop intacto**
- [x] Diff só toca `className`/`size` do shell + 1 `SheetClose` (reuso de export)
      + 2 símbolos de import. Zero dado/evento/fetch/rota/cálculo/texto/DOM.
- [x] Opacidades UX-0009 não revertidas; nenhum `/NN` ad-hoc reintroduzido.
- [x] `e2e/regression.py` (1500px=`lg`): seletores não dependem de dimensão do
      shell; ≥lg byte-idêntico → 0 FAIL esperado (runner: orquestrador).

### 7.5 Verificação estática (executada por este agente)

- `npm run lint` → **0 erros** (6 warnings **pré-existentes e não-relacionados**:
  `gestor-dados`/`loja` unused-vars, `sidebar.tsx:169` `<img>` do logo do tenant
  pré-existente — linha deslocou pelo bloco de import, código não tocado;
  `product-form-dialog` unused-disable). **Nenhum warning novo introduzido.**
- `npx tsc --noEmit` → **exit 0**.
- `npm test` → **110 pass / 0 fail**.
- **NÃO** executados (orquestrador): `npm run build`, `e2e/regression.py`.

**Conclusão:** escopo fechado nos 2 arquivos que a spec efetivamente altera;
desktop provado byte-equivalente a ≥lg; 6/6 hit-targets mobile ≥44px; checklist
§4 100% ✅; estático verde sem regressão. Sem desvio da spec.
