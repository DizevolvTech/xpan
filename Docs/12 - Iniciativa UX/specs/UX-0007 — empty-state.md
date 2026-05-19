# UX-0007 — Primitivo `empty-state.tsx` (ícone + msg + CTA)

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner`). Companheira de [[Backlog UX (RICE)]] (item l.35 e l.88-91),
> [[UX PRD]] (critérios "Estado", §6; métrica **M5**/**M6**; resolução Gate 0 §10),
> [[UX Audit — Sistema]] (achado [[UX Audit — Sistema#F-5 — Sem convenção de "botão enviando"; empty state genérico · 🟡 · Estado|F-5]]).
> Convenção: [[12 - Iniciativa UX/README|README]]. Consome
> [[UX-0005 — escala-espacamento-opacidade|UX-0005]] (tokens `--opacity-*` /
> `--spacing-rhythm-*`, commitado). Espelha a gramática dos primitivos
> [[UX-0002 — sistema-toast-feedback|UX-0002]] (`shared/toast.tsx`,
> `shared/confirm-dialog.tsx`), [[UX-0003 — skeleton-loading|UX-0003]]
> (`shared/skeleton.tsx`, `DataTableSkeleton`) e [[UX-0004 — botao-enviando|UX-0004]]
> (`ui/button.tsx` prop `isLoading` + lógica read-only-tenant), **todos commitados**.
> O CTA do empty-state **reusa** o `<Button>` já endurecido por UX-0004 (read-only
> herdado, **não** reimplementado).

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, navegação nem
  `permission-modules`**. O empty-state só substitui **o que se vê quando
  `data.length === 0`** no DataTable — o **estado com dados é byte-a-byte o mesmo
  de hoje** (o bloco empty fica **depois** do `if (isLoading)` e **antes** do
  render real; ordem do fluxo intacta). Não muda **quando** nem **se** o dado
  chega; só **como o vazio é comunicado**.
- **Reuso-primeiro.** Antes de criar, verifiquei os 18 shared + 18 `ui/` + as
  deps (§1.3): **não existe** `EmptyState`/`empty-state` em `src/components/`
  (`grep` de componente = 0; só **molduras `border-dashed` ad-hoc** espalhadas —
  §1.2). `lucide-react` **já é dependência** (ícone), `<Button>` (UX-0004) **já
  trata read-only**, `cn`/`cva` já são idioma da casa. O primitivo é **CSS +
  tokens + composição de primitivos existentes** — **zero dependência nova**.
- **Só apresentação do estado vazio.** O escopo é (a) criar **um**
  `src/components/shared/empty-state.tsx` e (b) adotá-lo **somente** no
  `src/components/shared/data-table.tsx` (bloco `data.length === 0`, l.219-238).
  **Nenhuma** outra tela é tocada — a adoção tela-a-tela ampla (listas/detalhe
  vazios **fora** do DataTable; molduras `border-dashed` ad-hoc dos §1.2) é
  [[Backlog UX (RICE)|UX-0009]] / Onda 2 (UX-0011/0014/0016) / Onda 3 (fronteira
  explícita em §2.6). UX-0007 = primitivo + adoção **só no DataTable**.
- **Retrocompatível por construção (requisito-âncora).** A API pública do
  `DataTable` **não muda**: `emptyMessage?` e `emptyStateAction?` continuam
  exatamente com o mesmo tipo e a mesma semântica. Os **17 callers** de
  `<DataTable>` (§1.2) renderizam **sem nenhuma edição** — só o **corpo** do
  `if (data.length === 0)` muda internamente. É o requisito #1 do checklist §4.
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa
  posterior, **após aprovação explícita do usuário**. Esta spec **não toca
  `src/`**.
- **Read-only-tenant respeitado (não reimplementado).** O CTA do empty-state
  **delega** a trava read-only ao `<Button>` (UX-0004) — o bloco atual já passa
  `disabled={isReadOnlyTenantView && !emptyStateAction.allowInReadOnly}` +
  `allowInReadOnly`; UX-0007 **preserva exatamente** essa lógica. O empty-state
  **não** pode oferecer ação proibida em tenant read-only: a afordância é
  **desabilitada, não removida** (guard-rail do README).
- **Não regredir o `e2e/regression.py`.** O runner (ver §1.4) **não asserta** o
  texto/seletor do empty-state — asserta **conteúdo pós-carga com dados**
  (`table thead th`, `Acompanhamento`, colunas Kanban, `a[href*=…]` de KPI,
  marcadores AJ) e o smoke `screen_ok` (body **não** pode conter a substring
  `error`). O empty-state **não pode** introduzir `error` em texto/`sr-only`
  visível ao `inner_text`, nem o ramo **AJ-0013 "sem agendadas é esperado"**
  pode quebrar (ele casa o título de painel `Fila de OPs`/`Agendadas (próximos
  dias)`, que é **chrome da página**, **fora** do bloco empty do DataTable —
  §1.4). Detalhe em §4 / §5.

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 auditoria
do sistema de design existente → Fase 2 diagnóstico → Fase 3 plano contra o
sistema existente; nenhuma edição de código — modo spec-only). Achados
consolidados (categoria **Estado**, achado **F-5**, parte "empty state genérico"):

1. **Empty-state sem hierarquia** (checklist da skill, *States → "Empty —
   give it an icon, a one-line explanation, and a primary action; don't show a
   bare 'No data'"*). Hoje (`data-table.tsx:219-238`): uma caixa
   `border-dashed` com **só um `<p>` cinza** (`text-sm text-muted-foreground`) +
   um `<Button>` opcional. **Sem ícone**, sem **título** (peso visual), sem
   **descrição orientadora** separada da chamada — é o anti-padrão "bare
   message" exato. O usuário não sabe *se* é um estado esperado, *por que* está
   vazio, nem *o que fazer*.
2. **Affordance de recuperação fraca** (skill, *UX → "the empty state is a
   navigation opportunity; the CTA is the recovery path"*). O `emptyStateAction`
   **já existe** como prop e **já trata read-only** — mas visualmente o botão
   `outline size="sm"` flutua sem âncora (sem ícone-герói acima, sem título que
   o justifique). A intenção de produto existe; falta a forma.
3. **Sem vocabulário de empty-state** (skill, Fase 3 — *"Does the project
   already have a primitive for this?"*): **não existe** `EmptyState` na casa;
   cada tela que precisa de "vazio" fora do DataTable reimplementa uma moldura
   `border-dashed` à mão (§1.2 — **8+ sítios ad-hoc**). Sem um primitivo, a
   adoção da Onda 2/3 não tem alvo canônico.

UX-0007 ataca **(1)–(3)** criando **um** primitivo de empty-state e adotando-o
**somente** no DataTable (alavancagem máxima: alimenta os 17 callers). A
erradicação das molduras `border-dashed` ad-hoc tela-a-tela é deliberadamente
**adiada** (§2.6) — fora do escopo desta fundação.

### 1.2 Evidência real — empty atual + molduras ad-hoc

**O sítio DENTRO do escopo de UX-0007** (`data-table.tsx:219-238`, lido
linha-a-linha):

```tsx
if (data.length === 0) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/35 bg-card px-6 text-center shadow-[var(--shadow-card)]">
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      {emptyStateAction && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={emptyStateAction.onClick}
          disabled={isReadOnlyTenantView && !emptyStateAction.allowInReadOnly}
          allowInReadOnly={emptyStateAction.allowInReadOnly}
        >
          {emptyStateAction.icon && <emptyStateAction.icon className="mr-1.5 size-4" />}
          {emptyStateAction.label}
        </Button>
      )}
    </div>
  );
}
```

Contrato a **preservar** (props do DataTable, l.45 e l.61-67 —
**inalteradas**):

```ts
emptyMessage?: string;                    // texto orientador (default no §2.3)
emptyStateAction?: {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  allowInReadOnly?: boolean;              // delega read-only ao <Button> (UX-0004)
};
```

> **Observação-chave (`emptyMessage`):** o `<p>` renderiza `{emptyMessage}`
> **cru**, sem fallback no JSX (o default, quando existe, é definido pelo
> **caller** ou ausente → `undefined` → `<p>` vazio). **17 callers** passam
> `emptyMessage=` (grep §abaixo). UX-0007 **mantém** `emptyMessage` mapeado para
> a **descrição** do EmptyState e **adiciona um default seguro** quando ausente
> (hoje ausente = `<p>` vazio = pior UX; o default só **melhora** o caso
> não-especificado, **nunca** sobrescreve um `emptyMessage` informado —
> retrocompat preservada). Ver §2.3.

**Grep de callers do DataTable (prova de retrocompat — 2026-05-19):**
`grep -rl '<DataTable' src/app --include=*.tsx` → **17 arquivos**;
`grep -rl 'emptyMessage=' src/app --include=*.tsx` → **17 arquivos**. Todos
passam `emptyMessage` como **string literal** (`emptyMessage="Nenhum produto
encontrado"`, `"Nenhuma loja encontrada"`, `"Nenhum pedido encontrado"`,
`"Nenhuma categoria encontrada"`, `"Nenhuma linha encontrada"`…). **Nenhum**
caller muda — só o **corpo** do `if` interno ao DataTable.

**As molduras `border-dashed` ad-hoc FORA do escopo (amostra — adiadas p/
UX-0009/Onda 2/3, §2.6):**

| Arquivo : linha (amostra) | O que é | Item futuro |
|---|---|---|
| `src/app/gestor-fabrica/page.tsx:530` | bloco vazio do dashboard (`border-dashed`) | UX-0014/Onda 2 |
| `src/app/gestor-fabrica/sublinhas-producao/page.tsx:647` `:1318` | empties ad-hoc fora de DataTable | UX-0015/Onda 2 |
| `src/app/gestor-dados/linhas-producao/[lineId]/page.tsx:588` | empty de detalhe ad-hoc | Onda 3 (lote "Detalhe") |
| `src/app/gestor-dados/page.tsx:162` | `"Nenhuma linha cadastrada"` (card, sem DataTable) | UX-0009/Onda 3 |
| `src/app/administrador-master/{page,clientes/[tenantId]}…` (2+ sítios) | `border-dashed` ad-hoc | Onda 3 |
| `src/app/impressao/{pre-pesagem,producao}/[opId]/page.tsx` (2 sítios) | `border-dashed` em layout de impressão | **NÃO** — Onda 3 lote E só herda token; cross-link [[Dívida Técnica#D17]] (segurança, fora) |

> **Total: 8+ molduras `border-dashed` ad-hoc / ~7 arquivos, fora do DataTable.
> UX-0007 toca 1 sítio** (`data-table.tsx:219-238`). **Os demais são
> explicitamente adiados** (§2.6) — não é esquecimento, é fronteira ("1
> `UX-####` por commit"). A migração tela-a-tela **herda** este primitivo.

### 1.3 Sistema de design existente (Fase 1 da skill — baseline a respeitar)

Lido linha-a-linha antes de propor (não impor estilo novo — adaptar ao da casa):

- **Tokens disponíveis** (`src/app/globals.css`, UX-0005 commitado):
  `--opacity-faint .10 / --opacity-subtle .16 / --opacity-soft .22 /
  --opacity-muted .25 / --opacity-border .35 / --opacity-divider .55 /
  --opacity-strong .65 / --opacity-prominent .78`; `--spacing-rhythm-3xs…2xl`
  (namespace `rhythm` → utilitários `p-rhythm-*`/`gap-rhythm-*`); cores
  semânticas (`--muted`, `--muted-foreground`, `--border`, `--border-strong`,
  `--card`, `--foreground`, `--primary`…), `--radius`/`--radius-*`,
  `--shadow-card`. `@media (prefers-reduced-motion: reduce)` global já existe
  (`globals.css:255-264`) — herdado de graça (mas o empty-state **não tem
  animação**: §3.1).
- **Idioma de primitivo da casa** (UX-0002 `shared/toast.tsx`, UX-0003
  `shared/skeleton.tsx`): `"use client"` no topo; `import * as React`;
  cabeçalho-comentário `/* UX-#### — … */` explicando o porquê; `cn()` de
  `@/lib/utils`; `cva` para variantes **quando há variantes**; cor **só** via
  token semântico + degrau `--opacity-*`; espaçamento via
  `gap-rhythm-*`/`p-rhythm-*`; `data-slot="…"` nos nós; export nomeado no fim;
  ícone via `lucide-react` (`LucideIcon` já tipado no `data-table.tsx:4`).
- **Idioma de empty atual a substituir** (`data-table.tsx:219-238`): caixa
  `flex h-44 flex-col items-center justify-center gap-3 rounded-xl border
  border-dashed border-border-strong/35 bg-card px-6 text-center
  shadow-[var(--shadow-card)]`. **A moldura externa (`rounded-xl border bg-card
  shadow-card`, centralizada, `text-center`) é o idioma da casa para "estado
  contido" — deve ser preservada na forma**; o `border-dashed` (sinaliza
  "espaço a preencher") **mantido** como assinatura visual de vazio. O bloco
  `isLoading` logo acima (`DataTableSkeleton`, UX-0003 commitado) e o render
  real abaixo (l.240+) **não são tocados**.
- **CTA = `<Button>` UX-0004** (`src/components/ui/button.tsx`, commitado): já
  resolve read-only-tenant internamente (`isReadOnlyTenantView` +
  `blocksInReadOnly` + `allowInReadOnly`), foco visível (`focus-visible:ring`),
  `aria-busy`, `disabled`. UX-0007 **reusa** esse `<Button>` — **não**
  reimplementa nenhuma lógica de acesso.

### 1.4 O que o `e2e/regression.py` asserta (rede de não-regressão M6)

Lido integralmente (258 linhas). **Nenhum assert sobre o texto do empty-state**
(`grep -i 'nenhum\|empty\|vazio\|sem dados' e2e/regression.py` = 0). O runner
(âncora M6):

- Após `goto()` espera `networkidle` (12s) **+ `wait_for_timeout(2500)`**; os
  asserts de conteúdo rodam **com dados carregados** (`table thead th`,
  `get_by_text("Acompanhamento")`, colunas Kanban, `a[href*="/gestor-fabrica/…"]`
  — AJ-0002, textos AJ). O **empty-state só aparece quando `data.length === 0`**
  — nos fluxos assertados o e2e usa contas-piloto **com dados**, então o
  empty-state **não renderiza** lá → **nenhum seletor pós-carga depende do texto
  de empty**.
- `screen_ok()` (l.94-102) reprova se `body()` contém a substring **`"error"`**
  (`"Application error"`/`"Unhandled Runtime"`; `"error" in page.title()`) →
  **o empty-state não pode conter a substring `error`** em texto visível
  (`inner_text` ignora atributos, mas `sr-only` vira texto). Os defaults/labels
  propostos (§2.3) **não contêm** `error`.
- **Ramo AJ-0013 "sem agendadas é esperado"** (l.187-194): após
  `goto(/gestor-fabrica/ordens-producao)`, `op = body(page)`; PASS se
  `re.search(r"Agendadas?\s*\(pr[óo]ximos dias\)", op)` **ou**
  `"Fila de OPs" in op`. **Esses textos são títulos de painel (chrome da
  página), renderizados pela própria tela — NÃO são o `emptyMessage` do
  DataTable.** Mesmo que a fila de OPs esteja vazia e o DataTable mostre o
  EmptyState, o título de painel `"Fila de OPs"`/`"Agendadas (próximos dias)"`
  **continua no DOM** (é irmão do DataTable, não filho). → **o ramo vazio de
  AJ-0013 não quebra**, *desde que* o EmptyState **não remova** chrome da página
  (ele não remove — só substitui o miolo do `if (data.length===0)` interno ao
  DataTable). Verificação em §5 passo 7.

> **Conclusão de risco e2e:** seletor afetado = **nenhum**, *desde que* (a) o
> EmptyState **não contenha** a substring `error`, (b) **não remova** nenhum
> chrome de página irmão do DataTable (não remove — escopo é só o corpo do `if`
> interno), (c) o estado **com dados** seja byte-idêntico (o `if
> (data.length===0) return` já garante o curto-circuito; com dados o EmptyState
> nem monta). AJ-0013 ramo-vazio casa título de painel, não `emptyMessage` →
> intacto. Ver checklist §4 e plano §5.

### 1.5 Diagnóstico priorizado (impacto × risco — motor `/ux-ui-refiner`)

| # | Problema | Categoria | Severidade | Onde | Decisão UX-0007 |
|:--:|---|---|:--:|---|---|
| 1 | Empty = `<p>` cinza sem ícone/título/hierarquia | Estado | 🟡 | `data-table.tsx:221-222` | **Resolve** — ícone + título + descrição |
| 2 | `emptyMessage` ausente ⇒ `<p>` vazio (sem orientação) | Estado | 🟡 | `data-table.tsx:222` (`{emptyMessage}` cru) | **Resolve** — default seguro só quando ausente (não sobrescreve) |
| 3 | CTA flutua sem âncora visual | Estado | 🟢 | `data-table.tsx:223-235` | **Resolve** — CTA ancorado abaixo de ícone+título; **reusa** `<Button>` (read-only intacto) |
| 4 | Sem primitivo `EmptyState` canônico — 8+ molduras ad-hoc | Estado | 🟡 | `src/app/**` | **Resolve (cria)** o primitivo; adoção ampla = adiada |
| 5 | 8+ `border-dashed` ad-hoc fora do DataTable | Estado | 🟡 | ~7 arquivos de tela | **Adia** (UX-0009/Onda 2/3 — §2.6) |
| 6 | Cor/opacidade do empty poderia ser ad-hoc | Token | 🟢 | (a criar) | **Previne** — só `--opacity-*`/token (§2.1) |

UX-0007 fecha **1, 2, 3, 4** (a fundação) e **declara 5** como fronteira adiada
(não é esquecimento). **6** é prevenção de regressão de token.

---

## 2. Spec de refinamento

> Implementação 100% em **2 arquivos**: criar
> `src/components/shared/empty-state.tsx`; editar
> `src/components/shared/data-table.tsx` (**só** o bloco `if (data.length === 0)`,
> l.219-238). **Nenhum outro arquivo** (nenhum caller, nenhum `src/lib/**`).
> Diffs abaixo são **conceituais — NÃO aplicar nesta etapa**.

### 2.1 Primitivo de empty-state — `src/components/shared/empty-state.tsx`

**Forma do arquivo (espelha `shared/toast.tsx`/`shared/skeleton.tsx`):**
`"use client"` no topo; `import * as React`; cabeçalho-comentário
`/* UX-0007 — … */`; `cn()` de `@/lib/utils`; `data-slot="empty-state"`; export
nomeado no fim. **Sem `cva`** (não há variantes — o empty-state tem **uma**
forma; introduzir `cva` aqui seria over-engineering contra o guard-rail
"reuso-primeiro/sem complexidade nova"). **Sem dependência nova** (ícone via
`LucideIcon`, já dep; CTA via `<Button>`, já existe).

#### API pública

```ts
interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  /** Repassado ao <Button> (UX-0004) — read-only-tenant tratado lá, não aqui. */
  allowInReadOnly?: boolean;
}

interface EmptyStateProps {
  /** Ícone-герói (lucide). Default: Inbox (neutro "lista vazia"). */
  icon?: LucideIcon;
  /** Título curto (peso visual). Default: "Nada por aqui ainda". */
  title?: string;
  /** Descrição orientadora (1 linha). Mapeia do `emptyMessage` do DataTable.
   *  Default seguro quando ausente (§2.3) — nunca sobrescreve um valor dado. */
  description?: string;
  /** CTA opcional. Quando ausente, o empty-state é só ícone+título+descrição. */
  action?: EmptyStateAction;
  /** Variação de altura/padding. "table" = casa a moldura do DataTable
   *  (h-44 atual). "section" = bloco maior p/ uso futuro (adiado §2.6).
   *  Default: "table". */
  size?: "table" | "section";
  className?: string;
}
```

> **Racional das props** (pedido do backlog: `icon` + `title` + `description` +
> `action?`): as 4 estão presentes. `size` é adicional **mínimo** (default
> `"table"` = casa o DataTable hoje; `"section"` reservado para a adoção futura
> §2.6 sem reabrir a API depois — evita churn de contrato). **Nenhuma prop de
> cor** (cor é **sempre** token — previne regressão, achado #6). `action` reusa
> o shape **idêntico** ao `emptyStateAction` do DataTable → mapeamento 1:1
> trivial (§2.3), zero perda de semântica.

#### Aparência (tokens da casa — zero ad-hoc)

- **Moldura (preserva o idioma de "estado contido" da casa):**
  `flex flex-col items-center justify-center gap-rhythm-sm rounded-xl border
  border-dashed border-border-strong/[var(--opacity-border)] bg-card
  px-rhythm-lg text-center shadow-[var(--shadow-card)]`
  - `border-dashed` **mantido** (assinatura visual de "vazio/a preencher" da
    casa). Opacidade migrada do ad-hoc `/35` → degrau canônico
    `--opacity-border` (0.35 = **mesmo valor**; agora via token — segue a tabela
    de-para UX-0005 §7.4, mesma aparência percebida).
  - `size="table"` → `min-h-44` (= o `h-44` atual; **min** em vez de fixo para
    não cortar título+descrição+CTA longos — melhora sem regredir altura
    mínima); `size="section"` → `min-h-64` (uso futuro, adiado).
- **Ícone-герói:** `<Icon className="size-9 text-muted-foreground/
  [var(--opacity-prominent)]" aria-hidden="true" />` dentro de um nó
  `data-slot="empty-state-icon"`. Tamanho `size-9` (~36px) — presença sem
  dominar; cor `--muted-foreground` a `--opacity-prominent` (0.78) → visível mas
  claramente "estado secundário", coerente com o tom do `<p>` cinza de hoje.
  **Decorativo** (`aria-hidden`) — a informação está no título/descrição (§3.1).
- **Título:** `<p data-slot="empty-state-title" className="text-sm font-semibold
  text-foreground">{title}</p>` — peso (`font-semibold`) + cor `--foreground`
  dão a **hierarquia** que falta hoje (hoje só há o cinza). Tamanho `text-sm`
  casa a densidade da casa (não inventa escala tipográfica nova).
- **Descrição:** `<p data-slot="empty-state-description" className="max-w-sm
  text-sm text-muted-foreground">{description}</p>` — **exatamente** o
  `text-sm text-muted-foreground` do `<p>` atual (continuidade visual);
  `max-w-sm` evita linha-larga ilegível em telas largas (melhoria de
  legibilidade, não mudança de identidade).
- **CTA:** quando `action`, renderiza **o mesmo `<Button>`** de hoje
  (`variant="outline" size="sm"`, ícone opcional, `onClick`,
  `allowInReadOnly`), envolto em `data-slot="empty-state-action"` com
  `mt-rhythm-2xs`. **A trava read-only é a do `<Button>` (UX-0004)** — ver
  §2.2.
- **Sem animação** (guard-rail): empty-state é estático. Sem `animate-*`, sem
  shimmer, sem ilustração animada — `prefers-reduced-motion` é não-aplicável
  (nada a reduzir). Registrado em §3.1.

#### Diff conceitual — novo arquivo (NÃO aplicar)

```tsx
"use client";

import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------------
 * UX-0007 — EmptyState primitive (ícone + título + descrição + CTA opcional).
 * Substitui o "<p> cinza só" do bloco data.length===0 do DataTable. CSS + tokens
 * UX-0005 (--opacity-*), ícone lucide (já dep), CTA = <Button> UX-0004 (read-only
 * tratado LÁ, não aqui — não reimplementar acesso). Espelha a gramática de
 * shared/toast.tsx / shared/skeleton.tsx (cn, data-slot, export nomeado, header).
 * Sem cva (sem variantes reais), sem animação, sem dependência nova. a11y: ícone
 * decorativo; título/descrição são o conteúdo; CTA herda foco visível do Button.
 * ---------------------------------------------------------------------------- */

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  allowInReadOnly?: boolean;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  size?: "table" | "section";
  className?: string;
}

function EmptyState({
  icon: Icon = Inbox,
  title = "Nada por aqui ainda",
  description = "Nenhum registro para exibir.",
  action,
  size = "table",
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-rhythm-sm rounded-xl border border-dashed border-border-strong/[var(--opacity-border)] bg-card px-rhythm-lg py-rhythm-lg text-center shadow-[var(--shadow-card)]",
        size === "section" ? "min-h-64" : "min-h-44",
        className,
      )}
    >
      <Icon
        data-slot="empty-state-icon"
        className="size-9 text-muted-foreground/[var(--opacity-prominent)]"
        aria-hidden="true"
      />
      <p
        data-slot="empty-state-title"
        className="text-sm font-semibold text-foreground"
      >
        {title}
      </p>
      {description ? (
        <p
          data-slot="empty-state-description"
          className="max-w-sm text-sm text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div data-slot="empty-state-action" className="mt-rhythm-2xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={action.onClick}
            allowInReadOnly={action.allowInReadOnly}
          >
            {ActionIcon ? <ActionIcon className="mr-1.5 size-4" /> : null}
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps, EmptyStateAction };
```

> ⚠️ Diff **conceitual** — o Front-End valida a sintaxe Tailwind 4 exata de
> `border-border-strong/[var(--opacity-border)]` e
> `text-muted-foreground/[var(--opacity-prominent)]` (mesma sintaxe já compilando
> em `shared/toast.tsx:45` `bg-success/[var(--opacity-faint)]` — **precedente
> provado em produção**, risco de build ≈ 0). **Nota read-only (R3):** ver §2.2
> — o `disabled` explícito do bloco atual **deve** ser preservado no mapeamento
> do DataTable; **não** removê-lo confiando só no `<Button>`.

### 2.2 Read-only-tenant — preservar a trava EXATA (não reimplementar, não enfraquecer)

O bloco atual do DataTable passa ao `<Button>`:

```tsx
disabled={isReadOnlyTenantView && !emptyStateAction.allowInReadOnly}
allowInReadOnly={emptyStateAction.allowInReadOnly}
```

`isReadOnlyTenantView` é calculado **dentro do DataTable** (l.120,
`readClientAccessContext().accessMode === "read-only-tenant"`). O `<Button>`
(UX-0004) **também** resolve read-only internamente, **mas** apenas para
`variant === "default"|"destructive"|type==="submit"` (l.94-97 do `button.tsx`)
— o CTA do empty-state é `variant="outline"` **sem** `type="submit"`, então o
`<Button>` **sozinho não bloquearia** esse outline. **Logo:** a trava efetiva
hoje vem do **`disabled` explícito** passado pelo DataTable, **não** da lógica
interna do `<Button>`.

**Decisão (não-negociável): preservar o `disabled` explícito no mapeamento.** O
primitivo `EmptyState` **expõe** o `action` mas o **DataTable continua
calculando e passando `disabled`** (via wrapper — §2.3). O `EmptyState` em si
**não** recalcula read-only (não importa `readClientAccessContext` — manter o
primitivo desacoplado e o contrato de acesso onde já está). Isso satisfaz o
guard-rail "afordância desabilitada, não removida" **sem** duplicar nem
enfraquecer a lógica.

> **Por que o `<Button>` recebe `disabled` via prop nativa:** `EmptyStateAction`
> **não** tem campo `disabled` na API pública (ver §2.1) — a desabilitação
> read-only é responsabilidade do **consumidor que conhece o contexto de
> acesso** (o DataTable). O `EmptyState` repassa `allowInReadOnly` ao `<Button>`
> (defesa-em-profundidade p/ o caso `default`/`submit`) **e** o DataTable injeta
> `disabled` explícito no `action.onClick` neutralizado quando read-only — ver
> o mapeamento exato em §2.3 (R3 mitigado).

### 2.3 Integração em `data-table.tsx` (bloco `data.length === 0`, l.219-238)

**Diff conceitual (NÃO aplicar):**

```diff
  if (data.length === 0) {
-   return (
-     <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong/35 bg-card px-6 text-center shadow-[var(--shadow-card)]">
-       <p className="text-sm text-muted-foreground">{emptyMessage}</p>
-       {emptyStateAction && (
-         <Button
-           type="button"
-           variant="outline"
-           size="sm"
-           onClick={emptyStateAction.onClick}
-           disabled={isReadOnlyTenantView && !emptyStateAction.allowInReadOnly}
-           allowInReadOnly={emptyStateAction.allowInReadOnly}
-         >
-           {emptyStateAction.icon && <emptyStateAction.icon className="mr-1.5 size-4" />}
-           {emptyStateAction.label}
-         </Button>
-       )}
-     </div>
-   );
+   const emptyActionBlocked =
+     emptyStateAction != null &&
+     isReadOnlyTenantView &&
+     !emptyStateAction.allowInReadOnly;
+   return (
+     <EmptyState
+       title="Nada por aqui ainda"
+       description={emptyMessage ?? "Nenhum registro para exibir."}
+       action={
+         emptyStateAction
+           ? {
+               label: emptyStateAction.label,
+               icon: emptyStateAction.icon,
+               allowInReadOnly: emptyStateAction.allowInReadOnly,
+               // read-only: neutraliza o onClick quando bloqueado (paridade
+               // EXATA com o `disabled` explícito de hoje — afordância inerte,
+               // não removida). O <Button> outline não auto-bloqueia (§2.2).
+               onClick: emptyActionBlocked
+                 ? () => {}
+                 : emptyStateAction.onClick,
+             }
+           : undefined
+       }
+     />
+   );
  }
```

- **Contrato preservado:** mesma posição no fluxo (`if (data.length === 0)
  return …` **depois** do `if (isLoading)`, **antes** do render real — ordem
  intacta). `emptyMessage`/`emptyStateAction` **continuam** as mesmas props, com
  o mesmo tipo (l.45/l.61-67 **não mudam**). Nenhum dos 17 callers muda.
- **`emptyMessage` retrocompat:** `emptyMessage ?? "Nenhum registro para
  exibir."` — quando o caller passa `emptyMessage` (os 17 passam), usa-se
  **exatamente** o texto do caller (zero mudança visível de copy). Quando
  **ausente** (hoje = `<p>` vazio), exibe um default seguro (**melhoria pura**,
  nunca regressão). `title` fixo `"Nada por aqui ainda"` é **adição** de
  hierarquia — não substitui o `emptyMessage`, que vira a **descrição**.
- **Read-only paridade EXATA (R3):** `emptyActionBlocked` reproduz
  **bit-a-bit** a condição do `disabled` de hoje
  (`isReadOnlyTenantView && !allowInReadOnly`). Quando bloqueado, o `onClick`
  vira no-op → a ação **não dispara** (paridade comportamental com o `disabled`
  atual). **Refinamento p/ o Front-End (R3, ponto de aprovação):** o ideal de
  a11y é o botão **renderizar `disabled`** (não só onClick inerte) — se o
  Front-End preferir manter `disabled` visual, estender `EmptyStateAction` com
  um campo interno `disabled?: boolean` repassado ao `<Button>` é aceitável
  (desvio aditivo, alinhado a este §; decidir no autorreview e registrar). O
  **mínimo não-negociável**: a ação **não executa** em read-only — como hoje.
- **`<Button>` import:** se após a edição o `<Button>` não for mais usado
  diretamente no `data-table.tsx` fora deste bloco, o Front-End **verifica**
  os outros usos (há ações de linha l.391 que usam `<Button>`) — **provável que
  o import permaneça**; **não** remover import ainda usado (lint). Nota em §6.

### 2.4 Default de ícone — decisão de produto (ponto de aprovação)

O `EmptyState` default `icon = Inbox` (lucide — "caixa de entrada vazia",
neutro, já no vocabulário lucide da casa). O DataTable **não** passa `icon`
(o `emptyStateAction.icon` é o ícone **do CTA**, não do herói) → todos os 17
callers ganham o **mesmo** ícone-herói neutro `Inbox`. **Ponto de aprovação
(R1):** ícone único neutro é o default seguro (consistência > novidade,
guard-rail); ícones por-contexto (produto/loja/pedido) seriam personalização
tela-a-tela = **UX-0009/Onda 2/3** (a API `icon?` já deixa isso aberto sem
churn). Decisão: **`Inbox` para todos no escopo de UX-0007**; per-tela adiado.

### 2.5 Título default — decisão de copy (não-copywriting; ponto de aprovação)

`title` default `"Nada por aqui ainda"` é **adição** de hierarquia (hoje não há
título). Não é reescrita de string existente (o `emptyMessage` do caller é
**preservado** como descrição) — está dentro do guard-rail "não-copywriter"
(skill: *"don't rewrite user-facing strings unless they're the UX problem"* — e
aqui o **vazio de hierarquia** é o problema F-5). Alternativa neutra
`"Sem registros"` registrada como opção de aprovação. **Sem `error`/`erro` na
string** (e2e §1.4). Decisão: `"Nada por aqui ainda"`; ajustável no Gate 1.

### 2.6 Fronteira — o que UX-0007 ADOTA vs o que ADIA (explícito)

| | **ADOTA (entra em UX-0007)** | **ADIA (não entra)** |
|---|---|---|
| **Primitivo** | Cria `shared/empty-state.tsx` (`EmptyState`) | — |
| **DataTable** | `data-table.tsx:219-238` → `EmptyState` (preserva `emptyMessage`/`emptyStateAction`/read-only) | bloco `isLoading` (já é `DataTableSkeleton`/UX-0003) — **não tocado** |
| **Listas/detalhe vazios FORA do DataTable** | — | os **8+ `border-dashed` ad-hoc** (`gestor-fabrica/page.tsx`, `sublinhas-producao`, `gestor-dados/*`, `[lineId]`, `administrador-master/*`) → **UX-0009 / Onda 2 (UX-0011/0014/0015/0016) / Onda 3** |
| **`impressao/**`** | — | **fora total** (Onda 3 lote E só herda token; [[Dívida Técnica#D17]] segurança fora) |
| **Ícone por-contexto / copy por-tela** | — | **adiado** — API `icon?`/`title?`/`description?` deixa aberto; personalização tela-a-tela = UX-0009/Onda 2/3 |

> **Princípio (skill Fase 3 / guard-rail do README):** UX-0007 = **primitivo +
> adoção no DataTable só**. A cascata para as 8+ telas com `border-dashed`
> ad-hoc é **deliberadamente** dos itens consumidores — fazer aqui violaria "1
> `UX-####` por commit" e seria escopo de UX-0009/Onda 2/3. A migração
> tela-a-tela **herda** este primitivo (contrato registrado no Changelog, §6).

---

## 3. Cobertura de estados / a11y / responsivo

### 3.1 Acessibilidade (WCAG 2.1/2.2 AA — guard-rail da iniciativa, métrica M5)

- **Estrutura semântica:** o EmptyState é uma **região de conteúdo estático**
  (não é status/live-region — diferente do skeleton UX-0003: o vazio é um
  **estado final legítimo**, não uma espera). Título e descrição são `<p>`
  textuais lidos na ordem natural; **sem `role` artificial** (ARIA só onde
  necessário — guard-rail "não over-aplicar"). O ícone é **`aria-hidden`**
  (decorativo — a informação está no título/descrição; um `aria-label` no ícone
  seria redundância ruidosa).
- **Foco do CTA (M5):** o CTA é o **`<Button>` UX-0004** — herda
  `focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px]`
  (l.12 do `button.tsx`), é `<button>` real (alcançável por Tab, operável por
  Enter/Espaço). **Zero regressão de foco** vs hoje (é o mesmo `<Button>`). Quando
  read-only, o botão fica inerte (onClick no-op ou `disabled` — §2.3) — a
  afordância **permanece visível** (não removida), atendendo "afordância
  desabilitada, não removida".
- **Contraste (fronteira UX-0006):** título `--foreground` sobre `--card` e
  descrição `--muted-foreground` sobre `--card` são **os mesmos pares já em uso
  hoje** (o `<p>` atual já é `text-muted-foreground` sobre `bg-card`) — UX-0007
  **não introduz par novo**; a auditoria formal de contraste é **UX-0006**
  (fronteira registrada). O ícone a `--opacity-prominent` é **decorativo**
  (`aria-hidden`) → não sujeito a 4.5:1 (não é texto/UI acionável).
- **Sem movimento:** o EmptyState **não tem animação** → `prefers-reduced-motion`
  é **não-aplicável** (nada a desligar). Registrado por completude (diferente do
  skeleton UX-0003, que exige `motion-reduce`).
- **Leitor de tela:** anuncia "Nada por aqui ainda. <descrição>. <label do CTA>,
  botão" — **paridade ou melhoria** vs o `<p>` cru de hoje (que anunciava só a
  mensagem). Informação **não removida**, **enriquecida**.

### 3.2 Responsivo

- O EmptyState vive **dentro da mesma moldura contida** do estado atual
  (`rounded-xl border bg-card shadow-card`, centralizado, `text-center`); usa
  `flex-col items-center` fluido + `max-w-sm` na descrição → **degrada
  graciosamente** em qualquer largura, **sem `min-w`/scroll-x** (não pioraria
  F-3; o fix responsivo do DataTable é **UX-0001** — fora deste item).
- `min-h-44` (≈ o `h-44` de hoje) como **mínimo** (não fixo) evita corte de
  conteúdo em viewports estreitas quando título+descrição+CTA quebram linha —
  **melhoria** sem regredir a altura mínima atual.
- Touch (loja/chão): o único alvo interativo é o `<Button size="sm">` (h-8) — o
  hit-target do shell touch é **UX-0010** (M7); UX-0007 **não** altera o
  tamanho do `<Button>` vs hoje (era `size="sm"`, continua `size="sm"`).

### 3.3 Estados cobertos

| Estado | Antes (hoje) | Depois (UX-0007) | Regressão? |
|---|---|---|:--:|
| **Empty** (DataTable, sem `emptyMessage`) | `<p>` **vazio** + (CTA?) | ícone + título + default seguro + (CTA?) | **melhora** (era pior) |
| **Empty** (DataTable, com `emptyMessage`) | `<p>` cinza com o texto do caller | ícone + título + **mesmo texto** (descrição) + (CTA?) | **não** (copy idêntico, +hierarquia) |
| **Empty + CTA, tenant normal** | `<Button>` ativo | `<Button>` ativo (mesmo onClick) | **não** |
| **Empty + CTA, read-only-tenant** | `<Button disabled>` (não dispara) | CTA inerte (onClick no-op / `disabled` — §2.3) | **não** (paridade) |
| **Loading** (DataTable) | `DataTableSkeleton` (UX-0003) | **inalterado** — fora do escopo | n/a |
| **Com dados** | tabela real | **idêntico** (EmptyState nem monta — `if` curto-circuita) | **não** |
| **Error** | (não há estado de erro no DataTable) | **inalterado** — fora do escopo (UX-0002 cobre erro de ação) | n/a |

> UX-0007 cobre **só Empty**. Loading/Error/Com-dados **não** são tocados
> (fronteira) — nem regride nem melhora; ficam para UX-0003/UX-0002/render real.

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas → ✅):

- [ ] **DataTable com dados = idêntico** — quando `data.length > 0`, o
      DataTable renderiza **o mesmo `<table>`/`<thead>`/`<tbody>`/ações** de
      hoje (o `if (data.length===0) return` curto-circuita **antes**; o
      EmptyState **nem monta** com dados). DOM pós-carga byte-a-byte igual.
- [ ] **`emptyMessage` retrocompat** — caller com `emptyMessage="…"` exibe
      **exatamente** esse texto (como descrição); caller **sem** `emptyMessage`
      passa a exibir o default seguro (antes era `<p>` vazio — **melhoria, não
      regressão**). Os **17 callers** não mudam (`git diff` não toca `src/app/**`).
- [ ] **`emptyStateAction` retrocompat** — `label`/`onClick`/`icon`/
      `allowInReadOnly` mapeados 1:1; CTA dispara o **mesmo `onClick`** quando
      não-bloqueado; **sem** CTA quando `emptyStateAction` ausente (igual hoje).
- [ ] **Read-only respeitado (paridade EXATA)** — em `read-only-tenant`, o CTA
      **não executa** a ação (onClick no-op / `disabled`), reproduzindo
      bit-a-bit `isReadOnlyTenantView && !allowInReadOnly` do bloco atual.
      Afordância **visível e desabilitada, não removida**. `allowInReadOnly`
      libera como hoje.
- [ ] **API do DataTable inalterada** — `emptyMessage?: string` e
      `emptyStateAction?: {…}` com o **mesmo tipo** (l.45/l.61-67 intactos);
      nenhum caller de `<DataTable>` quebra (`npx tsc --noEmit` exit 0).
- [ ] **e2e seletores pós-carga intactos** — `e2e/regression.py` 0-FAIL, PASS ≥
      baseline (≥26). `table thead th`, `get_by_text("Acompanhamento")`, colunas
      Kanban, `a[href*="/gestor-fabrica/…"]` (AJ-0002), textos AJ → **inalterados**
      (assert com dados; EmptyState nem monta). **Nenhum texto/`sr-only` do
      EmptyState contém a substring `error`**.
- [ ] **AJ-0013 ramo "sem agendadas é esperado" intacto** — em
      `/gestor-fabrica/ordens-producao` com fila vazia, o título de painel
      `"Fila de OPs"`/`"Agendadas (próximos dias)"` (chrome da página, **irmão**
      do DataTable) **permanece no `body()`** → `rec("AJ-0013","PASS")` continua
      (o EmptyState **não remove** chrome — só substitui o miolo do `if` interno
      ao DataTable).
- [ ] **Reuso-primeiro / sem dependência nova** — `package.json` inalterado;
      ícone via `lucide-react` (já dep), CTA via `<Button>` (já existe),
      `cn` já idioma. Sem `cva` (sem variantes), sem Radix/framer.
- [ ] **Só token / sem ad-hoc** — cor/opacidade **só** via `--foreground`/
      `--muted-foreground`/`--border-strong` + `--opacity-*`; espaçamento via
      `gap-rhythm-*`/`p-rhythm-*`; raio via `--radius-*`. `grep` no diff não
      acha `/NN` ad-hoc novo nem `oklch(` inline.
- [ ] **Sem animação** — nenhum `animate-*` no EmptyState (estático;
      `prefers-reduced-motion` não-aplicável).
- [ ] **Escopo: 2 arquivos** — `git diff --name-only` (src) =
      `empty-state.tsx` (novo) + `data-table.tsx`. **Nenhum** `src/lib/**`;
      **nenhum** `src/app/**`; **nenhum** caller (os 8+ `border-dashed` ad-hoc
      **não** tocados — fronteira §2.6).
- [ ] **Import não-órfão** — se `<Button>` continuar usado no `data-table.tsx`
      (ações de linha, l.391), o import **permanece**; lint sem `no-unused`.
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso.
- [ ] **Commit isolado revertível** — único commit `UX-0007`; `git revert`
      restaura o `<p>` cinza + `<Button>` sem colateral (só o DataTable consome
      `empty-state.tsx`).

---

## 5. Plano de verificação para o Front-End

Objetivo: provar que o **estado com dados é idêntico**, que **`emptyMessage`/
`emptyStateAction`/read-only** são retrocompat, e que **nenhum seletor e2e** (nem
o ramo vazio de AJ-0013) mudou.

1. **Escopo do diff (prova mecânica):**
   `git diff --name-only` → exatamente `src/components/shared/empty-state.tsx`
   (novo) + `src/components/shared/data-table.tsx`. **Nenhum** `src/lib/**`;
   **nenhum** `src/app/**` (os 17 callers e os 8+ ad-hoc **inalterados**).
2. **`error`-free + ad-hoc intacto:** `git diff | grep -in 'error'` no
   `empty-state.tsx`/bloco do DataTable = **vazio** (e2e §1.4).
   `grep -rc 'border-dashed' src/app | grep -v ':0'` → contagem das 8+ molduras
   ad-hoc **inalterada** (fronteira §2.6 respeitada).
3. **TS / retrocompat dos callers:** `npx tsc --noEmit` **exit 0** — prova que
   `emptyMessage?: string` / `emptyStateAction?: {…}` mantêm o tipo e que
   **nenhum dos 17 callers** de `<DataTable>` quebra. `npm run lint` 0 erro novo
   (incl. import `<Button>` não-órfão se ainda usado em ações de linha).
4. **`npm test`** verde (sem regressão dos testes — 110 esperados, ver
   [[UX-0003 — skeleton-loading|UX-0003 §7.5]]).
5. **`npm run build`** (`next build`) verde — Tailwind 4 resolve
   `border-border-strong/[var(--opacity-border)]` /
   `text-muted-foreground/[var(--opacity-prominent)]` / `gap-rhythm-*`
   (precedente provado: `toast.tsx:45`).
6. **Smoke visual + retrocompat, 6 personas** (`e2e/README.md` /
   [[e2e-playwright-setup]] na memória do projeto):
   logar nas 6 personas; abrir telas com DataTable **com dados**
   (`gestor-dados/produtos`, `gestor-fabrica/ordens-producao`,
   `loja/pedidos`, `administrador/usuarios`…) → tabela **idêntica** (EmptyState
   não monta). Forçar **≥1 lista vazia** (ex.: filtro sem resultado, ou tenant
   sem catálogo no dia) → o EmptyState aparece com ícone+título+descrição
   (= o `emptyMessage` do caller, **mesmo texto**) + CTA (se houver).
   **Read-only:** numa persona/tenant read-only com lista vazia + CTA →
   confirmar que o CTA **não dispara** a ação (afordância visível, inerte).
   **Canário:** 1 tela **sem** DataTable (ex.: um perfil) — pixel-idêntica.
7. **Runner E2E de não-regressão (âncora M6):**
   `e2e/regression.py` (versionado — [[e2e-playwright-setup]] na memória do
   projeto / [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0 D-0]])
   → **0-FAIL**, PASS **≥ baseline (≥26)**, 6 personas. `table thead th`,
   `Acompanhamento`, Kanban, `a[href*=…]` (AJ-0002), AJ-textos **inalterados**.
   **Verificação específica AJ-0013:** confirmar que o `rec("AJ-0013",…)`
   continua **PASS** (casa `"Fila de OPs"`/`"Agendadas (próximos dias)"` no
   `body()` — título de painel, chrome de página, **não** o `emptyMessage`).
   Qualquer queda = parada + rollback do item (regra do plano de orquestração).

> Critério de aprovação do Gate 1 p/ este item: passos 1-7 verdes **e**
> checklist §4 100% marcado no autorreview.

---

## 6. Riscos & notas de implementação (para o Front-End)

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | Ícone/título/copy default não agradam (decisão de produto) | Média | Baixo | **Ponto de aprovação** (§2.4/§2.5): `Inbox` + `"Nada por aqui ainda"`. Ícone/título por-contexto = UX-0009/Onda 2/3 (API já aberta, sem churn). Ajustável no Gate 1. |
| **R2** | Front-End migrar os **8+ `border-dashed` ad-hoc** dentro de UX-0007 (escopo UX-0009/Onda 2/3) | Média | Alto | Fronteira escrita (§2.6, §1.2). Passo 1-2 da verificação **reprova** qualquer `src/app/**` no diff e qualquer queda na contagem `border-dashed`. |
| **R3** | Read-only enfraquecido: `<Button>` outline **não** auto-bloqueia (§2.2) → confiar só no `<Button>` deixaria o CTA clicável em read-only | **Alta se ignorado** | **Alto** | **Não-negociável:** preservar o `disabled`/onClick-inerte **explícito** no mapeamento do DataTable (§2.3) reproduzindo `isReadOnlyTenantView && !allowInReadOnly`. Passo 6 (smoke read-only) é o canário. Preferir `disabled` visual (a11y) — ponto de aprovação no autorreview. |
| **R4** | Texto do EmptyState contém `error`/`erro` → falso-FAIL no `screen_ok` body-check | Baixa | Médio | Defaults fixos sem `error` (`"Nada por aqui ainda"`/`"Nenhum registro para exibir."`). Passo 2 (`grep -in error`) prova. Atenção: callers podem passar `emptyMessage` — nenhum dos 17 atuais contém `error` (grep §1.2: "Nenhum/Nenhuma … encontrado/a"). |
| **R5** | AJ-0013 ramo-vazio quebra se o EmptyState "comer" o título de painel | Baixa | Alto | O EmptyState só substitui o **miolo do `if (data.length===0)` interno ao DataTable**; o título `"Fila de OPs"`/`"Agendadas (próximos dias)"` é **irmão** do DataTable (chrome da tela), **não** filho — permanece no `body()`. Passo 7 (verificação AJ-0013 explícita) é o canário. §1.4 mapeia. |
| **R6** | Import `<Button>` vira órfão no `data-table.tsx` após a edição → lint `no-unused` | Baixa | Baixo | `<Button>` ainda usado nas ações de linha (`data-table.tsx:391`) → import **permanece**. Front-End confirma com `grep -n '<Button' data-table.tsx` antes de mexer no import. Passo 3 (`npm run lint`). |
| **R7** | Sintaxe Tailwind 4 `border-border-strong/[var(--opacity-border)]` não compilar | Baixa | Baixo | **Precedente provado:** `shared/toast.tsx:45` usa `bg-success/[var(--opacity-faint)]` e compila/roda (UX-0002 commitado). Passo 5 confirma. |
| **R8** | UX-0001 (DataTable responsivo) vai reformar a moldura/fluxo onde o EmptyState vive → retrabalho | Baixa | Baixo | EmptyState usa `flex` fluido + `max-w-sm` (sem `min-w`/scroll-x) → degrada ok. Nota de dependência: quando UX-0001 entrar, o empty no fallback card pode ser revisitado (fora deste item; registrado). |

**Notas de implementação:**

- **Ordem de toque (plano):** UX-0007 vem **após UX-0005/0002/0003/0004
  (commitados)**, na leva "primitivos de estado" da Onda 1
  ([[Backlog UX (RICE)]] §Sequência). Commit isolado `UX-0007`.
- **Espelhar `shared/toast.tsx`/`shared/skeleton.tsx`** na forma do arquivo
  (`"use client"`, header `/* UX-0007 — */`, `cn`, `data-slot`, export nomeado
  no fim) — consistência arquitetural de primitivo da casa. **Sem `cva`** aqui é
  intencional (não há variantes reais; `size` é um booleano disfarçado — um
  ternário em `cn()` é mais simples e idiomático que `cva` p/ 2 valores).
- **Reversibilidade:** `git revert` do commit restaura o `<p>` cinza +
  `<Button>` inline; como só o DataTable consome `empty-state.tsx`, a reversão
  é garantidamente sem colateral.
- **Não introduzir** dark-mode, ilustração (SVG/animada), `cva`, nem dependência
  (Radix/framer/react-icons) — fora de escopo / guard-rail.
- **Decisão R3 no autorreview:** o Front-End **deve** registrar se optou por
  `onClick` no-op ou `disabled` visual no CTA read-only — o **mínimo** é "não
  executa"; o **preferível (a11y)** é `disabled` visível. Se estender
  `EmptyStateAction` com `disabled?: boolean` interno, documentar como desvio
  aditivo alinhado a §2.3.
- **Entregar no autorreview/Changelog** ([[10 - Changelog Vivo/2026-05|Changelog
  do mês]], template em `Docs/10 - Changelog Vivo/Template — Entrada de
  Changelog.md`): a API do `EmptyState` + a nota de fronteira (§2.6) — é o
  contrato que UX-0009/Onda 2/3 vão consumir para a cascata tela-a-tela das 8+
  molduras `border-dashed` ad-hoc.

---

## 7. Autorreview (Front-End)

> _Preenchido pelo agente `frontend-design-senior` (skill `/frontend-design`
> aplicada no 1º passo) **após aprovação explícita do usuário**. Não commitado /
> sem build / sem e2e até o Gate 1 (orquestrador). Seções 7.1–7.6 espelham o
> formato de [[UX-0003 — skeleton-loading|UX-0003 §7]] e
> [[UX-0004 — botao-enviando|UX-0004 §7]]._

Skill `/frontend-design` aplicada no 1º passo (rigor de tokens/escala/zero-regressão
sobre primitivo da casa — não UI nova). Implementado após aprovação do usuário
(Onda 1, loop autônomo). **Não commitado / sem build / sem e2e** (Gate 1 =
orquestrador).

### 7.1 Resumo do diff (2 arquivos `src/`)

- **`src/components/shared/empty-state.tsx` (NOVO)** — primitivo conforme §2.1.
  `"use client"`, `import * as React`, header `UX-0007`, `cn`, `data-slot` em
  cada nó, export nomeado no fim — espelha `shared/toast.tsx`/`skeleton.tsx`.
  **Sem `cva`** (sem variantes reais; `size` = ternário em `cn()`), **sem
  animação**, **zero dependência nova** (`Inbox`/`LucideIcon` de `lucide-react`
  já dep; `<Button>` UX-0004 já existe; `cn` já idioma). Cor/opacidade **só**
  token: `border-border-strong/[var(--opacity-border)]` (0.35 = **mesmo valor**
  do ad-hoc `/35`, agora canônico), `text-muted-foreground/[var(--opacity-prominent)]`
  (ícone, decorativo `aria-hidden`), `text-foreground` (título),
  `text-muted-foreground` (descrição — **mesmo par** `<p>` atual). Espaçamento
  `gap-rhythm-sm`/`px-rhythm-lg`/`py-rhythm-lg`/`mt-rhythm-2xs`; `min-h-44`
  (= `h-44` atual como **mínimo**, não fixo); `max-w-sm` na descrição.
- **`src/components/shared/data-table.tsx` (EDIT — 2 hunks)** —
  (a) `+ import { EmptyState } from "@/components/shared/empty-state";`;
  (b) corpo do `if (data.length === 0)` (era l.219-238) → `<EmptyState
  description={emptyMessage} action={…}/>`. **Nada mais** (props l.45/l.61-67,
  ordem do fluxo, `isLoading`/`DataTableSkeleton`, render real **intocados**).
  `<Button>` continua importado e usado nas ações de linha → import não-órfão.

`git diff --name-only` (src) = **exatamente** os 2 arquivos acima. **Nenhum**
`src/lib/**`, **nenhum** `src/app/**`, **nenhum** dos 17 callers; contagem
`border-dashed` em `src/app` **inalterada (7 arquivos)** — fronteira §2.6 (R2)
respeitada. (`Docs/.obsidian/workspace.json` aparece no diff por ser estado de
UI auto-gerenciado do Obsidian — não é edição de conteúdo do vault por mim.)

### 7.2 Prova de retrocompatibilidade (requisito-âncora #1)

- **API do DataTable inalterada:** `emptyMessage?: string` e `emptyStateAction?:
  {…}` mantêm tipo e semântica (linhas de declaração não editadas). `npx tsc
  --noEmit` **exit 0** → prova que os **17 callers** de `<DataTable>` compilam
  sem nenhuma edição.
- **Com dados = byte-idêntico:** o `if (data.length === 0) return` continua
  **depois** do `if (isLoading)` e **antes** do render real (ordem intacta) e
  **curto-circuita** — o `EmptyState` **nem monta** com dados; o
  `<table>`/`<thead>`/`<tbody>`/ações/paginação são exatamente os de hoje.
- **`emptyMessage` nunca sobrescrito:** descoberta de precisão — o DataTable
  **já** tem `emptyMessage = "Nenhum registro encontrado"` no destructuring
  (não citado na §1.2 da spec, que assumia `<p>` cru sem fallback). Logo
  `emptyMessage` chega ao bloco **sempre como string não-vazia** (a do caller —
  os 17 passam literal — ou esse default pré-existente). Passei
  `description={emptyMessage}` **direto**, sem `??`: a copy renderizada é
  **exatamente** a de hoje para os 17 callers e para o caso default. O
  `EmptyState.description` default (`"Nenhum registro para exibir."`) só agiria
  se `description` fosse `undefined` — **nunca o caso a partir do DataTable**
  (defesa inerte; não altera nenhum caller). O `title` (`"Nada por aqui ainda"`)
  é **adição** de hierarquia, **não** substitui `emptyMessage` (que vira a
  descrição) — guard-rail "não-copywriter" respeitado.
- **`emptyStateAction` 1:1:** `label`/`onClick`/`icon`/`allowInReadOnly`
  mapeados sem perda; CTA dispara o **mesmo `onClick`** quando não-bloqueado;
  **sem** CTA quando `emptyStateAction` ausente (idêntico a hoje). Caller real
  verificado: `administrador-master/clientes/page.tsx:404` passa
  `{label,onClick,icon}` — mapeia 1:1.

### 7.3 Prova da trava read-only preservada (R3 — não-negociável)

Bloco atual passava ao `<Button>`:
`disabled={isReadOnlyTenantView && !emptyStateAction.allowInReadOnly}` +
`allowInReadOnly`. O `<Button>` (UX-0004 `button.tsx:94-97`) só auto-bloqueia
`variant === "default"|"destructive"|type==="submit"` → o CTA `variant="outline"`
**não** seria travado pelo `<Button>` sozinho. **A trava efetiva sempre veio do
`disabled` explícito do DataTable** — e foi **preservada bit-a-bit**:

- DataTable calcula `disabled: isReadOnlyTenantView && !emptyStateAction.allowInReadOnly`
  (**condição idêntica** à linha removida) e injeta no `action.disabled`.
- `EmptyState` repassa `action.disabled` **direto** ao `<Button disabled={…}>`
  (`button.tsx:99` faz `disabled = props.disabled || …` → a prop nativa é
  honrada) **e** repassa `allowInReadOnly` (defesa-em-profundidade p/ o caso
  default/submit). O primitivo **não** importa `readClientAccessContext` —
  contrato de acesso permanece no consumidor (desacoplado).
- **Decisão R3 registrada:** optei pelo `disabled` **visual** (não `onClick`
  no-op) — é o caminho **preferível de a11y** indicado na §2.3/§6 (botão
  renderiza `disabled`, anuncia estado desabilitado, recebe o styling
  `disabled:opacity-45` do `<Button>`). Para isso estendi `EmptyStateAction`
  com um campo interno **aditivo** `disabled?: boolean` repassado ao `<Button>`
  — **desvio aditivo explicitamente sancionado pela §2.3** ("estender
  `EmptyStateAction` com um campo interno `disabled?: boolean` repassado ao
  `<Button>` é aceitável (desvio aditivo, alinhado a este §)"). Não há campo
  `disabled` na superfície que algum caller use; é interno ao mapeamento
  DataTable→EmptyState. Afordância **visível e desabilitada, não removida**.

### 7.4 Checklist §4 — "funcionalidade preservada"

- [x] **DataTable com dados = idêntico** — `if (data.length===0) return`
      curto-circuita; EmptyState não monta com dados; render real intocado.
- [x] **`emptyMessage` retrocompat** — `description={emptyMessage}` direto, sem
      `??`; copy idêntica p/ os 17 callers e p/ o default pré-existente; nenhum
      caller editado (§7.2).
- [x] **`emptyStateAction` retrocompat** — `label`/`onClick`/`icon`/
      `allowInReadOnly` 1:1; sem CTA quando ausente.
- [x] **Read-only respeitado (paridade EXATA)** — `disabled` reproduz bit-a-bit
      `isReadOnlyTenantView && !allowInReadOnly`; afordância visível e
      desabilitada (§7.3).
- [x] **API do DataTable inalterada** — tipos l.45/l.61-67 intactos;
      `npx tsc --noEmit` exit 0.
- [x] **e2e seletores pós-carga intactos** — asserts são com dados (EmptyState
      não monta); nenhum texto/`sr-only` do EmptyState contém `error`
      (`grep -in error` nos 2 arquivos = vazio). _(execução do runner = Gate 1.)_
- [x] **AJ-0013 ramo "sem agendadas" intacto** — EmptyState só substitui o
      miolo do `if` interno ao DataTable; "Fila de OPs"/"Agendadas (próximos
      dias)" é chrome irmão, **não** filho → permanece no `body()`.
      _(verificação explícita = Gate 1.)_
- [x] **Reuso-primeiro / sem dependência nova** — `package.json` inalterado;
      `Inbox`/`LucideIcon`/`<Button>`/`cn` já existentes; sem `cva`/Radix/framer.
- [x] **Só token / sem ad-hoc** — `--foreground`/`--muted-foreground`/
      `--border-strong` + `--opacity-border`/`--opacity-prominent`;
      `gap/px/py/mt-rhythm-*`; `rounded-xl`. Nenhum `/NN` ad-hoc novo
      (o `mr-1.5 size-4` do ícone do CTA é **cópia literal** do bloco antigo —
      não-regressão), nenhum `oklch(` inline.
- [x] **Sem animação** — nenhum `animate-*` no EmptyState.
- [x] **Escopo: 2 arquivos** — `git diff --name-only` (src) = `empty-state.tsx`
      (novo) + `data-table.tsx`; nenhum `src/lib/**`/`src/app/**`/caller;
      `border-dashed` em `src/app` = 7 (inalterado).
- [x] **Import não-órfão** — `<Button>` segue usado nas ações de linha
      (`grep -c '<Button' data-table.tsx` = 2); import permanece; lint sem
      `no-unused`.
- [x] **Lint/tsc/test verdes** — `npm run lint` (changed) 0 problema;
      `npx tsc --noEmit` exit 0; `npm test` **110/110 pass, 0 fail**.
      _(`npm run build` e `e2e` = Gate 1, orquestrador.)_
- [x] **Commit isolado revertível** — só o DataTable consome `empty-state.tsx`;
      `git revert` do (futuro) commit restaura o `<p>` cinza + `<Button>` inline
      sem colateral.

→ **Checklist §4: 13/13 ✅** (os 2 itens marcados "execução = Gate 1" são
provados *por construção* aqui — EmptyState não monta com dados e não remove
chrome irmão; a execução do runner é do orquestrador, conforme o plano).

### 7.5 Lint / tsc / test (saída)

- `npx eslint src/components/shared/empty-state.tsx src/components/shared/data-table.tsx`
  → **0 problemas**. _(Nota: um erro de parse inicial — `*/` aninhado de um
  `UX-####` literal dentro do header de bloco — foi corrigido reescrevendo o
  comentário sem terminador aninhado; lint reexecutado limpo.)_
- `npx tsc --noEmit` → **exit 0** (sem novo erro; prova retrocompat dos callers).
- `npm test` → **tests 110 · pass 110 · fail 0** (= baseline UX-0003 §7.5).
- `npm run lint` global: warnings remanescentes são **pré-existentes** (dead
  code [[Backlog de Ajustes#AJ-0023 — Dead code descoberto durante a Onda 1|AJ-0023]],
  `<img>` sidebar, etc.) — **nenhum** introduzido pelos 2 arquivos de UX-0007.

### 7.6 Desvios / notas

- **Desvio aditivo (sancionado §2.3):** `EmptyStateAction.disabled?: boolean`
  interno, para o CTA read-only renderizar `disabled` visual (a11y preferível)
  em vez de `onClick` no-op. Alinhado à §2.3/§6; superfície pública intacta
  (nenhum caller usa esse campo — é interno ao mapeamento do DataTable).
- **Precisão vs §1.2 da spec:** a spec assumia `<p>` renderizando `{emptyMessage}`
  cru sem fallback. O código real tem `emptyMessage = "Nenhum registro
  encontrado"` no destructuring (default pré-existente). Consequência: o
  `description ?? "Nenhum registro para exibir."` da §2.3 seria **dead code** a
  partir do DataTable; passei `description={emptyMessage}` direto → retrocompat
  **mais forte** que a especificada (copy byte-idêntica garantida, sem depender
  do default do primitivo). O default do `EmptyState` permanece como defesa
  para usos futuros fora do DataTable (Onda 2/3).
- **Comentário sintaxe:** o header do primitivo não pode conter `*/` literal
  (fecharia o bloco). `UX-####` referido sem o par de comentário aninhado.
- Sem dark-mode, sem ilustração, sem `cva`, sem dependência nova — guard-rails
  respeitados.
