# UX-0002 — Sistema de toast/feedback (substitui os 17 `window.alert`/`window.confirm`)

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner`). Companheira de [[Backlog UX (RICE)]] (item l.32 e l.67-73),
> [[UX PRD]] (critérios "Estado", §6; métrica M1/M5; resolução Gate 0 §10),
> [[UX Audit — Sistema]] (achado [[UX Audit — Sistema#F-1 — Ausência de sistema de feedback (toast/notificação) · 🔴 · Estado|F-1]]).
> Convenção: [[12 - Iniciativa UX/README|README]]. Dedupe vs
> [[Backlog de Ajustes#AJ-0006]] e [[Backlog de Ajustes#AJ-0007]].

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, navegação nem `permission-modules`**.
  Cada ação dos 17 sítios (criar/atualizar/cancelar/reabrir/clonar/liberar)
  mantém **exatamente** o mesmo efeito — **só muda COMO o sistema comunica**, não
  O QUE a ação faz.
- **Reuso-primeiro.** Antes de criar, verifiquei os 18 shared + 18 `ui/` + as deps.
  `radix-ui@^1.4.3` (pacote unificado, já instalado) **exporta `Toast` e
  `AlertDialog`** (confirmado em `node_modules/radix-ui` → `Toast,AlertDialog`;
  pacotes `react-toast`/`react-alert-dialog` presentes). **Zero dependência nova.**
  O `Dialog` shadcn da casa (`src/components/ui/dialog.tsx`, sobre
  `radix-ui` `Dialog`) é o **precedente arquitetural** a espelhar.
- **Só apresentação do feedback.** O escopo é (a) criar **um** primitivo de toast
  + provider, (b) **um** primitivo de confirmação destrutiva (`AlertDialog`), e
  (c) trocar os 17 sítios `alert`/`confirm` por eles. Nenhuma outra mudança de UI
  nessas telas — o **polimento das telas** é UX-0011/0013/0014 etc. (fronteira §6).
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa
  posterior, **após aprovação explícita do usuário**. Esta spec **não toca
  `src/`**.
- **Não regredir AJ-0006/AJ-0007.** [[Backlog de Ajustes#AJ-0006]] já removeu 1
  `confirm` (alerta de "mínimo produtivo"); [[Backlog de Ajustes#AJ-0007]]
  resolveu o aviso de duplicidade. UX-0002 **complementa** — não reintroduz texto
  removido, não regride o aviso, não toca os asserts do `e2e/regression.py`
  (ver §5/§6).
- **Pré-requisito de tela:** [[Backlog UX (RICE)|UX-0011]] (loja/pedidos) e
  [[Backlog UX (RICE)|UX-0013]] (gestor-fabrica/pedidos) **consomem** o primitivo
  definido aqui. UX-0002 entrega o primitivo + a troca dos 17 sítios; o polimento
  visual das telas-piloto é dos itens da Onda 2.

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como motor de análise (Fase 1 auditoria do
sistema → Fase 2 diagnóstico → Fase 3 plano contra o sistema existente). Achados
consolidados (categoria **Estado**, achado **F-1**):

1. **Zero canal de feedback de produto** ("missing feedback after actions" do
   checklist UX da skill). Varredura confirma: **nenhum** `sonner`/`useToast`/
   `toast(`/`Toaster`/`@radix-ui/react-toast` em `src/` (grep §1.2). Toda
   confirmação de sucesso/erro é um diálogo **nativo do browser**.
2. **`window.alert` como canal de erro/sucesso** (Nielsen #1 Visibilidade do
   estado): bloqueia a thread de UI, não estilizável, não respeita o tema/tokens
   da casa, sem `aria-live`, quebra o fluxo touch da loja (modal nativo no
   celular do balcão).
3. **`window.confirm` em ação destrutiva** ("error states / destructive
   confirmation"): cancelamento/reabertura/clone/liberação confirmados por
   diálogo do browser — não acessível, não estilizável, **bloqueante síncrono**
   (trava o event loop até o usuário responder).
4. **Risco de dado** (cruza [[Dívida Técnica#D03]]): na loja, sem toast de
   sucesso, o usuário não sabe se gravou → **re-submete → pedido duplicado**
   (exatamente a "voz do usuário" do [[UX PRD#1. Problema / Oportunidade]]).

UX-0002 ataca **(1)–(4)**: substitui o canal nativo por (A) toast acessível para
informativo/sucesso/erro e (B) `AlertDialog` para confirmação destrutiva.

### 1.2 Evidência real — grep dos 17 sítios

Comando: `grep -rnoE 'window\.(alert|confirm|prompt)\s*\(' src/app src/components`
(2026-05-19). **0 `prompt`. 17 ocorrências** (`alert` 10 · `confirm` 7), em **6
arquivos / 6 telas** — confirma e completa a lista do backlog (l.69):

| # | Arquivo : linha | Tipo | Ação afetada (fluxo — **não muda**) | Mensagem (resumo) | → Padrão alvo |
|:--:|---|:--:|---|---|---|
| 1 | `src/app/loja/pedidos/page.tsx:612` | `alert` | Validação pré-confirmação: nenhum item selecionado (em `handleOpenOrderConfirmation`) — **`return` early, não submete** | "Selecione ao menos um item disponível com quantidade positiva." | **toast `warning`** |
| 2 | `src/app/loja/pedidos/page.tsx:623` | `confirm` | Aviso: filtro ativo + categorias sem itens; `if (!proceed) return` antes de abrir confirmação | "Você está com filtro ativo… Deseja finalizar assim mesmo?" | **`AlertDialog` (não-destrutivo, "prosseguir/voltar")** |
| 3 | `src/app/loja/pedidos/page.tsx:643` | `alert` | Mesma validação de (1) no `handleConfirmOrderSubmission`; fecha confirmação + `return` | "Selecione ao menos um item disponível com quantidade positiva." | **toast `warning`** |
| 4 | `src/app/loja/pedidos/page.tsx:673` | `alert` | **Erro** de `createOrder`/`updateOrder` no `catch`; fecha confirmação | msg do erro \| "Falha ao criar/atualizar pedido…" | **toast `error`** |
| 5 | `src/app/loja/pedidos/[orderId]/page.tsx:177` | `alert` | Validação: edição sem item com qtd positiva — **`return`, não chama `updateOrder`** | "O pedido precisa manter pelo menos um item com quantidade positiva." | **toast `warning`** |
| 6 | `src/app/loja/pedidos/[orderId]/page.tsx:235` | `confirm` | **Cancelar pedido** (`handleCancelOrder`): `if (!confirmed) return; await cancelOrder(order.id)` | "Cancelar o pedido {code}?" | **`AlertDialog` destrutivo** |
| 7 | `src/app/gestor-fabrica/pedidos/page.tsx:203` | `alert` | Bloqueio: pedido já liberado não pode cancelar — `return` (não chama `cancelOrder`) | "Pedidos já liberados para produção precisam ser tratados pelo fluxo operacional…" | **toast `warning`** |
| 8 | `src/app/gestor-fabrica/pedidos/page.tsx:207` | `confirm` | **Cancelar pedido** (`handleCancelOrder`): `if (confirmed) void cancelOrder(order.id)` | "Cancelar o pedido {code} da loja {store}? Sairá da fila operacional…" | **`AlertDialog` destrutivo** |
| 9 | `src/app/gestor-fabrica/pedidos/page.tsx:217` | `confirm` | **Reabrir pedido** (`handleReopenOrder`): `if (confirmed) void reopenOrder(order.id)` | "Reabrir o pedido {code}? Volta a poder ser liberado…" | **`AlertDialog` (confirmação, não destrutivo)** |
| 10 | `src/app/gestor-fabrica/pedidos/[orderId]/page.tsx:203` | `confirm` | **Reabrir pedido** (botão "Reabrir pedido"): `if (window.confirm(...)) void reopenOrder(order.id)` | "Reabrir o pedido {code}?" | **`AlertDialog` (confirmação)** |
| 11 | `src/app/gestor-fabrica/pedidos/[orderId]/page.tsx:218` | `confirm` | **Cancelar pedido** (botão "Cancelar pedido"): `if (window.confirm(...)) void cancelOrder(order.id)` | "Cancelar o pedido {code}? Sairá do fluxo operacional…" | **`AlertDialog` destrutivo** |
| 12 | `src/app/gestor-dados/produtos/page.tsx:162` | `confirm` | **Clonar produto** (`handleCloneProduct`): `if (!window.confirm(...)) return` antes do `fetch POST /clone` | "Deseja clonar o produto \"{name}\"? Uma cópia inativa será criada." | **`AlertDialog` (confirmação, não destrutivo)** |
| 13 | `src/app/gestor-dados/produtos/page.tsx:171` | `alert` | **Erro** do clone (`!response.ok`): `return` após avisar | payload.message \| "Falha ao clonar produto." | **toast `error`** |
| 14 | `src/app/gestor-dados/produtos/page.tsx:176` | `alert` | **Sucesso** do clone (após `refresh(true)`) | "Produto clonado com sucesso! Código: {code}" | **toast `success`** |
| 15 | `src/app/gestor-dados/produtos/page.tsx:178` | `alert` | **Erro** inesperado do clone (`catch`) | "Erro inesperado ao clonar produto." | **toast `error`** |
| 16 | `src/app/gestor-dados/linhas-producao/page.tsx:582` | `alert` | **Erro** ao criar categoria (`catch` do submit do dialog) | msg do erro \| "Falha ao criar categoria" | **toast `error`** |
| 17 | `src/app/gestor-dados/linhas-producao/page.tsx:642` | `alert` | **Erro** ao criar tipo de linha (`catch` do submit do dialog) | msg do erro \| "Falha ao criar tipo" | **toast `error`** |

> **Total real: 17** (`alert` ×10, `confirm` ×7), **0 `prompt`**, **6 telas**.
> Bate **exatamente** com [[UX Audit — Sistema#F-1]] e o backlog. Distribuição:
> `loja/pedidos/page.tsx` 4 · `loja/pedidos/[orderId]` 2 ·
> `gestor-fabrica/pedidos/page.tsx` 3 · `gestor-fabrica/pedidos/[orderId]` 2 ·
> `gestor-dados/produtos` 4 · `gestor-dados/linhas-producao` 2.

**Classificação semântica (define a variante do primitivo):**

| Classe | Sítios | Vira |
|---|---|---|
| **Erro** (catch / `!ok`) | 4, 13, 15, 16, 17 | toast `error` |
| **Sucesso** (ação concluiu) | 14 | toast `success` |
| **Validação/bloqueio** (early-`return`, ação **não** dispara) | 1, 3, 5, 7 | toast `warning` |
| **Confirmação destrutiva** (cancelar pedido) | 6, 8, 11 | `AlertDialog` destrutivo |
| **Confirmação não-destrutiva** (reabrir, clonar, prosseguir-com-filtro) | 2, 9, 10, 12 | `AlertDialog` (tom padrão) |

> ⚠️ **Nota crítica de semântica (R1, §6):** os 7 `confirm` são **síncronos
> bloqueantes** — o código faz `if (window.confirm(...)) { ação }` ou
> `if (!confirm) return` **na mesma pilha de execução**. `AlertDialog` é
> **assíncrono** (resolve por callback de botão). A spec especifica o **padrão de
> preservação de semântica** (§2.4) para que o fluxo de cada ação permaneça
> **idêntico** — a ação só roda se o usuário confirmar, exatamente como hoje.

### 1.3 Sistema de design existente (Fase 1 da skill — baseline a respeitar)

- **Stack:** Next.js 16, React 19, Tailwind 4, `radix-ui@^1.4.3` (pacote
  unificado), `lucide-react` (ícones), `class-variance-authority` + `cn()`
  (`@/lib/utils`). Sem `sonner`, sem `framer-motion`.
- **Precedente de overlay (a espelhar):** `src/components/ui/dialog.tsx` —
  shadcn sobre `radix-ui` `Dialog`. Convenções da casa a herdar **literalmente**:
  - `import { Dialog as DialogPrimitive } from "radix-ui";` (named import do
    pacote unificado — **não** `@radix-ui/react-*`).
  - `data-slot="…"` em cada parte (`dialog-content`, `dialog-overlay`…).
  - Overlay: `bg-[color-mix(in_oklch,var(--foreground)_30%,transparent)]/35
    backdrop-blur-sm` + `data-[state=open]:animate-in fade-in-0` /
    `data-[state=closed]:animate-out fade-out-0`.
  - Content: `bg-card border border-border/85 rounded-xl p-6
    shadow-[var(--shadow-elevated)]`, `zoom-in-95`/`zoom-out-95`.
  - `DialogTitle` `font-heading text-lg font-semibold`; `DialogDescription`
    `text-muted-foreground text-sm`; footer
    `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`.
  - Botão de fechar: `focus:ring-ring focus:ring-2 focus:outline-none`,
    `<span className="sr-only">`.
- **Tokens disponíveis** (`globals.css`): semânticos `success`/`warning`/
  `danger`/`info`/`destructive` + `*-foreground`; `card`/`popover`/`border`/
  `ring`; **`--shadow-elevated`/`--shadow-popover`**; **(novos de UX-0005, já
  implementado)** `--opacity-*` (`faint .10`…`prominent .78`) e
  `--spacing-rhythm-*` (`3xs`…`2xl`). UX-0002 **usa** esses tokens onde fizer
  sentido (cor da borda/wash do toast, ritmo de padding) — **não** reintroduz
  opacidade ad-hoc.
- **Provider existente:** `src/app/layout.tsx` monta
  `<TooltipProvider>{children}</TooltipProvider>` dentro de `<body>`. É o **ponto
  natural** para aninhar o `ToastProvider`/`Toaster` (§2.3).
- **`Button`** (`src/components/ui/button.tsx`): variantes
  `default/destructive/outline/secondary/ghost/link`, tamanhos, **`asChild`**, e
  **trava de read-only-tenant** (bloqueia `default`/`destructive`/`submit` se
  `accessMode === "read-only-tenant"`). O `AlertDialog` da casa **deve usar este
  `Button`** para o botão de ação (herda a trava read-only automaticamente).

---

## 2. Spec de refinamento

> Implementação (etapa posterior do Front-End): **2 arquivos novos** em
> `src/components/shared/` + **1 edição mínima** em `src/app/layout.tsx` + a
> troca pontual nos 6 arquivos de tela. **Reuso-primeiro:** ambos os primitivos
> são finos wrappers de `radix-ui` (`Toast`, `AlertDialog`) — **sem dependência
> nova** — espelhando o estilo de `ui/dialog.tsx`.

### 2.1 Primitivo de toast — `src/components/shared/toast.tsx`

Wrapper sobre `radix-ui` `Toast` (`import { Toast as ToastPrimitive } from
"radix-ui";`). Headless + estilo da casa, **mesma gramática visual** do
`ui/dialog.tsx`.

**Componentes exportados:**

| Export | Base Radix | Papel |
|---|---|---|
| `ToastProvider` | `Toast.Provider` | contexto + `swipeDirection` + `duration` default |
| `ToastViewport` | `Toast.Viewport` | região fixa onde os toasts empilham |
| `Toast` | `Toast.Root` | um toast (estilizado por variante) |
| `ToastTitle` | `Toast.Title` | título curto |
| `ToastDescription` | `Toast.Description` | corpo (mensagem do erro etc.) |
| `ToastClose` | `Toast.Close` | botão "dispensar" (X + `sr-only`) |
| `ToastAction` | `Toast.Action` | opcional (não usado pelos 17 sítios; previsto p/ futuro) |

**Variantes** (via `cva`, espelhando `buttonVariants`):

| Variante | Uso | Token de cor (sem ad-hoc) | Ícone lucide | `aria-live` (ver §3) |
|---|---|---|---|---|
| `success` | sítio 14 | `border-success/(--opacity-border)`, accent `text-success`, wash `bg-success/(--opacity-faint)` | `CheckCircle2` | `polite` / `role=status` |
| `error` | sítios 4,13,15,16,17 | `border-danger/(--opacity-border)`, `text-danger`, `bg-danger/(--opacity-faint)` | `AlertCircle` | `assertive` / `role=alert` |
| `warning` | sítios 1,3,5,7 | `border-warning/(--opacity-border)`, `text-warning`, `bg-warning/(--opacity-faint)` | `AlertTriangle` | `polite` / `role=status` |
| `info` | (não usado pelos 17; default p/ futuro) | `border-info/(--opacity-border)`, `text-info`, `bg-info/(--opacity-faint)` | `Info` | `polite` / `role=status` |

> Cor **só via token semântico** (`success`/`warning`/`danger`/`info`) +
> degrau `--opacity-*` do UX-0005. **Nenhuma cor OKLCH inline, nenhuma opacidade
> ad-hoc** (alinhado a [[UX Audit — Sistema#F-4]] / critério "Visual / Token" do
> PRD). Superfície base: `bg-card shadow-[var(--shadow-popover)] rounded-xl
> border`. Padding via `--spacing-rhythm-*` (ex.: `p-rhythm-sm`).

**Hook de API — `useToast()`** (montado pelo provider; o que as 6 telas chamam):

```ts
type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastOptions {
  title?: string;          // default por variante (ex.: "Erro", "Pronto")
  description?: string;    // a mensagem (ex.: a string que ia no window.alert)
  variant?: ToastVariant;  // default "info"
  duration?: number;       // ms; default 5000 (error: 7000); 0 = não auto-fecha
}

interface ToastApi {
  toast: (opts: ToastOptions) => string;        // retorna id
  success: (description: string, opts?: Omit<ToastOptions,"variant"|"description">) => string;
  error:   (description: string, opts?: Omit<ToastOptions,"variant"|"description">) => string;
  warning: (description: string, opts?: Omit<ToastOptions,"variant"|"description">) => string;
  info:    (description: string, opts?: Omit<ToastOptions,"variant"|"description">) => string;
  dismiss: (id?: string) => void;               // sem id = dispensa todos
}
```

> **Conveniência de migração:** `window.alert("X")` →
> `toast.error("X")` / `toast.warning("X")` / `toast.success("X")` — **uma
> linha por uma linha**, mesma string, mesmo ponto do código. Não muda
> control-flow (o `return` que segue o `alert` permanece — toast **não bloqueia**).

**Estado interno:** fila em React state no provider (id incremental, FIFO),
máx. visível recomendado **3** (excedente enfileira); `radix-ui` `Toast` já
gerencia timer, swipe-to-dismiss, pausa no hover/focus e re-anúncio AT.

### 2.2 Primitivo de confirmação — `src/components/shared/confirm-dialog.tsx`

Substitui `window.confirm`. Wrapper sobre `radix-ui` `AlertDialog`
(`import { AlertDialog } from "radix-ui";`) — **`AlertDialog`, não `Dialog`**:
semântica ARIA correta para confirmação (`role="alertdialog"`, foco inicial no
botão de cancelar, `Esc` = cancelar, foco presо/trap). Estilo **idêntico** ao
`ui/dialog.tsx` (mesmo overlay/`bg-card`/`rounded-xl`/`shadow-elevated`/
`data-slot`) — visualmente é o dialog da casa, só com a semântica de alerta.

**Dois modos de consumo** (Front-End escolhe por sítio — ver §2.5):

**(a) Componente declarativo** `<ConfirmDialog>` (controlado por state):

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Cancelar o pedido PD-1234?"
  description="Ele sairá da fila operacional até ser reaberto."
  confirmLabel="Cancelar pedido"
  cancelLabel="Voltar"
  tone="destructive"            // "destructive" | "default"
  onConfirm={() => void cancelOrder(order.id)}   // só roda no clique "confirmar"
/>
```

**(b) Hook imperativo** `useConfirm()` — **preserva a forma síncrona do código
atual com mudança mínima** (recomendado p/ os sítios que hoje são
`if (window.confirm(x)) {…}`):

```ts
const confirm = useConfirm();   // do <ConfirmProvider> (aninhado no layout)
// antes:  if (window.confirm("Cancelar?")) { void cancelOrder(id); }
// depois: if (await confirm({ title: "Cancelar?", tone: "destructive" })) { void cancelOrder(id); }
//         → confirm() resolve Promise<boolean> no clique de um dos botões
```

> **Por que `useConfirm` (Promise) e não só componente:** os 7 `confirm` estão
> embutidos em handlers (`handleCancelOrder`, `onClick` inline). O hook permite
> **trocar 1 linha** preservando o `if (…) { ação }` — vira `if (await
> confirm(…)) { ação }`. Control-flow e regra **idênticos**: a ação só executa no
> caminho "confirmou", igual hoje (semântica de R1 preservada — §2.4).

**Props/tokens:** `tone="destructive"` → botão de confirmar usa
`<Button variant="destructive">`; `tone="default"` → `variant="default"`. Botão
cancelar = `<Button variant="outline">`. **Usa o `Button` da casa** → herda a
trava read-only-tenant **automaticamente** (afordância desabilitada, não
removida — guard-rail respeitado). Título `font-heading`, descrição
`text-muted-foreground text-sm`, footer
`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end` (idêntico a
`DialogFooter`).

### 2.3 Provider — onde montar (`src/app/layout.tsx`)

Edição **mínima e aditiva** em `src/app/layout.tsx`: aninhar os providers
**dentro** do `<body>`, ao redor de `children`, **sem remover o
`TooltipProvider`**:

```diff
-       <TooltipProvider>{children}</TooltipProvider>
+       <TooltipProvider>
+         <ToastProvider>
+           <ConfirmProvider>
+             {children}
+             <ToastViewport />
+           </ConfirmProvider>
+         </ToastProvider>
+       </TooltipProvider>
```

- `ToastProvider`/`ConfirmProvider` são **client components** (`"use client"`);
  `layout.tsx` permanece server component (só importa e compõe — padrão já usado
  com `TooltipProvider`). Não muda metadata, fontes nem `<html>/<body>`.
- `ToastViewport` renderiza **uma vez**, no fim, posicionado `fixed`
  (§3 responsivo). Os primitivos **não** alteram nenhuma rota, layout de página
  ou shell — só adicionam um portal global.
- **Reuso:** um único provider global serve **todas as ~45 telas** (cascata da
  fundação) — qualquer tela futura chama `useToast()`/`useConfirm()` sem montar
  nada localmente.

### 2.4 Padrão `confirm` síncrono → `AlertDialog` assíncrono (preservar semântica)

**Invariante a preservar (regra de negócio intocada):** *a ação destrutiva/de
confirmação executa **se e somente se** o usuário confirmar — exatamente como o
`window.confirm` faz hoje.* O que muda é o **mecanismo de espera** (síncrono
bloqueante → Promise), **não** a condição nem a ação.

Mapeamento canônico (1 linha trocada por sítio):

| Forma atual | Forma alvo (semântica idêntica) |
|---|---|
| `if (window.confirm(M)) { AÇÃO }` | `if (await confirm({…})) { AÇÃO }` (handler vira `async`) |
| `const c = window.confirm(M); if (!c) return; AÇÃO` | `const c = await confirm({…}); if (!c) return; AÇÃO` |
| `if (!window.confirm(M)) return; …` | `if (!(await confirm({…}))) return; …` |

Regras de preservação (o Front-End **deve** seguir):

1. **Nada antes do `confirm` muda** — validações anteriores (ex.: sítio 7
   `if (order.releasedToProduction) { toast.warning(...); return; }` continua
   **antes** e independente do confirm de cancelamento do sítio 8).
2. **A ação dentro do `if` é a mesma chamada, mesmos args**
   (`cancelOrder(order.id)`, `reopenOrder(order.id)`, `fetch(.../clone)`) — **não
   reescrever** a ação.
3. **O handler que contém o `confirm` passa a `async`** (ou usa `.then`); o
   `void` antes de `cancelOrder` etc. é mantido onde já existe. Nenhuma outra
   função na cadeia muda de assinatura.
4. **Cancelar/`Esc`/click-fora/botão-voltar = "não confirmou"** → resolve
   `false` → early-return igual ao `window.confirm` cancelado. **Nenhum efeito
   colateral** no caminho negativo (idêntico a hoje).
5. **Sítio 2 (loja:623)** é um `confirm` de **aviso** (não destrutivo): vira
   `ConfirmDialog tone="default"`, `confirmLabel="Finalizar assim mesmo"`,
   `cancelLabel="Voltar e revisar"`. `if (!proceed) return;` →
   `if (!(await confirm(…))) return;`. A lógica de cálculo de `emptyCategories`
   **não muda** — só o diálogo.

### 2.5 Mapeamento alert/confirm → toast/dialog **por sítio** (contrato p/ Front-End)

Ordem de troca **dentro de UX-0002** (todos os 17 — são a razão do item),
agrupada por arquivo para minimizar diff por commit. **UX-0002 é 1 commit
único** (`git revert` restaura o canal nativo sem colateral, M8).

| # | Sítio | Substituição exata | Observação de preservação |
|:--:|---|---|---|
| 1 | `loja/pedidos:612` | `toast.warning("Selecione ao menos um item disponível com quantidade positiva.")` | `return;` mantido logo após (toast não bloqueia) |
| 2 | `loja/pedidos:623` | `if (!(await confirm({ title:"Filtro ativo", description:`As seguintes categorias não possuem itens no pedido:\n• …\nDeseja finalizar assim mesmo?`, tone:"default", confirmLabel:"Finalizar assim mesmo", cancelLabel:"Voltar e revisar" }))) return;` | `handleOpenOrderConfirmation` vira `async`; cálculo de `emptyCategories` intocado |
| 3 | `loja/pedidos:643` | `toast.warning("Selecione ao menos um item disponível com quantidade positiva.")` | `setIsOrderConfirmationOpen(false)` + `return` mantidos |
| 4 | `loja/pedidos:673` | `toast.error(submitError instanceof Error ? submitError.message : (editingOrderId ? "Falha ao atualizar pedido." : "Falha ao criar pedido. Tente novamente."))` | dentro do `catch`; `setIsOrderConfirmationOpen(false)` mantido; **createOrder/updateOrder intocados** |
| 5 | `loja/pedidos/[orderId]:177` | `toast.warning("O pedido precisa manter pelo menos um item com quantidade positiva.")` | `return;` mantido; `updateOrder` não é chamado (igual hoje) |
| 6 | `loja/pedidos/[orderId]:235` | `const confirmed = await confirm({ title:`Cancelar o pedido ${order.code}?`, tone:"destructive", confirmLabel:"Cancelar pedido", cancelLabel:"Voltar" }); if (!confirmed) return; await cancelOrder(order.id);` | `handleCancelOrder` já é `async`; só troca a fonte de `confirmed` |
| 7 | `gestor-fabrica/pedidos:203` | `toast.warning("Pedidos já liberados para produção precisam ser tratados pelo fluxo operacional, não por cancelamento.")` | `return;` mantido — **bloqueio antes do confirm do sítio 8 preservado** |
| 8 | `gestor-fabrica/pedidos:207` | `const confirmed = await confirm({ title:`Cancelar o pedido ${order.code} da loja ${order.storeName}?`, description:"Ele sairá da fila operacional até ser reaberto.", tone:"destructive", confirmLabel:"Cancelar pedido", cancelLabel:"Voltar" }); if (confirmed) void cancelOrder(order.id);` | `handleCancelOrder` vira `async`; condição e ação idênticas |
| 9 | `gestor-fabrica/pedidos:217` | `const confirmed = await confirm({ title:`Reabrir o pedido ${order.code}?`, description:"Ele volta a poder ser liberado para produção.", tone:"default", confirmLabel:"Reabrir", cancelLabel:"Voltar" }); if (confirmed) void reopenOrder(order.id);` | `handleReopenOrder` vira `async` |
| 10 | `gestor-fabrica/pedidos/[orderId]:203` | `onClick={async () => { if (await confirm({ title:`Reabrir o pedido ${order.code}?`, tone:"default", confirmLabel:"Reabrir", cancelLabel:"Voltar" })) void reopenOrder(order.id); }}` | inline handler vira `async`; ação idêntica |
| 11 | `gestor-fabrica/pedidos/[orderId]:218` | `onClick={async () => { if (await confirm({ title:`Cancelar o pedido ${order.code}?`, description:"Ele sairá do fluxo operacional até ser reaberto.", tone:"destructive", confirmLabel:"Cancelar pedido", cancelLabel:"Voltar" })) void cancelOrder(order.id); }}` | idem; `disabled={!canCancelOrder}` do `Button` **mantido** |
| 12 | `gestor-dados/produtos:162` | `if (!(await confirm({ title:`Clonar o produto "${item.name}"?`, description:"Uma cópia inativa será criada.", tone:"default", confirmLabel:"Clonar", cancelLabel:"Cancelar" }))) return;` | `handleCloneProduct` já `async`; `fetch POST /clone` intocado |
| 13 | `gestor-dados/produtos:171` | `toast.error(payload?.message ?? "Falha ao clonar produto.")` | `return;` mantido (não chama `refresh`) |
| 14 | `gestor-dados/produtos:176` | `toast.success(`Produto clonado com sucesso! Código: ${payload?.code}`)` | após `await refresh(true)` — ordem mantida |
| 15 | `gestor-dados/produtos:178` | `toast.error("Erro inesperado ao clonar produto.")` | dentro do `catch` |
| 16 | `gestor-dados/linhas-producao:582` | `toast.error(err instanceof Error ? err.message : "Falha ao criar categoria")` | `catch` + `finally { setIsCreatingCategory(false) }` mantido |
| 17 | `gestor-dados/linhas-producao:642` | `toast.error(err instanceof Error ? err.message : "Falha ao criar tipo")` | `catch` + `finally { setIsCreatingType(false) }` mantido |

> **Fronteira com a Onda 2 (explícita):** UX-0002 troca **o mecanismo de
> feedback** nos 17 sítios e **nada mais**. **Não** redesenha `loja/pedidos`,
> **não** mexe na grade/tabela, **não** toca o padrão de submit (`page.tsx:1235`)
> — isso é [[Backlog UX (RICE)|UX-0011]]/[[Backlog UX (RICE)|UX-0013]]/
> [[Backlog UX (RICE)|UX-0014]]. As telas-piloto que têm item próprio na Onda 2
> recebem aqui **só** a troca alert/confirm; o polimento visual vem depois e
> **consome** este primitivo.

---

## 3. Cobertura de estados / a11y / responsivo

> Critério de aceite "Estado"/"A11y" do [[UX PRD#6. Critérios de aceite por categoria]]
> e métricas **M1** (100% das ações com feedback de produto) e **M5** (foco
> visível + operação por teclado nos primitivos novos).

### 3.1 Acessibilidade (WCAG 2.1/2.2 AA — guard-rail da iniciativa)

**Toast:**

- **`aria-live`/`role`:** `radix-ui` `Toast` aplica a região-viva
  automaticamente. Variante `error` → `role="alert"` (`aria-live="assertive"`,
  anuncia na hora). `success`/`warning`/`info` → `role="status"`
  (`aria-live="polite"`, não interrompe). Mapeamento na tabela §2.1.
- **Não rouba foco:** toast **não** move o foco do teclado (correto para
  notificação transitória — Radix `Toast` é projetado assim). O foco do usuário
  permanece onde estava (ex.: no botão que disparou a ação).
- **Dispensável por teclado:** `ToastClose` é `<button>` focável; a região é
  alcançável via tecla de hotkey do Radix (`F8` por padrão) e cada toast tem
  `ToastClose` operável por `Enter`/`Espaço`. Auto-fecha por `duration`
  (success/warning/info 5s; **error 7s** — erro precisa de mais tempo de
  leitura; `duration:0` disponível para mensagens críticas, não usado pelos 17).
- **Foco visível:** `ToastClose` herda `focus:ring-ring focus:ring-2
  focus:outline-none` (mesma convenção do `DialogClose`).
- **Pausa:** Radix `Toast` pausa o timer no hover/focus da região (leitura sem
  pressa) — comportamento nativo, sem código extra.
- **`prefers-reduced-motion`:** as animações de entrada/saída
  (`slide`/`fade`/`swipe`) devem ser **anuladas** sob
  `@media (prefers-reduced-motion: reduce)` (transição → `opacity` instantânea
  ou `transition-none`). Especificado como requisito do CSS do primitivo.

**ConfirmDialog (`AlertDialog`):**

- `role="alertdialog"` + `aria-labelledby`(título) + `aria-describedby`
  (descrição) — providos pelo `AlertDialog` do Radix.
- **Foco preso (focus trap)** dentro do diálogo; **foco inicial no botão de
  cancelar** (default seguro do `AlertDialog` — evita confirmar destrutivo por
  engano com `Enter`). Ao fechar, **foco retorna ao gatilho** (Radix faz isso).
- **Teclado:** `Tab`/`Shift+Tab` ciclam confirmar/cancelar; `Esc` = cancelar
  (resolve `false`); `Enter` no botão focado age sobre ele.
- **Foco visível:** botões são o `Button` da casa (já tem
  `focus-visible:ring-ring/45 focus-visible:ring-[3px]`).
- **`prefers-reduced-motion`:** mesma regra do toast — animações de
  overlay/zoom anuladas sob reduce (alinhar com o que `ui/dialog.tsx` fizer
  pós-UX-0009; aqui já especificar `motion-reduce:transition-none`).
- **Read-only-tenant:** o botão de confirmar usa `<Button variant="destructive">`/
  `"default"` → a trava de `button.tsx:58-63` **desabilita** o confirmar
  automaticamente no modo read-only (afordância **desabilitada, não removida** —
  guard-rail). O diálogo abre, mas a ação destrutiva fica indisponível, igual ao
  resto do sistema.

### 3.2 Responsivo / touch (loja é mobile-first — persona de maior risco)

- **`ToastViewport` posição:**
  - **Mobile (`< 640px`):** ancorado no **rodapé**, largura quase total
    (`inset-x-0 bottom-0 p-rhythm-sm`), empilha de baixo p/ cima. Rodapé evita
    cobrir o cabeçalho/ação no balcão; alcançável com o polegar.
  - **`≥ 640px`:** canto **inferior-direito** (`sm:bottom-0 sm:right-0
    sm:max-w-[420px]`), padrão desktop.
  - `z-index` acima do conteúdo, **abaixo/compatível** com o `Dialog`/`Sheet`
    (`z-50` — mesmo patamar do `DialogOverlay`; viewport renderizado por último
    no provider para empilhar corretamente sobre modais quando um toast dispara
    a partir de um dialog, ex.: sítios 16/17 disparam de dentro de um `Dialog`).
- **Hit target ≥ 44×44px** no `ToastClose` e nos botões do `ConfirmDialog` em
  mobile (loja/chão) — usar `size` do `Button` que satisfaça (mín. `h-10`/`h-11`;
  alinhado a **M7** e [[Backlog UX (RICE)|UX-0010]]). O `ToastClose` deve ter
  área tocável ≥44px mesmo com ícone pequeno (padding).
- **Swipe-to-dismiss:** `radix-ui` `Toast` suporta swipe; configurar
  `swipeDirection="right"` (desktop) — em mobile o gesto + o `ToastClose`
  garantem dispensa por toque sem mouse.
- **Texto longo:** mensagens de erro de API podem ser longas (sítio 4/13/16/17)
  — `ToastDescription` com `break-words`, `max-h` + scroll interno se exceder
  (não truncar silenciosamente um erro acionável).
- **Largura do `ConfirmDialog`:** herda `sm:max-w-md`/`lg` do padrão de
  `dialog.tsx` (`max-w-[calc(100%-1rem)]` em mobile) — sem scroll horizontal.

### 3.3 Estados cobertos

| Estado | Tratamento |
|---|---|
| Sucesso | toast `success` (sítio 14) — verde, `CheckCircle2`, 5s, `polite` |
| Erro (API/exception) | toast `error` (4,13,15,16,17) — `danger`, `AlertCircle`, 7s, `assertive` |
| Validação/bloqueio | toast `warning` (1,3,5,7) — `warning`, `AlertTriangle`, 5s, `polite`; **não** dispara a ação (igual hoje) |
| Confirmação destrutiva | `ConfirmDialog tone="destructive"` (6,8,11) — foco inicial em cancelar |
| Confirmação não-destrutiva | `ConfirmDialog tone="default"` (2,9,10,12) |
| Múltiplos toasts | fila FIFO, máx. 3 visíveis, resto enfileira (Radix gerencia) |
| Toast disparado de dentro de `Dialog` aberto | sítios 16/17 — viewport `z-50` renderizado no provider (acima do dialog); toast visível sobre o modal |
| `Esc`/click-fora no ConfirmDialog | = cancelar → `false` → early-return, **sem efeito colateral** |
| Read-only-tenant | botão confirmar desabilitado via trava do `Button` (não removido) |

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas devem ficar ✅):

- [ ] **Os 17 sítios mantêm fluxo/regra idênticos** — cada ação
      (`createOrder`/`updateOrder`/`cancelOrder`/`reopenOrder`/`fetch /clone`/
      criar categoria/criar tipo) é chamada **com os mesmos argumentos, no mesmo
      ponto, sob a mesma condição** de antes (tabela §2.5 conferida sítio a sítio).
- [ ] **Caminho negativo do confirm preservado** — cancelar/`Esc`/click-fora
      resolve `false` e faz o **mesmo early-return** que o `window.confirm`
      cancelado; **nenhum** efeito colateral novo no caminho negativo.
- [ ] **Validações pré-existentes intactas** — early-`return` dos sítios
      1/3/5/7 continua **antes** e independente; sítio 7 (bloqueio "já liberado")
      continua **antes** do confirm de cancelamento do sítio 8.
- [ ] **`toast` não bloqueia control-flow** — todo `return`/`setState` que
      seguia o `window.alert` permanece e executa (toast é fire-and-forget).
- [ ] **Zero mudança de dado/rota/permissão** — nenhum
      `src/lib/factory-planning/**`, `src/lib/supabase-data/**`,
      `permission-modules.ts`, engine, cálculo, rota ou query tocado. Apenas
      `src/components/shared/{toast,confirm-dialog}.tsx` (novos), `layout.tsx`
      (aditivo) e a linha de feedback nos 6 arquivos de tela.
- [ ] **Sem dependência nova** — `package.json` inalterado; `radix-ui@^1.4.3`
      já provê `Toast` e `AlertDialog`.
- [ ] **Read-only-tenant respeitado** — botão de confirmar destrutivo
      desabilitado pela trava do `Button` (afordância **desabilitada, não
      removida**); toast/dialog não contornam a trava.
- [ ] **AJ-0006 não regride** — nenhum texto "mínimo produtivo"/"abaixo do
      mínimo" reintroduzido na loja; o diálogo "Novo Pedido" (React `Dialog`,
      **não** os sítios deste item) inalterado.
- [ ] **AJ-0007 não regride** — o aviso de duplicidade existente continua
      funcionando; UX-0002 não altera a lógica de submit nem o padrão de
      `loja/pedidos:1235`.
- [ ] **Seletores do `e2e/regression.py` intactos** — runner não tem
      `page.on("dialog")` e **não exercita** nenhum dos 17 caminhos (não cria
      pedido, não clona, não cancela — data-dependent = SKIP). Asserts AJ
      (AJ-0001/0002/0003/0005/0006/0012/0013/0016/0017/0020) leem texto de
      tela/Kanban/links — **não** dependem de `alert`/`confirm`. Confirmado: 0
      seletor tocado (§5/§6 R3).
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso.
- [ ] **Commit isolado revertível** — único commit `UX-0002`; `git revert`
      restaura o canal nativo sem colateral (M8).

---

## 5. Plano de verificação para o Front-End

Objetivo: provar que **o feedback mudou e a função não** — zero `window.alert`/
`window.confirm` remanescente nos sítios trocados, regra idêntica, e2e 0-FAIL.

1. **Prova de erradicação (mecânica):**
   `grep -rnE 'window\.(alert|confirm|prompt)\s*\(' src/app src/components`
   → **0 ocorrências** (baseline = 17). Se restar qualquer uma nos 6 arquivos,
   reprova. (Confirmar também ausência de `alert(`/`confirm(` "soltos" sem
   `window.`.)
2. **Escopo do diff:** `git diff --name-only` → **somente**
   `src/components/shared/toast.tsx` (novo), `src/components/shared/confirm-dialog.tsx`
   (novo), `src/app/layout.tsx` (aditivo), e os 6 arquivos de tela. **Nenhum**
   arquivo de `src/lib/**`, rota, engine ou `permission-modules.ts` no diff.
3. **Igualdade de ação (revisão sítio a sítio):** para cada um dos 17, conferir
   contra a tabela §2.5 que a chamada de negócio é a mesma (args, posição,
   condição). Em especial os 7 `confirm`: o `if`/early-return tem a **mesma
   semântica** (ação só no caminho "confirmou").
4. **Lint/build/tsc/test:** `npm run lint` · `npm run build` (`next build`) ·
   `npx tsc --noEmit` · `npm test` — todos verdes, sem novo aviso. Atenção: os 6
   handlers que passaram a `async` não podem introduzir floating promise não
   tratada (lint `no-floating-promises` se ativo) — manter o `void` onde já
   existia.
5. **Smoke manual das 6 personas (feedback real):** logar nas 6 personas;
   exercitar **manualmente** (não pelo runner) ao menos: loja → criar pedido
   (toast sucesso/erro), cancelar pedido (ConfirmDialog destrutivo);
   gestor-fabrica → cancelar/reabrir pedido; gestor-dados → clonar produto
   (confirm + toast), criar categoria/tipo com erro forçado (toast erro).
   Verificar: toast aparece, é dispensável por teclado (`Tab`→`Enter` no X e
   hotkey Radix), não rouba foco; ConfirmDialog prende foco, `Esc` cancela sem
   efeito, foco volta ao gatilho. Desktop **e** mobile (loja). Canário: 1 tela
   não relacionada sem regressão.
6. **Runner E2E de não-regressão (âncora M6):**
   `python e2e/regression.py` (ver [[e2e-playwright-setup]] na memória do
   projeto / [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0 D-0]])
   → **0 FAIL**, PASS ≥ baseline (17-PASS por persona). **Atenção específica
   (R3):** o runner abre o `Dialog` "Novo Pedido" da loja e lê texto para
   AJ-0006/0005/0016 — esse dialog **não** é tocado por UX-0002 (são os 17
   sítios `alert/confirm`, distintos). Confirmar que (a) `get_by_role("button",
   name=/Novo Pedido/)` ainda acha o botão, (b) o texto AJ-0006/0005/0016 do
   diálogo não mudou, (c) Kanban/KPI/links das outras personas inalterados.
   Qualquer queda do PASS = parada e rollback automáticos do item (regra do
   plano de orquestração).

> Critério de aprovação do Gate 1 para este item: passos 1–6 todos verdes **e**
> checklist §4 100% marcado no autorreview.

---

## 6. Riscos & notas de implementação (para o Front-End)

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | **Troca de `confirm` síncrono → `AlertDialog` assíncrono muda o fluxo de `await`.** Os 7 `confirm` são bloqueantes na mesma pilha; o dialog resolve por callback. Mau uso pode fazer a ação rodar **antes** da confirmação ou nos dois caminhos. | Média | **Alto** | Padrão canônico §2.4 + hook `useConfirm(): Promise<boolean>` que **espelha 1:1** a forma `if (window.confirm) {…}`. Handler vira `async`; ação só no ramo `true`. Verificação passo 3 confere sítio a sítio. Caminho negativo (Esc/cancelar) = `false` sem efeito (idêntico ao confirm cancelado). |
| **R2** | Front-End "aproveitar" para polir a tela (escopo UX-0011/0013/0014) | Média | Alto | Fronteira escrita (§2.5 nota + Mandato). Verificação passo 2: diff só nos 2 primitivos + `layout.tsx` + linha de feedback dos 6 arquivos. Nada de grade/tabela/submit. |
| **R3** | **Quebrar asserts do `e2e/regression.py`.** | **Baixa** | Alto | Análise do runner (`e2e/regression.py`): **sem `page.on("dialog")`**, não cria/cancela/clona (data-dependent = SKIP), asserts AJ leem texto/Kanban/links — **não** dependem de `alert`/`confirm`. O `Dialog` "Novo Pedido" testado (AJ-0006/0005/0016) **não** é nenhum dos 17 sítios. Risco real ≈ nulo; ainda assim passo 6 valida explicitamente seletor + texto + 0-FAIL. |
| **R4** | Toast disparado de **dentro de um `Dialog` aberto** (sítios 16/17, e potencialmente 4) ficar **atrás** do overlay do modal | Média | Médio | `ToastViewport` renderizado por último no provider, `z-50` (mesmo patamar do `DialogOverlay`, mas DOM-após → empilha acima). Validar no smoke (passo 5): erro ao criar categoria/tipo mostra toast **sobre** o dialog de criação. Se o portal do Radix Toast não subir, elevar `z-index` do viewport (decisão de implementação, sem mudar semântica). |
| **R5** | Playwright **auto-dismissa** dialog nativo por padrão; alguém poderia supor que o e2e "contava" com isso | Baixa | Baixo | O runner **nunca** chega a um `window.confirm`/`alert` (não exercita os caminhos). Trocar por componente React **remove** a dependência implícita de auto-dismiss em vez de criá-la. Documentado para não gerar falso-alarme no Gate 1. |
| **R6** | `prefers-reduced-motion` esquecido nas animações de toast/dialog (reprova A11y / M5) | Média | Médio | Requisito explícito §3.1: `motion-reduce:transition-none` (ou `@media (prefers-reduced-motion: reduce)`) nas animações de entrada/saída de **ambos** os primitivos. Item de checklist no autorreview. |
| **R7** | Mensagens de erro de API longas (sítios 4/13/16/17) estourarem o toast | Baixa | Baixo | §3.2: `ToastDescription` `break-words` + `max-h` com scroll interno; **não truncar** erro acionável. Manter a string exata que ia no `alert` (sem reescrever copy — fora de escopo). |

**Notas de implementação:**

- **Ordem de toque (plano):** UX-0002 é o **2º item da Onda 1** (após UX-0005,
  já implementado), abrindo o bloco de primitivos de estado
  (UX-0002 → UX-0003 → UX-0004 → UX-0007). Commit isolado `UX-0002`.
- **Reuso-primeiro confirmado:** `radix-ui@^1.4.3` exporta `Toast` **e**
  `AlertDialog` (`node_modules/radix-ui` → `…,AlertDialog,…,Toast,…`).
  **Nenhuma dependência nova** (sem `sonner`, sem `@radix-ui/react-*`
  individual). Espelhar **literalmente** o estilo de `src/components/ui/dialog.tsx`
  (named import `from "radix-ui"`, `data-slot`, overlay `color-mix`/
  `backdrop-blur`, `bg-card`/`rounded-xl`/`shadow-elevated`).
- **Não reescrever copy:** as strings dos `alert`/`confirm` são **preservadas**
  (vão para `description`/`title` do toast/dialog). UX-0002 não é item de
  terminologia (isso é UX-0008) — copy idêntica, só o container muda.
- **Sem `prompt`:** o grep confirmou **0** `window.prompt` — a API do primitivo
  não precisa cobrir entrada de texto (nenhum sítio coleta input via diálogo
  nativo).
- **Provider único e global:** monta-se **uma vez** em `layout.tsx`; cascateia
  para as ~45 telas. Telas futuras só chamam `useToast()`/`useConfirm()` — não
  remontam nada (alavancagem máxima da fundação).
- **Entregar no autorreview/Changelog** a tabela §2.5 (de-para por sítio) — é o
  contrato que UX-0011/0013/0014 vão assumir como já feito (não re-tocam o
  feedback, só polem a tela ao redor).

---

## 7. Autorreview (Front-End)

> Implementado por `frontend-design-senior` (skill `/frontend-design` aplicada).
> Onda 1 — 2º item (após UX-0005). Status: **Concluído (aguardando verificação do
> orquestrador)** — não commitado; build/e2e a cargo do orquestrador (Gate 1).

### 7.1 Resumo do diff

- **2 primitivos novos:** `src/components/shared/toast.tsx`
  (`ToastHost`/`useToast` + `Toast*` — wrapper `radix-ui` `Toast`),
  `src/components/shared/confirm-dialog.tsx` (`ConfirmProvider`/`useConfirm` +
  `ConfirmDialog` — wrapper `radix-ui` `AlertDialog`). Ambos `"use client"`,
  espelham **literalmente** `ui/dialog.tsx` (named import `from "radix-ui"`,
  `data-slot`, overlay `color-mix`/`backdrop-blur`, `bg-card`/`rounded-xl`/
  `shadow-[var(--shadow-elevated|popover)]`, footer `flex-col-reverse … sm:flex-row`).
- **`src/app/layout.tsx`:** aditivo — 2 imports + `<ToastHost><ConfirmProvider>`
  aninhados **dentro** do `<TooltipProvider>` existente; nada removido/alterado;
  permanece server component. Viewport renderizado **uma vez** no fim do `ToastHost`.
- **6 telas / 17 sítios:** só a linha de feedback trocada (de-para §7.4). Imports
  `useToast`/`useConfirm` + 1–2 hooks no topo do componente. Nenhuma chamada de
  negócio (`createOrder`/`updateOrder`/`cancelOrder`/`reopenOrder`/`fetch /clone`/
  criar categoria/tipo) tocada — args/posição/condição idênticos.
- `git diff --name-only` → exatamente: os 6 arquivos de tela + `layout.tsx`
  (2 novos primitivos = untracked). **Nenhum** `src/lib/**`, rota, engine,
  `permission-modules.ts`. (`Docs/.obsidian/workspace.json` = ruído pré-existente
  do editor Obsidian, **não** tocado/staged.)
- **Zero dependência nova:** `package.json` inalterado; `radix-ui@^1.4.3` já
  exporta `Toast` **e** `AlertDialog` (confirmado em runtime).

### 7.2 Decisões de risco

- **R1 (confirm síncrono → assíncrono):** aplicado o padrão canônico §2.4 via
  `useConfirm(): Promise<boolean>`. Cada um dos 7 `confirm` virou
  `if (await confirm({…})) { AÇÃO }` / `if (!(await confirm({…}))) return;` com a
  **mesma condição e a mesma ação**. Handlers que eram `function` síncrona
  (`handleCancelOrder`/`handleReopenOrder` de `gestor-fabrica/pedidos`,
  `handleOpenOrderConfirmation` de `loja/pedidos`) e os 2 `onClick` inline de
  `gestor-fabrica/pedidos/[orderId]` passaram a `async`; os já-`async`
  (`handleCancelOrder` loja, `handleCloneProduct`) só trocaram a fonte do boolean.
  `void` antes de `cancelOrder`/`reopenOrder` **mantido**. Caminho negativo
  (Esc/click-fora/Cancelar) → `false` → early-return idêntico, sem efeito colateral.
- **R2 (escopo):** nenhuma tela redesenhada; grade/tabela/submit
  (`loja/pedidos/page.tsx:1235`) intocados. Só o mecanismo de feedback mudou.
- **R3/R5 (e2e):** `e2e/regression.py` não tem `page.on("dialog")`/
  `expect_event("dialog")`/`accept_dialog`; o único contato é clicar o React
  `<Dialog>` "Novo Pedido" e ler texto p/ AJ-0006 — esse `<Dialog>` **não** é
  nenhum dos 17 sítios. AJ-0007 sequer é referenciado pelo runner. 0 seletor/texto
  asseridо tocado → risco de regressão **nulo** (confirmado).
- **R4 (toast sobre `Dialog`):** `ToastViewport` `z-50` (patamar do
  `DialogOverlay`) e renderizado **por último** no `ToastHost` → empilha sobre
  modais (sítios 16/17 disparam de dentro de um `Dialog`). Validável no smoke.
- **R6 (`prefers-reduced-motion`):** `motion-reduce:animate-none` /
  `motion-reduce:transition-none` nas partes animadas de **ambos** os primitivos
  **+** a regra global `@media (prefers-reduced-motion: reduce)` já existente em
  `globals.css:255` (`*` `!important`) cobre o resto. Dupla garantia.
- **R7 (erro longo):** `ToastDescription` com `break-words` +
  `max-h-40 overflow-y-auto` (nunca trunca). String do `alert` preservada literal.

### 7.3 Checklist §4 "funcionalidade preservada" — preenchido

- [x] **Os 17 sítios mantêm fluxo/regra idênticos** — conferido sítio a sítio
      contra a tabela §2.5 (§7.4): mesma chamada, mesmos args, mesma posição/condição.
- [x] **Caminho negativo do confirm preservado** — Cancelar/Esc/click-fora →
      `useConfirm` resolve `false` → mesmo early-return; nenhum efeito colateral novo.
- [x] **Validações pré-existentes intactas** — early-`return` dos sítios 1/3/5/7
      mantido antes/independente; sítio 7 (bloqueio "já liberado") permanece
      **antes** do confirm do sítio 8 em `handleCancelOrder`.
- [x] **`toast` não bloqueia control-flow** — todo `return`/`setState` que seguia
      o `window.alert` (ex.: `setIsOrderConfirmationOpen(false)`, `finally`) mantido.
- [x] **Zero mudança de dado/rota/permissão** — só `shared/{toast,confirm-dialog}.tsx`
      (novos), `layout.tsx` (aditivo) e a linha de feedback nas 6 telas.
- [x] **Sem dependência nova** — `package.json` inalterado; `radix-ui` provê ambos.
- [x] **Read-only-tenant respeitado** — botão confirmar do `ConfirmDialog` é o
      `Button` da casa (`variant="destructive"|"default"`) → herda a trava
      automática (afordância **desabilitada**, não removida).
- [x] **AJ-0006 não regride** — nenhum texto "mínimo produtivo" reintroduzido;
      o `<Dialog>` "Novo Pedido" não é tocado (são os 17 sítios `alert/confirm`).
- [x] **AJ-0007 não regride** — lógica de submit / `loja/pedidos:1235` intocada;
      runner sequer referencia AJ-0007.
- [x] **Seletores do `e2e/regression.py` intactos** — sem `page.on("dialog")`;
      0 caminho dos 17 exercitado; asserts AJ leem texto/Kanban/links. 0 tocado.
- [x] **Lint/tsc/test verdes** — ver §7.5 (build/e2e = Gate 1, orquestrador).
- [x] **Commit isolado revertível** — 1 commit `UX-0002` (a cargo do orquestrador);
      `git revert` restaura o canal nativo sem colateral.

### 7.4 Tabela de-para final §2.5 — confirmada (contrato p/ UX-0011/0013/0014)

| # | Sítio (arquivo:linha orig.) | De | Para | Handler |
|:--:|---|---|---|---|
| 1 | `loja/pedidos:612` | `window.alert` | `toast.warning(…)` | `handleOpenOrderConfirmation` → `async` |
| 2 | `loja/pedidos:623` | `window.confirm` | `await confirm({tone:"default"})` | idem (mesmo handler) |
| 3 | `loja/pedidos:643` | `window.alert` | `toast.warning(…)` | `handleConfirmOrderSubmission` (já `async`) |
| 4 | `loja/pedidos:673` | `window.alert` | `toast.error(…)` | idem (catch) |
| 5 | `loja/pedidos/[orderId]:177` | `window.alert` | `toast.warning(…)` | handler já `async` (`await updateOrder`) |
| 6 | `loja/pedidos/[orderId]:235` | `window.confirm` | `await confirm({tone:"destructive"})` | `handleCancelOrder` (já `async`) |
| 7 | `gestor-fabrica/pedidos:203` | `window.alert` | `toast.warning(…)` | `handleCancelOrder` → `async` (bloqueio antes do confirm) |
| 8 | `gestor-fabrica/pedidos:207` | `window.confirm` | `await confirm({tone:"destructive"})` | idem |
| 9 | `gestor-fabrica/pedidos:217` | `window.confirm` | `await confirm({tone:"default"})` | `handleReopenOrder` → `async` |
| 10 | `gestor-fabrica/pedidos/[orderId]:203` | `window.confirm` | `await confirm({tone:"default"})` | `onClick` inline → `async` |
| 11 | `gestor-fabrica/pedidos/[orderId]:218` | `window.confirm` | `await confirm({tone:"destructive"})` | `onClick` inline → `async`; `disabled={!canCancelOrder}` mantido |
| 12 | `gestor-dados/produtos:162` | `window.confirm` | `!(await confirm({tone:"default"}))` | `handleCloneProduct` (já `async`) |
| 13 | `gestor-dados/produtos:171` | `window.alert` | `toast.error(…)` | idem (`!response.ok`) |
| 14 | `gestor-dados/produtos:176` | `window.alert` | `toast.success(…)` | idem (após `await refresh(true)`) |
| 15 | `gestor-dados/produtos:178` | `window.alert` | `toast.error(…)` | idem (catch) |
| 16 | `gestor-dados/linhas-producao:582` | `window.alert` | `toast.error(…)` | catch do submit (já `async`); `finally` mantido |
| 17 | `gestor-dados/linhas-producao:642` | `window.alert` | `toast.error(…)` | idem |

> 17/17 trocados. Strings de copy **preservadas literalmente** (vão p/
> `title`/`description`). Mapeamento de variante = classificação semântica §2.1.

### 7.5 Resultado de verificação (passos §5)

- **Passo 1 (erradicação):** `grep -rnE "window\.(alert|confirm|prompt)\("
  src/app src/components` → **0** nos 17 sítios. As 2 únicas ocorrências restantes
  são **comentários** (docstring de migração em `confirm-dialog.tsx:106-107`),
  não código. Sem `alert(`/`confirm(`/`prompt(` "soltos".
- **Passo 2 (escopo do diff):** só os 6 arquivos de tela + `layout.tsx` (+ 2
  primitivos novos untracked). Nenhum `src/lib/**`/rota/engine/`permission-modules`.
- **Passo 3 (igualdade de ação):** revisado sítio a sítio (§7.4); os 7 `confirm`
  preservam `if (…) { ação }` com semântica idêntica (ação só no ramo `true`).
- **Passo 4 (lint/tsc/test):** `npx tsc --noEmit` → **exit 0**. `npm run lint` →
  **exit 0, 0 errors** (6 warnings **pré-existentes**, em arquivos fora do escopo
  UX-0002; **0 novo** warning introduzido). `npm test` → **110 pass, 0 fail**.
  `npm run build`/e2e **não** rodados (Gate 1, orquestrador — dev server :3000 vivo).
- **Passos 5–6 (smoke 6 personas + `e2e/regression.py`):** a cargo do
  orquestrador no Gate 1. Análise estática confirma risco de regressão nos
  asserts AJ-0006/0007 = **nulo** (runner sem `page.on("dialog")`; nenhum dos 17
  caminhos exercitado; `<Dialog>` "Novo Pedido" ≠ os 17 sítios).

### 7.6 Desvio mínimo da spec (justificado)

- **§2.3 — composição do provider:** a spec esboça
  `<ToastProvider>{children}<ToastViewport/></ToastProvider>` + `<ConfirmProvider>`.
  Implementado como **`<ToastHost>`** (client component único que encapsula
  `ToastProvider` + a fila em React state + `ToastViewport` renderizado por
  último internamente) aninhando `<ConfirmProvider>`. **Por quê:** a fila FIFO
  (§2.1 "estado interno: fila em React state no provider") exige um host com
  state — expor `ToastProvider` cru no `layout.tsx` (server component) não
  permitiria isso sem um wrapper client. `ToastHost` **é** esse wrapper e cumpre
  literalmente o intento da §2.3 (aninhado no `TooltipProvider`, viewport único
  no fim, provider global único, `layout.tsx` permanece server). API pública
  (`useToast`/`useConfirm`) e semântica = exatamente a spec. Sem impacto funcional.
