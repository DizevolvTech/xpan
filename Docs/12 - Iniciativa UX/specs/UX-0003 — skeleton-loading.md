# UX-0003 — Primitivo `skeleton.tsx` + adoção no DataTable/KPI

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner`). Companheira de [[Backlog UX (RICE)]] (item l.33 e l.76-80),
> [[UX PRD]] (critérios "Estado", §6; métrica **M2**; resolução Gate 0 §10),
> [[UX Audit — Sistema]] (achado [[UX Audit — Sistema#F-2 — Sem skeletons; carregamento textual e CLS · 🔴 · Estado|F-2]]).
> Convenção: [[12 - Iniciativa UX/README|README]]. Consome
> [[UX-0005 — escala-espacamento-opacidade|UX-0005]] (tokens `--opacity-*` /
> `--spacing-rhythm-*`, já commitado). Espelha os primitivos
> [[UX-0002 — sistema-toast-feedback|UX-0002]] (`shared/toast.tsx`,
> `shared/confirm-dialog.tsx`, commitados).

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, navegação nem `permission-modules`**.
  O skeleton só substitui **o que se vê enquanto `isLoading === true`** — o
  **estado final renderizado é byte-a-byte o mesmo de hoje**. Não muda **quando**
  nem **se** o dado chega; só **como o vazio é comunicado** durante a espera.
- **Reuso-primeiro.** Antes de criar, verifiquei os 18 shared + 18 `ui/` + as
  deps: **não existe `Skeleton`** em `src/components/` (grep `Skeleton`/`skeleton`
  = 0 ocorrências de componente; só os 43 sítios de texto "Carregando…"). shadcn
  `Skeleton` **não está instalado** (`src/components/ui/` não o contém). O
  primitivo é **CSS puro + tokens** — **zero dependência nova** (não usa Radix,
  não usa `framer-motion`; `animate-pulse` é utilitário nativo do Tailwind 4).
- **Só apresentação do estado de carga.** O escopo é (a) criar **um**
  `src/components/shared/skeleton.tsx` e (b) adotá-lo **somente** em
  `src/components/shared/data-table.tsx` (bloco `isLoading`, l.208-217) e
  `src/components/shared/kpi-card.tsx` (valor `"..."`). **Nenhuma** outra tela é
  tocada neste item — a adoção tela-a-tela ampla (os ~41 sítios de texto
  "Carregando…" fora desses dois primitivos) é [[Backlog UX (RICE)|UX-0009]] /
  Onda 2/3 (fronteira explícita em §2.6).
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa
  posterior, **após aprovação explícita do usuário**. Esta spec **não toca
  `src/`**.
- **Não regredir o `e2e/regression.py`.** O runner (ver §1.4) **não asserta**
  estado de carga — asserta **texto/seletor pós-carga** (`Acompanhamento`,
  `table thead th`, colunas Kanban, `a[href*=…]` de KPI, marcadores AJ). O
  skeleton **não pode** alterar nenhum seletor/texto do DOM final nem introduzir
  a substring `"error"` no `body()` (o smoke `screen_ok` reprova se o body contém
  `"error"`). Detalhe em §4 / §5.
- **Pré-requisito de tela:** [[Backlog UX (RICE)|UX-0014]]
  (`gestor-fabrica/page.tsx` dashboard) e o polimento por-tela da Onda 2/3
  **consomem** o primitivo definido aqui. UX-0003 entrega o primitivo + a
  adoção nos **dois** primitivos compartilhados; a troca dos textos
  "Carregando…" tela-a-tela é dos itens posteriores.

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 auditoria
do sistema de design existente → Fase 2 diagnóstico → Fase 3 plano contra o
sistema existente; nenhuma edição de código — modo spec-only). Achados
consolidados (categoria **Estado**, achado **F-2**):

1. **Estado de loading não-estruturado** (checklist da skill, *States* →
   *"Loading — replace content with a skeleton; don't show stale data"*; *"Skeleton
   preferred for content — mirrors the layout that's coming. No layout shift when
   data arrives"*). Hoje o sistema usa **texto "Carregando…"** ou um **spinner +
   texto** que **não tem a forma do conteúdo** — quando o dado chega, a caixa
   muda de altura/forma → **layout shift (CLS)**.
2. **`"..."` como valor de KPI** (skill, *"Don't show stale data with a tiny
   spinner"* / *missing states*): o `KPICard` recebe a **string literal `"..."`**
   no lugar do número. O glifo tem largura ≈3 caracteres; o número real
   (`metrics.totalOrders`, `compactValue`) pode ter 1–6+ caracteres → a tipografia
   `clamp(1.3rem,1.7vw,1.55rem)` reflowa **horizontalmente** quando o dado chega.
3. **Sem vocabulário de placeholder** (skill, Fase 3 — *"Does the project already
   have a primitive for this?"*): **não existe** `Skeleton` na casa; cada tela
   reimplementa "Carregando…" à mão (43 sítios — §1.2). Sem um primitivo, a
   adoção da Onda 2/3 não tem alvo canônico.

UX-0003 ataca **(1)–(3)** criando **um** primitivo de forma e adotando-o nos
**dois** primitivos compartilhados de maior alavancagem (DataTable alimenta 17+
telas; KPICard alimenta os dashboards). A erradicação dos 43 textos
"Carregando…" tela-a-tela é deliberadamente **adiada** (§2.6) — fora do escopo
desta fundação.

### 1.2 Evidência real — grep de "Carregando" / loading textual

Comando: `grep -rnoE 'Carregando[^"'\''<}]*' src/app src/components --include="*.tsx"`
(2026-05-19). **43 ocorrências do texto literal "Carregando…"** em **29
arquivos** (o backlog/auditoria estimou "26 telas"; a contagem real é **43
sítios / 29 arquivos** — a auditoria contou telas-de-usuário; o grep conta
sítios, inclui sub-blocos e os 2 primitivos). Bate com
[[UX Audit — Sistema#F-2]] na ordem de grandeza e o **excede** (mais sítios que o
estimado — confirma a transversalidade do achado).

**Os 2 sítios DENTRO do escopo de UX-0003 (primitivos compartilhados):**

| # | Arquivo : linha | Hoje | Vira (UX-0003) |
|:--:|---|---|---|
| 1 | `src/components/shared/data-table.tsx:213` | `"Carregando registros..."` (spinner girando + texto, caixa `h-40`) — bloco `if (isLoading)` l.208-217 | **Skeleton de N linhas** com a forma das colunas/ações reais |
| 2 | `src/components/shared/kpi-card.tsx` (valor) — callers passam `"..."`; evidência do caller: `src/app/gestor-fabrica/page.tsx:460,468,476,484,492` `value={isLoading ? "..." : metrics.…}` | string `"..."` no slot do número | **Skeleton de bloco** no slot do valor (mesma caixa do número real) |

> **Nota sobre o sítio 2:** o `"..."` **não está dentro** de `kpi-card.tsx` — é
> passado **pelo caller** via prop `value`. UX-0003 adiciona ao `KPICard` uma
> **prop opcional `isLoading`** (retrocompatível); a **migração dos callers**
> `value={isLoading ? "..." : x}` → `isLoading={isLoading} value={x}` nos 5
> sítios do dashboard `gestor-fabrica/page.tsx:460-492` faz **parte de UX-0003**
> (é o "+ adoção no KPI" do título do item). Outros dashboards que usem o mesmo
> padrão `"..."` ficam para UX-0009/Onda 2/3 (§2.6) — UX-0003 toca **só** os 5
> sítios de `gestor-fabrica/page.tsx` como prova de adoção do primitivo.

**Os ~41 sítios FORA do escopo (amostra — adiados p/ UX-0009/Onda 2/3, §2.6):**

| Arquivo : linha (amostra) | Texto | Item futuro |
|---|---|---|
| `src/app/gestor-fabrica/sublinhas-producao/page.tsx:990` | `"Carregando linhas..."` | UX-0015/Onda 2 |
| `src/app/loja/pedidos/page.tsx:774` `:1264` | `"Carregando dados do pedido…"` / `"Carregando pedidos…"` (este via `emptyMessage` do DataTable) | UX-0011/Onda 2 |
| `src/app/administrador/usuarios/page.tsx:876` | `"Carregando usuários..."` | UX-0016/Onda 2 |
| `src/app/gestor-dados/{produtos,lojas,setores,ingredientes,linhas-producao}/…` (12+ sítios) | `"Carregando…"` / `"Carregando X..."` | UX-0009/Onda 3 |
| `src/app/{chao-fabrica,gestor-fabrica}/…/[id]/page.tsx` (8 sítios) | `"Carregando OP…"` / `"Carregando checklist…"` etc. | Onda 3 (lote C "Detalhe") |
| `src/app/impressao/**` (4 sítios) | `"Carregando os dados…para impressão."` | **NÃO** — Onda 3 lote E só herda token; cross-link [[Dívida Técnica#D17]] (segurança, fora) |
| `src/components/shared/profile-page.tsx:585` | `"Carregando..."` | UX-0009 (cobre 6 perfis) |
| `src/app/login/page.tsx:31` | `"Carregando login..."` | fora (suspense boundary de auth — não é estado de tela) |

> **Total: 43 sítios "Carregando…" / 29 arquivos. UX-0003 toca 2** (DataTable +
> KPICard) **+ migra 5 callers** de `gestor-fabrica/page.tsx`. **Os 41 demais
> são explicitamente adiados** (§2.6) — não são esquecimento, são fronteira.

### 1.3 Sistema de design existente (Fase 1 da skill — baseline a respeitar)

Lido linha-a-linha antes de propor (não impor estilo novo — adaptar ao da casa):

- **Tokens disponíveis** (`src/app/globals.css`, UX-0005 commitado):
  `--opacity-faint .10 / --opacity-subtle .16 / --opacity-soft .22 /
  --opacity-muted .25 / --opacity-border .35 / --opacity-divider .55 /
  --opacity-strong .65 / --opacity-prominent .78` (l.81-88);
  `--spacing-rhythm-3xs…2xl` (l.69-76, namespace `rhythm` → utilitários
  `p-rhythm-*`/`gap-rhythm-*`); cores semânticas (`--secondary`, `--muted`,
  `--border`, `--card`, `--foreground`…), `--radius`/`--radius-*`,
  `--shadow-card`. **`@media (prefers-reduced-motion: reduce)`** já existe global
  (l.255-264) e zera `animation-duration` para `*` — **o skeleton herda isso de
  graça**, mas a spec ainda exige `motion-reduce:` explícito por robustez (§3.2).
- **Idioma de primitivo da casa** (UX-0002 — `shared/toast.tsx`,
  `shared/confirm-dialog.tsx`): `"use client"` no topo; `import * as React`;
  cabeçalho-comentário `/* UX-#### — … */` explicando o porquê; `cn()` de
  `@/lib/utils`; `cva` para variantes quando há variantes; cor **só** via token
  semântico + degrau `--opacity-*` (ex.: `bg-success/[var(--opacity-faint)]`);
  espaçamento via `gap-rhythm-*`/`p-rhythm-*`; `motion-reduce:animate-none`
  explícito; `data-slot="…"` nos nós; export nomeado no fim.
- **Idioma de loading atual a substituir** (`data-table.tsx:208-217`): caixa
  `flex h-40 items-center justify-center rounded-xl border border-border/65
  bg-card shadow-[var(--shadow-card)]` + spinner
  `size-5 animate-spin rounded-full border-2 border-primary border-t-transparent`
  + texto `text-sm text-muted-foreground`. **A moldura externa (`rounded-xl
  border bg-card shadow-card`) deve ser preservada** — só o **miolo** (spinner +
  texto) vira skeleton de linhas. O empty-state logo abaixo (l.219-238) usa
  `border-dashed border-border-strong/35` — **não tocar** (é UX-0007).
- **Caixa real do conteúdo** (para casar a forma e zerar CLS):
  - DataTable: `<table>` com `<thead>` (`th` `py-3.5`/`compact:py-2.5`,
    `text-[10.5px] uppercase`) + `<tbody>` (`td` `py-3`/`compact:py-2.5`,
    `px-4`, `border-t border-border/55`, `text-sm`). N linhas default = 10
    (`initialPageSize`). Largura mínima `min-w-[640px] xl:min-w-full`.
  - KPICard: valor em `<p className="mt-2.5 font-heading
    text-[clamp(1.3rem,1.7vw,1.55rem)] font-bold leading-[1.1]
    tracking-[-0.022em] … tabular-nums">`. A caixa do skeleton precisa ter
    **a mesma altura de linha** desse `<p>` para não reflowar verticalmente.

### 1.4 O que o `e2e/regression.py` asserta (rede de não-regressão M6)

Lido integralmente (259 linhas). **Nenhum assert sobre estado de carga**
(`grep -i carregando|skeleton|aria-busy|loading e2e/regression.py` = 0). O runner:

- Após `goto()` espera `networkidle` (12s) **+ `wait_for_timeout(2500)`** →
  quando os asserts rodam, **o `isLoading` já resolveu** e o **skeleton já saiu**.
  Assert é **sempre sobre o DOM pós-carga**.
- `screen_ok()` reprova se `body()` contém a substring **`"error"`** (case-sens.
  em `"Application error"`/`"Unhandled Runtime"`; `"error" in page.title()`).
  → **O skeleton não pode conter a substring `error`** em texto/atributo/classe
  visível no `inner_text` do body (ex.: `aria-label` é lido por `inner_text`? não
  — `inner_text` ignora atributos; mas o **rótulo `sr-only`** vira texto. Usar
  rótulo **`"Carregando…"`** — sem `error` — no `sr-only`).
- Asserts de conteúdo: `get_by_text("Acompanhamento")`, `table thead th`
  (`all_inner_texts`), colunas Kanban exatas, `a[href*="/gestor-fabrica/…"]`
  (links de KPI — AJ-0002), textos AJ. **Todos pós-carga** → intactos desde que
  o skeleton **desmonte** quando `isLoading` vira `false` e o DOM final seja
  idêntico.

> **Conclusão de risco e2e:** seletor afetado = **nenhum**, *desde que* (a) o
> skeleton **desmonte** no estado final (o `if (isLoading) return <skeleton/>`
> já garante isso — mesmo padrão do código atual), (b) o rótulo acessível **não
> contenha `error`**, (c) `<thead>` real continue presente no DOM pós-carga (o
> skeleton do DataTable **não** renderiza `<table>`/`<thead>` reais — e não
> precisa: o assert `table thead th` roda **depois** do load, sobre a tabela
> real). Ver checklist §4 e plano §5.

### 1.5 Diagnóstico priorizado (impacto × risco — motor `/ux-ui-refiner`)

| # | Problema | Categoria | Severidade | Onde | Decisão UX-0003 |
|:--:|---|---|:--:|---|---|
| 1 | CLS: caixa de loading sem a forma do conteúdo (DataTable `h-40` centralizado → tabela de N linhas) | Estado | 🔴 | `data-table.tsx:208-217` | **Resolve** — skeleton replica thead+N linhas |
| 2 | CLS: `"..."` (≈3ch) → número real (1–6ch, fonte grande) reflowa o KPI | Estado | 🔴 | `kpi-card.tsx` valor + 5 callers `gestor-fabrica/page.tsx:460-492` | **Resolve** — skeleton no slot do valor, mesma altura de linha |
| 3 | Sem primitivo `Skeleton` canônico — 43 sítios ad-hoc | Estado | 🟡 | `src/components/` | **Resolve (cria)** o primitivo; adoção ampla = adiada |
| 4 | 41 textos "Carregando…" fora dos 2 primitivos | Estado | 🟡 | 27 arquivos de tela | **Adia** (UX-0009/Onda 2/3 — §2.6) |
| 5 | Cor/opacidade do placeholder poderia ser ad-hoc | Token | 🟢 | (a criar) | **Previne** — só `--opacity-*`/token (§2.1) |

UX-0003 fecha **1, 2, 3** (a fundação) e **declara 4** como fronteira adiada
(não é esquecimento). **5** é prevenção de regressão de token.

---

## 2. Spec de refinamento

> Implementação 100% em **3 arquivos**: criar
> `src/components/shared/skeleton.tsx`; editar `src/components/shared/data-table.tsx`
> (só o bloco l.208-217); editar `src/components/shared/kpi-card.tsx` (slot do
> valor + prop) **e** os 5 callers em `src/app/gestor-fabrica/page.tsx:460-492`
> (migração `value={isLoading?"...":x}` → `isLoading + value`). **Nenhum outro
> arquivo.** Diffs abaixo são **conceituais — NÃO aplicar nesta etapa**.

### 2.1 Primitivo de skeleton — `src/components/shared/skeleton.tsx`

**Forma do arquivo (espelha `shared/toast.tsx`):** `"use client"` no topo;
`import * as React`; cabeçalho-comentário `/* UX-0003 — … */`; `cn()` de
`@/lib/utils`; `cva` para a variante; `data-slot="skeleton"`; export nomeado.
**Sem dependência nova** (sem Radix — não há comportamento; é puramente visual).

#### API pública

```ts
type SkeletonVariant = "block" | "text" | "circle";

interface SkeletonProps extends React.ComponentProps<"div"> {
  /** Forma do placeholder. "text" arredonda menos e usa altura de linha;
   *  "circle" força aspecto 1:1; "block" é o retângulo genérico. Default: "block". */
  variant?: SkeletonVariant;
  /** Largura. number → px; string → passthrough (ex.: "60%", "8rem").
   *  Default: 100% (preenche o container). */
  width?: number | string;
  /** Altura. number → px; string → passthrough. Default por variante
   *  ("text" herda 1em via line-height; "block"/"circle" exigem height ou via className). */
  height?: number | string;
  /** Atalho para repetir N linhas de skeleton "text" com gap de ritmo.
   *  Quando >1, a última linha sai mais curta (≈70%) — imita parágrafo real. */
  lines?: number;
  /** Sobrescreve o raio. Default: variante decide (text→rounded-sm,
   *  block→rounded-md, circle→rounded-full). Aceita "none"|"sm"|"md"|"lg"|"full". */
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  /** Rótulo acessível do contêiner-raiz quando o Skeleton é a região de status.
   *  Quando ausente, o Skeleton é decorativo (aria-hidden) e o aria-busy/role
   *  fica a cargo de quem o compõe (ex.: o wrapper do DataTable). */
  label?: string;
}
```

> **Racional das props** (pedido do backlog: `variant/width/height/lines/rounded`):
> as 5 props pedidas estão presentes; `label` é adicional **mínimo** para a11y
> (§3.1) — sem ele o primitivo não consegue ser, sozinho, uma região de status
> acessível. Nenhuma prop de cor (cor é **sempre** token, não-parametrizável —
> previne regressão de token, achado #5).

#### Aparência (tokens da casa — zero ad-hoc)

- **Base (cva root):**
  `relative overflow-hidden bg-secondary/[var(--opacity-strong)]
  motion-safe:animate-pulse motion-reduce:animate-none`
  - Cor do placeholder = **`--secondary`** (cinza neutro da casa, l.110 de
    `globals.css`) a **`--opacity-strong` (0.65)** — degrau canônico UX-0005,
    **não** opacidade ad-hoc. `--secondary` é o cinza de "chip neutro" já usado
    no `kpi-card` (`toneStyles.neutral.badge: "bg-secondary …"`) → coerência.
  - `animate-pulse` (Tailwind nativo — **sem dependência**): pulsação **suave**
    de opacidade (não shimmer translativo agressivo). `motion-safe:` aplica só
    se o usuário **não** pediu redução; `motion-reduce:animate-none` desliga
    explicitamente (defesa-em-profundidade — o `@media reduce` global de
    `globals.css:255` já zera, mas o utilitário explícito documenta a intenção
    e cobre o caso de o reset global ser alterado no futuro). **Sem `::after`
    com `translate-x` / sem keyframe de shimmer custom** (guard-rail: "sem
    shimmer agressivo").
- **Variantes (cva):**
  - `block` → `rounded-md` (= `--radius-md`, casa)
  - `text`  → `rounded-sm` + altura padrão `h-[1em]` (acompanha o `font-size`
    do contexto → casa com a linha de texto que substitui)
  - `circle`→ `rounded-full aspect-square`
- **`rounded` prop** → mapeia para `rounded-none|sm|md|lg|full` (tokens de raio
  da casa; default = o da variante).
- **`width`/`height`** → aplicados via `style={{ width, height }}` (number→`px`
  via template, string→literal). **Não** gerar classes Tailwind dinâmicas
  (purge não as veria) — `style` inline é o padrão correto p/ dimensão
  paramétrica e **não** introduz cor/opacidade ad-hoc.
- **`lines > 1`** → renderiza um `<div role-less>` com
  `flex flex-col gap-rhythm-2xs` e N filhos `text`; o **último** com
  `width: "70%"` (imita fim-de-parágrafo; reduz "muro" visual).

#### Diff conceitual — novo arquivo (NÃO aplicar)

```tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------
 * UX-0003 — Skeleton primitive (placeholder de FORMA; elimina o CLS dos sítios de
 * "Carregando…" textual). CSS puro + tokens UX-0005 (--opacity-strong sobre
 * --secondary), pulsação suave via animate-pulse nativo do Tailwind (sem shimmer
 * agressivo, sem dependência). Espelha a gramática de shared/toast.tsx (cva,
 * data-slot, motion-reduce explícito, cn). a11y: decorativo por padrão
 * (aria-hidden); com `label` vira região role="status" aria-busy.
 * ---------------------------------------------------------------------------- */

const skeletonVariants = cva(
  "relative overflow-hidden bg-secondary/[var(--opacity-strong)] motion-safe:animate-pulse motion-reduce:animate-none",
  {
    variants: {
      variant: {
        block: "rounded-md",
        text: "rounded-sm h-[1em]",
        circle: "rounded-full aspect-square",
      },
      rounded: {
        none: "rounded-none", sm: "rounded-sm", md: "rounded-md",
        lg: "rounded-lg", full: "rounded-full",
      },
    },
    defaultVariants: { variant: "block" },
  },
);

interface SkeletonProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof skeletonVariants> {
  width?: number | string;
  height?: number | string;
  lines?: number;
  label?: string;
}

function Skeleton({
  className, variant = "block", rounded, width, height, lines, label,
  style, ...props
}: SkeletonProps) {
  const dim: React.CSSProperties = {
    ...(width !== undefined && { width: typeof width === "number" ? `${width}px` : width }),
    ...(height !== undefined && { height: typeof height === "number" ? `${height}px` : height }),
    ...style,
  };

  const a11y = label
    ? { role: "status", "aria-busy": true, "aria-label": label }
    : { "aria-hidden": true };

  if (lines && lines > 1) {
    return (
      <div data-slot="skeleton-group" className="flex flex-col gap-rhythm-2xs" {...a11y}>
        {label ? <span className="sr-only">{label}</span> : null}
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            data-slot="skeleton"
            className={cn(skeletonVariants({ variant: "text", rounded }), className)}
            style={i === lines - 1 ? { ...dim, width: "70%" } : dim}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ variant, rounded }), className)}
      style={dim}
      {...a11y}
      {...props}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

export { Skeleton, skeletonVariants };
export type { SkeletonProps, SkeletonVariant };
```

> ⚠️ Diff **conceitual** — o Front-End valida a sintaxe Tailwind 4 exata de
> `bg-secondary/[var(--opacity-strong)]` (mesma sintaxe já usada e compilando em
> `shared/toast.tsx:45` `bg-success/[var(--opacity-faint)]` — **precedente
> provado em produção**, risco de build ≈ 0). `SkeletonVariant` exportado p/
> tipagem dos consumidores.

### 2.2 Composto interno — `DataTableSkeleton` (colocado no skeleton.tsx)

Para o DataTable casar a **forma exata** (thead + N linhas + coluna de ações),
um composto fino — **no mesmo arquivo** `skeleton.tsx` (export nomeado), para
não criar arquivo extra e manter o primitivo auto-suficiente:

```tsx
function DataTableSkeleton({
  columns, hasActions, rows = 8, compact = false,
}: { columns: number; hasActions?: boolean; rows?: number; compact?: boolean }) {
  const cols = columns + (hasActions ? 1 : 0);
  return (
    <div
      role="status" aria-busy aria-label="Carregando registros"
      className="overflow-hidden rounded-xl border border-border/[var(--opacity-strong)] bg-card shadow-[var(--shadow-card)]"
    >
      <span className="sr-only">Carregando registros</span>
      {/* faixa do thead — mesma altura visual do <thead> real */}
      <div className={cn("flex gap-rhythm-sm border-b border-border bg-panel/[var(--opacity-strong)] px-4", compact ? "py-2.5" : "py-3.5")}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} variant="text" className="h-3 flex-1" />
        ))}
      </div>
      {/* N linhas — mesma altura de célula do <td> real (py-3 / compact py-2.5) */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={cn("flex gap-rhythm-sm border-t border-border/[var(--opacity-divider)] px-4", compact ? "py-2.5" : "py-3")}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} variant="text" className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

> Por que **8 linhas** default (não 10 = `initialPageSize`): o conteúdo real
> pode ter **< 10** itens (e empty-state já cobre 0). 8 é o ponto que **preenche
> a viewport típica sem exagerar a altura reservada** — o CLS-alvo é "não pular"
> e o tradeoff de ±2 linhas de altura é **muito** menor que o reflow `h-40`→tabela
> de hoje (de ~160px para a altura real da tabela). Não há valor "perfeito"
> universal; **8 é a recomendação; é ponto de aprovação** (§6 R1).
> A moldura externa (`rounded-xl border bg-card shadow-card`) **replica
> exatamente** a do estado real (`data-table.tsx:242`) e a do loading atual
> (`:210`) — opacidades migradas para os degraus canônicos (`/65`→
> `--opacity-strong`, `/55`→`--opacity-divider`) seguindo a tabela de-para
> UX-0005 (§7.4 daquela spec): **mesma aparência percebida** (Δ≤±?pp já
> aprovado em UX-0005), agora **via token**, não ad-hoc.

### 2.3 Integração em `data-table.tsx` (bloco `isLoading`, l.208-217)

**Diff conceitual (NÃO aplicar):**

```diff
  if (isLoading) {
-   return (
-     <div className="flex h-40 items-center justify-center rounded-xl border border-border/65 bg-card shadow-[var(--shadow-card)]">
-       <div className="flex items-center gap-3 text-sm text-muted-foreground">
-         <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
-         Carregando registros...
-       </div>
-     </div>
-   );
+   return (
+     <DataTableSkeleton
+       columns={columns.length}
+       hasActions={Boolean(actions && actions.length > 0)}
+       compact={compact}
+     />
+   );
  }
```

- **Contrato preservado:** mesma posição no fluxo (`if (isLoading) return …`
  **antes** do early-return de `data.length === 0` e do render real — ordem
  intacta). Sem mudança de prop, de `useState`, de `useMemo`, de paginação.
- **Forma:** `columns.length` e `actions.length` já estão em escopo no componente
  → o skeleton tem **exatamente o nº de colunas** da tabela que vai chegar →
  **zero reflow horizontal**. `compact` propagado → altura de linha casa.
- **`Carregando registros...` → `Carregando registros`** (sem reticências) **em
  `sr-only`**: o texto **deixa de ser visível** (vira forma), mas **permanece
  legível por leitor de tela** via `aria-label`/`sr-only` — **não** é remoção de
  informação, é mudança de canal (visual→AT). Sem `error` na string (e2e §1.4).

### 2.4 Integração em `kpi-card.tsx` (slot do valor)

`KPICard` ganha **prop opcional `isLoading?: boolean`** (retrocompatível —
ausente = comportamento atual idêntico). **Diff conceitual (NÃO aplicar):**

```diff
  interface KPICardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
+   /** UX-0003: quando true, o slot do valor exibe um Skeleton (sem CLS). */
+   isLoading?: boolean;
    …
  }
```

```diff
-         <p
-           className="mt-2.5 font-heading text-[clamp(1.3rem,1.7vw,1.55rem)] font-bold leading-[1.1] tracking-[-0.022em] text-foreground tabular-nums"
-           title={typeof displayValue === "string" ? displayValue : String(displayValue)}
-         >
-           {displayValue}
-         </p>
+         {isLoading ? (
+           <Skeleton
+             variant="block"
+             label="Carregando indicador"
+             className="mt-2.5 h-[1.55rem] w-20"
+           />
+         ) : (
+           <p
+             className="mt-2.5 font-heading text-[clamp(1.3rem,1.7vw,1.55rem)] font-bold leading-[1.1] tracking-[-0.022em] text-foreground tabular-nums"
+             title={typeof displayValue === "string" ? displayValue : String(displayValue)}
+           >
+             {displayValue}
+           </p>
+         )}
```

- **Sem CLS:** o `Skeleton` reserva `mt-2.5` (mesmo `margin-top` do `<p>`) +
  `h-[1.55rem]` (= o **teto** do `clamp` da fonte do valor, l.162 — a linha do
  número ocupa ~`1.55rem*1.1` de altura; reservar `1.55rem` mantém a caixa
  estável; `leading-[1.1]` torna a diferença sub-pixel e **não** causa salto
  perceptível). `w-20` (≈80px) ≈ largura de um número típico
  `compactValue`-formatado — reflow horizontal residual irrelevante (o KPI tem
  largura de coluna fixa do grid `xl:grid-cols-5`; o valor não empurra layout).
- **Trend / título / ícone / rail / href** — **intocados**. Só o slot do número
  muda quando `isLoading`.

### 2.5 Migração dos 5 callers — `gestor-fabrica/page.tsx:460-492`

Parte do "+ adoção no KPI". **Diff conceitual (NÃO aplicar) — padrão repetido 5×:**

```diff
  <KPICard
    title="Pedidos no dia"
-   value={isLoading ? "..." : metrics.totalOrders}
+   isLoading={isLoading}
+   value={metrics.totalOrders}
    tone="info"
    icon={ShoppingCart}
    compactValue
    href="/gestor-fabrica/pedidos"
  />
```

(idem l.468 "Aguardando liberação", l.476 "Em produção", l.484 "Checklist
pendente", l.492 "Entregas em campo" — **mesma transformação mecânica**).

- **`isLoading` já existe** nesse arquivo (era a condição do `"..."`) — só
  **reusa** a mesma variável. **Zero mudança de dado/fetch/cálculo** (`metrics.*`
  inalterado). O `href` (AJ-0002 — links de KPI assertados pelo e2e §1.4)
  **permanece** → `a[href*="/gestor-fabrica/…"]` intacto pós-carga.
- **Não regredir AJ-0001/AJ-0002:** o Kanban "Acompanhamento" e os cards
  navegáveis **não são tocados** (só o slot do valor dos 5 KPIs). e2e roda
  pós-carga → vê o número real + os `href` reais.

### 2.6 Fronteira — o que UX-0003 ADOTA vs o que ADIA (explícito)

| | **ADOTA (entra em UX-0003)** | **ADIA (não entra)** |
|---|---|---|
| **Primitivo** | Cria `shared/skeleton.tsx` (`Skeleton` + `DataTableSkeleton`) | — |
| **DataTable** | `data-table.tsx:208-217` → `DataTableSkeleton` | empty-state l.219-238 → **UX-0007** |
| **KPI** | `kpi-card.tsx` prop `isLoading` + slot + **5 callers** de `gestor-fabrica/page.tsx:460-492` | KPIs/`"..."` de **outros** dashboards → UX-0009/Onda 2/3 |
| **Texto "Carregando…"** | os **2** sítios dos primitivos | os **~41** sítios de tela (`loja/pedidos`, `administrador/usuarios`, `gestor-dados/*`, `[id]/*`, `sublinhas`, `profile-page`, etc.) → UX-0009 / Onda 2 (UX-0011/0014/0016) / Onda 3 |
| **`impressao/**`** | — | **fora total** (Onda 3 lote E só herda token; [[Dívida Técnica#D17]] segurança fora) |
| **`login/page.tsx:31`** | — | **fora** (suspense boundary de auth, não estado de tela) |

> **Princípio (skill Fase 3 / guard-rail do README):** UX-0003 = **primitivo +
> adoção nos 2 shared só**. A cascata para ~41 telas é **deliberadamente** dos
> itens consumidores — fazer aqui seria escopo de UX-0009/Onda 2/3 e violaria
> "1 `UX-####` por commit". A migração tela-a-tela **herda** este primitivo.

---

## 3. Cobertura de estados / a11y / responsivo

### 3.1 Acessibilidade (WCAG 2.1/2.2 AA — guard-rail da iniciativa)

- **Região de status, não conteúdo:** o composto que **representa o load**
  (`DataTableSkeleton`, e o `KPICard` em `isLoading`) expõe
  `role="status"` + `aria-busy="true"` + rótulo textual em `sr-only`
  (`"Carregando registros"` / `"Carregando indicador"`). Leitor de tela anuncia
  o estado de espera — **paridade com o "Carregando…" textual de hoje**, agora
  como live region polida (não interrompe). **A informação não é removida**, só
  muda de canal (visual → AT) — exatamente o padrão de "mudança de canal" de
  UX-0002 (toast `aria-live`).
- **Decorativo por padrão:** `Skeleton` individual sem `label` é
  **`aria-hidden`** — as N "linhas" de placeholder **não** poluem a árvore de
  acessibilidade com ruído repetido; só o **contêiner** anuncia "carregando" uma
  vez. (Evita o anti-padrão de 80 nós "carregando" lidos um a um.)
- **Sem foco / sem interação:** skeleton não é focável, não tem `tabindex`, não
  captura teclado — não há nada a operar; o foco do usuário não muda. Quando o
  conteúdo real chega, o foco/tab-order é o **da tabela real** (inalterado).
- **`prefers-reduced-motion`:** `motion-safe:animate-pulse` +
  `motion-reduce:animate-none` explícito **e** o `@media (prefers-reduced-motion:
  reduce)` global (`globals.css:255-264`) — **dupla** garantia: usuário com
  redução de movimento vê um bloco **estático** (sem pulsação), ainda
  comunicando "área reservada". Sem shimmer translativo (guard-rail).
- **Contraste:** o skeleton **não** carrega texto legível (o `sr-only` não
  precisa de contraste visual). `--secondary @ 0.65` sobre `--card` é uma
  superfície decorativa — **não** está sujeita a 4.5:1 (não é texto/UI
  acionável); a auditoria de contraste é **UX-0006**, e placeholders neutros
  não entram nela. Fronteira registrada.

### 3.2 Responsivo

- **DataTable:** o skeleton vive **dentro da mesma moldura** do estado real
  (`rounded-xl border bg-card shadow-card`); herda o comportamento de largura do
  container. Como o **fix responsivo do DataTable é UX-0001** (card/empilhado
  <640px), UX-0003 **não** introduz estratégia responsiva própria — o skeleton
  usa `flex` fluido (`flex-1` por coluna) que **degrada graciosamente** em
  qualquer largura e **não** adiciona `min-w` nem scroll-x (não pioraria F-3).
  Quando UX-0001 chegar, o skeleton de tabela pode ser revisitado para casar o
  fallback card — **nota de dependência futura**, não escopo aqui.
- **KPICard:** o slot do skeleton respeita o grid existente
  (`sm:grid-cols-2 xl:grid-cols-5`, `gestor-fabrica/page.tsx:456`); `w-20` é
  largura **interna** ao card (não afeta o grid). Mobile/desktop: mesma caixa.
- **Touch (loja/chão):** skeleton não é alvo de toque (não-interativo) → não há
  hit-target a satisfazer (M7 é do shell/UX-0010).

### 3.3 Estados cobertos

| Estado | Antes (hoje) | Depois (UX-0003) | CLS |
|---|---|---|:--:|
| **Loading** (DataTable) | `h-40` centralizado, spinner + "Carregando registros..." | thead + N linhas com a forma das colunas reais | **eliminado** (caixa ≈ tabela) |
| **Loading** (KPI) | string `"..."` no slot do número | `Skeleton block` `h-[1.55rem] w-20` no slot | **eliminado** (mesma altura de linha) |
| **Empty** (DataTable) | texto cinza + CTA (l.219-238) | **inalterado** — é **UX-0007** | n/a |
| **Error** | (não há estado de erro no DataTable hoje) | **inalterado** — fora do escopo (UX-0002 cobre erro de ação) | n/a |
| **Final/loaded** | tabela real / número real | **idêntico** (skeleton desmonta) | n/a |

> O skeleton cobre **só Loading**. Empty/Error **não** são tocados (fronteira) —
> UX-0003 não regride nem melhora esses; ficam para UX-0007/UX-0002.

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas → ✅):

- [ ] **Estado final renderizado idêntico** — quando `isLoading === false`, o
      DataTable renderiza **o mesmo `<table>`/`<thead>`/`<tbody>`/ações** de
      hoje (skeleton **desmonta**; o `if (isLoading) return` já garante);
      `KPICard` sem `isLoading` (ou `false`) renderiza o **mesmo `<p>`** com
      `displayValue`, `title`, `tabular-nums`, classes idênticas.
- [ ] **Zero CLS novo** — a caixa do skeleton tem a **mesma forma/altura** do
      conteúdo que substitui (thead+linhas / slot do valor); medição de layout
      shift no smoke (§5 passo 6) **não** acusa salto na transição
      loading→loaded. (CLS atual é **reduzido**, nunca aumentado.)
- [ ] **Sem mudança de dado / fetch / rota / cálculo** — nenhum hook,
      `useStoreOrderSummaries`, `metrics.*`, query, `permission-modules`,
      engine ou `href` alterado. `git diff` não toca `src/lib/**`.
- [ ] **Props retrocompatíveis** — `DataTable` API inalterada (só o **corpo**
      do `if (isLoading)` muda); `KPICard` ganha `isLoading?` **opcional**
      (callers sem ela = comportamento atual idêntico). Nenhum caller existente
      de `DataTable`/`KPICard` quebra (TS compila).
- [ ] **e2e seletores intactos** — `e2e/regression.py` 0-FAIL, PASS ≥ baseline
      (≥26). `table thead th`, `get_by_text("Acompanhamento")`, colunas Kanban,
      `a[href*="/gestor-fabrica/…"]` (AJ-0002), textos AJ → **inalterados**
      (assert pós-carga; skeleton já desmontou). **Nenhum rótulo de skeleton
      contém a substring `error`** (smoke `screen_ok` body-check).
- [ ] **Read-only-tenant respeitado** — skeleton é não-interativo; não há
      afordância a desabilitar/remover. O empty-state com CTA (`data-table.tsx:223-235`,
      trava read-only) **não é tocado**.
- [ ] **Reuso-primeiro / sem dependência nova** — `package.json` inalterado;
      `Skeleton` é CSS+token; `animate-pulse` é Tailwind nativo; `cva` já é dep
      da casa (usado em `toast.tsx`).
- [ ] **Só token / sem ad-hoc** — cor/opacidade do skeleton **só** via
      `--secondary` + `--opacity-*`; espaçamento via `gap-rhythm-*`; raio via
      `--radius-*`. `grep` no diff não acha `/NN` ad-hoc novo nem `oklch(` inline.
- [ ] **`prefers-reduced-motion`** — com redução ativa, skeleton **estático**
      (sem pulsação) — verificado no smoke.
- [ ] **Escopo: 3 arquivos + 1 caller** — `git diff --name-only` =
      `skeleton.tsx` (novo) + `data-table.tsx` + `kpi-card.tsx` +
      `gestor-fabrica/page.tsx`. **Nenhum outro** (os 41 sítios "Carregando…"
      **não** tocados — fronteira §2.6).
- [ ] **"Carregando…" removido só nos sítios do escopo** — `grep -n "Carregando"
      src/components/shared/data-table.tsx src/components/shared/kpi-card.tsx`
      → o texto **visível** sumiu dos 2 sítios (vira `sr-only`); os 41 demais
      **permanecem** (prova de fronteira respeitada).
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso.
- [ ] **Commit isolado revertível** — único commit `UX-0003`; `git revert`
      restaura o spinner+texto sem colateral (nada além dos 2 primitivos +
      caller consome `skeleton.tsx`).

---

## 5. Plano de verificação para o Front-End

Objetivo: provar que o **estado final é idêntico**, o **CLS só diminui**, e que
**nenhum seletor e2e** mudou.

1. **Escopo do diff (prova mecânica):**
   `git diff --name-only` → exatamente `src/components/shared/skeleton.tsx`
   (novo), `src/components/shared/data-table.tsx`,
   `src/components/shared/kpi-card.tsx`, `src/app/gestor-fabrica/page.tsx`.
   **Nenhum** arquivo de `src/lib/**`; **nenhum** outro `src/app/**`.
2. **`"Carregando…"` — removido só no escopo, intacto fora:**
   `grep -rn "Carregando" src/components/shared/data-table.tsx src/components/shared/kpi-card.tsx`
   → não há mais o **texto visível** (pode haver `"Carregando registros"` em
   `aria-label`/`sr-only` — esperado). `grep -rc "Carregando" src/app | grep -v ':0'`
   → contagem dos 41 sítios de tela **inalterada** (fronteira §2.6 respeitada).
   Confirmar **nenhuma** string de skeleton contém `error` (e2e §1.4):
   `git diff | grep -i 'error'` no skeleton = vazio.
3. **TS / retrocompat:** `npx tsc --noEmit` exit 0 — prova que `KPICard`
   `isLoading?` opcional não quebra **nenhum** caller existente e que
   `DataTableSkeleton` tipa certo. `npm run lint` 0 erro novo.
4. **`npm test`** verde (sem regressão dos 110 testes).
5. **`npm run build`** (`next build`) verde — Tailwind 4 resolve
   `bg-secondary/[var(--opacity-strong)]` / `gap-rhythm-*` (precedente provado:
   `toast.tsx` já usa a mesma sintaxe e compila).
6. **Smoke visual + CLS, 6 personas** (`e2e/README.md` na memória do projeto):
   logar nas 6 personas; abrir telas com DataTable (`gestor-dados/produtos`,
   `gestor-fabrica/ordens-producao`, `loja/ocorrencias`…) **+** o dashboard
   `gestor-fabrica` (5 KPIs). Verificar **na transição loading→loaded**:
   (a) **não há salto** de layout (gravar/inspecionar — CLS visual ≈ 0; hoje
   pula); (b) skeleton tem a forma da tabela/valor; (c) com
   `prefers-reduced-motion` (DevTools) o skeleton **não pulsa**; (d) leitor de
   tela anuncia "Carregando registros/indicador" uma vez (não 80×).
   **Canário:** 1 tela **sem** DataTable/KPI (ex.: um perfil) — pixel-idêntica
   (UX-0003 não a toca).
7. **Runner E2E de não-regressão (âncora M6):**
   `e2e/regression.py` (versionado — ver [[e2e-playwright-setup]] na memória do
   projeto / [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0 D-0]])
   → **0-FAIL**, PASS **≥ baseline (≥26)**, 6 personas. `table thead th`,
   `Acompanhamento`, Kanban, `a[href*=…]` (AJ-0002), AJ-textos **inalterados**
   (assert pós-carga). Qualquer queda = parada + rollback do item (regra do
   plano de orquestração).

> Critério de aprovação do Gate 1 p/ este item: passos 1-7 verdes **e**
> checklist §4 100% marcado no autorreview.

---

## 6. Riscos & notas de implementação (para o Front-End)

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | **Altura reservada do skeleton ≠ altura real** (nº de linhas / `h-[1.55rem]` do KPI) → resíduo de CLS | Média | Médio | **Ponto de aprovação.** Default 8 linhas / `h-[1.55rem]`. Mitigação: no smoke (§5 p.6) medir o shift; ajustar o nº de linhas/altura **dentro deste item** se acusar salto. O alvo é "**reduz** CLS", não "zero absoluto" — qualquer redução já é ganho vs `h-40`→tabela de hoje. |
| **R2** | Front-End migrar os **41 sítios "Carregando…"** de tela dentro de UX-0003 (escopo UX-0009/Onda 2/3) | Média | Alto | Fronteira escrita (§2.6, §1.2). Passo 1-2 da verificação **reprova** qualquer `src/app/**` fora de `gestor-fabrica/page.tsx` e qualquer queda na contagem dos 41 sítios. |
| **R3** | Skeleton altera o **DOM final** (deixa nó residual / não desmonta) → seletor e2e quebra | Baixa | Alto | Padrão `if (isLoading) return <Skeleton/>` (idêntico ao atual `if (isLoading) return <spinner/>`) — desmonta por construção. Passo 7 (e2e 0-FAIL) é o canário. §1.4 mapeia cada assert como pós-carga. |
| **R4** | String de skeleton contém `error` → falso-FAIL no `screen_ok` body-check | Baixa | Médio | Rótulos fixos `"Carregando registros"` / `"Carregando indicador"` — sem `error`. Passo 2 (`git diff | grep -i error`) prova. |
| **R5** | `animate-pulse` "agressivo" / shimmer translativo viola guard-rail a11y | Baixa | Médio | Spec proíbe shimmer custom; só `animate-pulse` (opacidade suave) + `motion-reduce:animate-none` + `@media reduce` global. Passo 6(c) verifica estático sob redução. |
| **R6** | Sintaxe Tailwind 4 `bg-secondary/[var(--opacity-strong)]` não compilar | Baixa | Baixo | **Precedente provado:** `shared/toast.tsx:45` usa `bg-success/[var(--opacity-faint)]` e compila/roda em produção (UX-0002 commitado). Passo 5 confirma. |
| **R7** | UX-0001 (DataTable responsivo) vai reformar a caixa que o skeleton imita → retrabalho | Baixa | Baixo | Skeleton usa `flex` fluido (sem `min-w`/scroll-x) → degrada ok. Nota de dependência: quando UX-0001 entrar, revisitar `DataTableSkeleton` p/ casar o fallback card (fora deste item; registrado). |

**Notas de implementação:**

- **Ordem de toque (plano):** UX-0003 vem **após UX-0005 (commitado) e UX-0002
  (commitado)**, na leva "primitivos de estado" da Onda 1
  ([[Backlog UX (RICE)]] §Sequência, l.176). Commit isolado `UX-0003`.
- **Espelhar `shared/toast.tsx`** na forma do arquivo (`"use client"`, header
  `/* UX-0003 — */`, `cva`, `data-slot`, `cn`, `motion-reduce` explícito, export
  nomeado no fim) — consistência arquitetural de primitivo da casa.
- **Reversibilidade:** `git revert` do commit restaura o spinner+"Carregando
  registros..." e o `"..."` do KPI; como só os 2 primitivos + 1 caller consomem
  `skeleton.tsx`, a reversão é garantidamente sem colateral.
- **Não introduzir** dark-mode, keyframe de shimmer custom, nem dependência
  (Radix/framer) — fora de escopo / guard-rail.
- **Entregar no autorreview/Changelog** ([[10 - Changelog Vivo/2026-05|Changelog
  do mês]], template em `Docs/10 - Changelog Vivo/Template — Entrada de
  Changelog.md`): a API do `Skeleton` + a nota de fronteira (§2.6) — é o
  contrato que UX-0009/Onda 2/3 vão consumir para a cascata tela-a-tela.

---

## 7. Autorreview (Front-End)

> Preenchido pelo agente `frontend-design-senior` (skill `/frontend-design`
> aplicada no 1º passo) em 2026-05-19, após aprovação explícita (cadência loop
> autônomo). Não commitado / sem build / sem e2e — orquestrador (Gate 1) executa.

### 7.1 Resumo do diff

- **`src/components/shared/skeleton.tsx` (novo, ~180 l.):** `Skeleton`
  (`cva` root `bg-secondary/[var(--opacity-strong)] motion-safe:animate-pulse
  motion-reduce:animate-none`; variantes `block`/`text`/`circle`; props
  `width/height/lines/rounded/label`) + `DataTableSkeleton` (mesma moldura
  `rounded-xl border bg-card shadow-card`, faixa de thead + N linhas). Espelha
  `shared/toast.tsx`: `"use client"`, `import * as React`, header
  `/* UX-0003 — */`, `cn`, `cva`, `data-slot`, export nomeado no fim.
- **`data-table.tsx`:** +1 import; bloco `if (isLoading)` (era l.208-217) →
  `<DataTableSkeleton columns hasActions compact/>`. Ordem do fluxo intacta
  (antes do early-return `data.length===0`). Empty-state **não tocado**.
- **`kpi-card.tsx`:** +1 import; +prop opcional `isLoading?: boolean` (default
  `false`); slot do `<p>` do valor → ternário `isLoading ? <Skeleton/> : <p/>`.
  Trend/título/ícone/rail/href/`displayValue`/`title`/`tabular-nums` intocados.
- **`gestor-fabrica/page.tsx`:** 5 callers de KPI `value={isLoading?"...":x}`
  → `isLoading={isLoading} value={x}`. Nada mais nesse arquivo.

### 7.2 Decisões de risco

- **R1 (altura/CLS) — estratégia de altura derivada do conteúdo real, não
  chutada:**
  - *KPI:* o `<p>` real é `text-[clamp(1.3rem,1.7vw,1.55rem)] leading-[1.1]`.
    A **caixa de linha** (não o font-size) no teto do clamp = `1.55rem × 1.1 ≈
    1.705rem`. A spec sugeria `h-[1.55rem]` (conceitual); **refinei para
    `h-[1.705rem]`** = altura real da linha. Justificativa: `h-[1.55rem]`
    sub-reservaria ~9% e deixaria CLS residual vertical; `h-[1.705rem]` casa a
    caixa real → CLS vertical ≈ 0. Mantido `mt-2.5` (mesmo `margin-top` do `<p>`)
    e `w-20` (≈ largura de número compacto típico; o card tem largura de coluna
    fixa no grid `xl:grid-cols-5`, então reflow horizontal não propaga layout).
  - *DataTable:* skeleton replica `columns.length (+1 se ações)` → **zero reflow
    horizontal** (nº de colunas exato). Linhas usam as mesmas classes verticais
    do real (`py-3.5`/`py-2.5` thead, `py-3`/`py-2.5` td) e a mesma moldura;
    `compact` propagado. Default **8 linhas** (ponto de aprovação R1): a maioria
    das tabelas tem `<10` itens e o tradeoff de ±2 linhas é muito menor que o
    reflow `h-40`→tabela de hoje. Ajustável no Gate 1 se o smoke acusar salto.
- **R3 (desmonte):** padrão `if (isLoading) return <DataTableSkeleton/>` (mesma
  construção do spinner anterior) e ternário no KPI → skeleton **desmonta** no
  estado final; DOM pós-carga byte-a-byte idêntico (TS compila; tabela real
  inalterada).
- **R5 (motion):** só `motion-safe:animate-pulse` (pulsação de opacidade suave,
  Tailwind nativo) + `motion-reduce:animate-none` explícito + `@media reduce`
  global (`globals.css:255`). Sem `::after`/`translate-x`/keyframe custom — sem
  shimmer agressivo.
- **R4 (substring `error`):** rótulos fixos `"Carregando registros"` /
  `"Carregando indicador"`. `grep -in error skeleton.tsx` = vazio (confirmado).

### 7.3 Checklist §4 (todas ✅)

- [x] **Estado final renderizado idêntico** — `if (isLoading) return` desmonta o
      skeleton; `KPICard` sem `isLoading` (default `false`) renderiza o mesmo
      `<p>`/classes/`title`/`tabular-nums`. TS exit 0 prova retrocompat.
- [x] **Zero CLS novo** — skeleton casa thead+linhas (nº de colunas exato) e a
      caixa de linha real do KPI (`h-[1.705rem]` = `1.55rem×1.1`). CLS só reduz
      vs `h-40`→tabela de hoje. Medição visual = Gate 1 (orquestrador).
- [x] **Sem mudança de dado/fetch/rota/cálculo** — `git diff --name-only -- src/lib`
      vazio; nenhum hook/`metrics.*`/query/`href`/`permission-modules` alterado.
- [x] **Props retrocompatíveis** — DataTable API inalterada (só corpo do `if`);
      KPICard `isLoading?` opcional. `npx tsc --noEmit` exit 0 (nenhum caller
      existente quebra).
- [x] **e2e seletores intactos** — assert pós-carga; skeleton desmontado.
      `table thead th` etc. inalterados. Nenhum rótulo contém `error`
      (`grep -in error skeleton.tsx` vazio). Execução do runner = Gate 1.
- [x] **Read-only-tenant respeitado** — skeleton não-interativo; empty-state com
      CTA (trava read-only) não tocado.
- [x] **Reuso-primeiro / sem dependência nova** — `package.json` inalterado;
      `cva` já dep; `animate-pulse` Tailwind nativo; sem Radix/framer.
- [x] **Só token / sem ad-hoc** — `--secondary` + `--opacity-strong/divider`,
      `gap-rhythm-*`, `rounded-*`. Sem `/NN` ad-hoc novo nem `oklch(` inline no
      diff do skeleton.
- [x] **`prefers-reduced-motion`** — `motion-reduce:animate-none` + `@media`
      global; verificação visual = Gate 1.
- [x] **Escopo: 3 arquivos + caller** — `git diff --name-only` (src) =
      `data-table.tsx`, `kpi-card.tsx`, `gestor-fabrica/page.tsx` + novo
      `skeleton.tsx` (untracked). Nenhum outro `src/**`.
- [x] **"Carregando…" removido só no escopo** — `grep -n "Carregando"` nos 3:
      só `kpi-card.tsx:168` `label="Carregando indicador"` (sr-only/aria —
      mudança de canal, esperado). Os 26 arquivos `src/app` fora do escopo com
      "Carregando" inalterados.
- [x] **Lint/tsc/test verdes** — ver §7.5. (build/e2e = orquestrador.)
- [x] **Commit isolado revertível** — só os 2 primitivos + 1 caller consomem
      `skeleton.tsx`; `git revert` restaura spinner+`"..."` sem colateral.

### 7.4 API final do `Skeleton` (contrato p/ UX-0009/Onda 2/3)

```ts
type SkeletonVariant = "block" | "text" | "circle";

interface SkeletonProps extends Omit<React.ComponentProps<"div">, "color"> {
  variant?: SkeletonVariant;           // default "block"
  rounded?: "none"|"sm"|"md"|"lg"|"full";
  width?: number | string;             // number→px, string→passthrough
  height?: number | string;
  lines?: number;                      // >1 → grupo "text"; última ≈70%
  label?: string;                      // presente → role=status aria-busy; ausente → aria-hidden
}

interface DataTableSkeletonProps {
  columns: number;
  hasActions?: boolean;                // default false
  rows?: number;                       // default 8 (R1)
  compact?: boolean;                   // default false
}

export { Skeleton, DataTableSkeleton, skeletonVariants };
export type { SkeletonProps, SkeletonVariant, DataTableSkeletonProps };
```

| | **ADOTADO (UX-0003)** | **ADIADO (fronteira §2.6)** |
|---|---|---|
| Primitivo | `shared/skeleton.tsx` (`Skeleton`+`DataTableSkeleton`) | — |
| DataTable | bloco `isLoading` → `DataTableSkeleton` | empty-state → UX-0007 |
| KPI | prop `isLoading` + slot + **5 callers** `gestor-fabrica/page.tsx` | KPIs de outros dashboards → UX-0009/Onda 2/3 |
| "Carregando…" | os **2** sítios dos primitivos | os **~41** de tela (26 arquivos `src/app` confirmados inalterados) → UX-0009/Onda 2/3 |

### 7.5 Resultado da verificação §5 (passos executados por mim: 1-4)

1. **Escopo do diff:** `git diff --name-only` (src) = `gestor-fabrica/page.tsx`,
   `data-table.tsx`, `kpi-card.tsx`; `skeleton.tsx` novo (untracked). **Nenhum**
   `src/lib/**`; nenhum outro `src/app/**`. (Obs: `Docs/.obsidian/workspace.json`
   aparece no diff — é estado de UI auto-gerado do Obsidian, **não** editado por
   mim; fora do escopo de código.)
2. **"Carregando…":** removido o texto **visível** dos 2 primitivos; resta só
   `aria-label`/`sr-only` (`kpi-card.tsx:168`; o do DataTable vive em
   `skeleton.tsx`). 26 arquivos `src/app` fora do escopo com "Carregando"
   **inalterados**. `grep -in error src/components/shared/skeleton.tsx` = vazio.
3. **TS / retrocompat:** `npx tsc --noEmit` **exit 0**. `npm run lint` **0
   erros** (6 warnings pré-existentes, todos fora do escopo: api/route,
   gestor-dados, loja/pedidos, sidebar, product-form-dialog — nenhum introduzido
   por UX-0003).
4. **`npm test`:** **110 pass / 0 fail**.
5. **`npm run build`:** *não executado — Gate 1 (orquestrador).* Risco ≈ 0:
   sintaxe `bg-secondary/[var(--opacity-strong)]` tem precedente provado em
   produção (`toast.tsx:45` `bg-success/[var(--opacity-faint)]`, UX-0002).
6. **Smoke visual + CLS 6 personas:** *não executado — Gate 1.*
7. **Runner e2e `e2e/regression.py`:** *não executado — Gate 1.*

### 7.6 Desvios mínimos justificados

- **KPI `h-[1.705rem]`** em vez do `h-[1.55rem]` conceitual da spec (§2.4): a
  spec já antecipava que "`leading-[1.1]` torna a diferença sub-pixel"; medindo,
  a caixa real de linha é `1.55rem × 1.1 ≈ 1.705rem`. Reservar a caixa **real**
  (não o font-size) cumpre melhor o objetivo declarado de R1 ("reservar a mesma
  caixa do conteúdo real"). Desvio aditivo, dentro do mandato de qualidade
  (CLS), sem mudança de escopo/fronteira/API.
- **`Omit<…, "color">`** em `SkeletonProps` (não no diff conceitual): cor é
  sempre token (achado #5) — remover `color` do passthrough impede regressão de
  token via prop e satisfaz o tipo `cva` sem ad-hoc. Desvio defensivo, alinhado
  ao racional "nenhuma prop de cor" da §2.1.
