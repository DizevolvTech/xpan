# UX-0004 — Convenção "botão enviando" (prop `isLoading` no `button.tsx`)

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner`). Companheira de [[Backlog UX (RICE)]] (item l.34 e l.82-87),
> [[UX PRD]] (critérios "Estado", §6; métrica **M6**; resolução Gate 0 §10),
> [[UX Audit — Sistema]] (achado [[UX Audit — Sistema#F-5 — Sem convenção de "botão enviando"; empty state genérico · 🟡 · Estado|F-5]]).
> Convenção: [[12 - Iniciativa UX/README|README]]. Consome
> [[UX-0005 — escala-espacamento-opacidade|UX-0005]] (tokens `--opacity-*` /
> `--spacing-rhythm-*`, commitado). Espelha a gramática dos primitivos
> [[UX-0002 — sistema-toast-feedback|UX-0002]] (`shared/toast.tsx`,
> `shared/confirm-dialog.tsx`) e [[UX-0003 — skeleton-loading|UX-0003]]
> (`shared/skeleton.tsx`), todos commitados. Mitiga
> [[Dívida Técnica#D03]] (duplo-clique → duplicidade) **na origem da UI**.
> Cross-link de fronteira: [[Backlog de Ajustes#AJ-0007]] (aviso de duplicidade —
> já resolvido; UX-0004 é **complementar**, previne o duplo-disparo na raiz).

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, navegação nem
  `permission-modules`**. A prop `isLoading` controla **só apresentação**
  (spinner + texto + `disabled` visual) e **previne o re-submit** enquanto a
  ação está em voo — **não muda o que a ação faz**, nem quando/se ela dispara.
- **Retrocompatível por construção (requisito-âncora).** Sem `isLoading` (ou
  `isLoading={false}`), o `<Button>` renderiza **byte-a-byte idêntico** ao de
  hoje: mesmas classes `cva`, mesma lógica read-only/`allowInReadOnly`, mesmo
  `disabled`, mesmo `asChild`, mesmos `data-*`. **Nenhum** dos ~29 arquivos que
  usam `<Button>` muda de comportamento sem optar pela prop. É o requisito #1
  do checklist §4 e do plano de verificação §5.
- **Reuso-primeiro.** Antes de propor um spinner, varri o projeto (§1.4):
  **2** ocorrências de `animate-spin` (`login-form.tsx:131` via `Loader2` do
  `lucide-react`; `loja/pedidos/page.tsx:773` um spinner de borda CSS). Não há
  primitivo de spinner compartilhado. `lucide-react` **já é dependência**
  (usada em `toast.tsx`, `login-form.tsx`, dezenas de telas) e
  `animate-spin`/`motion-reduce` são utilitários **nativos** do Tailwind 4 — o
  spinner é **`Loader2` + `animate-spin` inline no `button.tsx`**, **zero
  dependência nova**, espelhando o idioma já provado em `login-form.tsx:129-133`.
- **Só `button.tsx` + (opcional) o sítio de referência.** O escopo é (a) a
  **convenção** no primitivo `src/components/ui/button.tsx` e (b) **opcional**,
  generalizar o bom padrão de referência **onde já existe submit manual
  trivialmente seguro** (a decisão "adota vs adia" está explícita em §2.6). A
  **adoção ampla em todos os forms** é [[Backlog UX (RICE)|UX-0009]] / Onda 2
  (`UX-0011`/`0013`/`0016`). Fronteira escrita em §2.6.
- **Implementação é etapa separada.** Este documento é a **especificação**.
  Quem implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa
  posterior, **após aprovação explícita do usuário**. Esta spec **não toca
  `src/`**.
- **Não regredir o `e2e/regression.py`.** O runner clica botões reais
  (`button[type=submit]` no login, "Novo Pedido", "Visualizar"/links de KPI —
  §1.5). A convenção **não pode** alterar nenhum desses fluxos: **sem
  `isLoading` nada muda** (retrocompat); e mesmo se um dos botões clicados pelo
  e2e adotar `isLoading` (não é o caso neste escopo — §1.5/§2.6), o estado
  assertado é **pós-resolução** e o texto/`name` acessível é preservado. Detalhe
  em §4 / §5.
- **Não duplicar a lógica do toast (UX-0002).** UX-0004 é **estado visual do
  botão** apenas. Comunicar sucesso/erro continua sendo do `toast` (UX-0002) —
  esta spec **não** dispara toast, não engole erro, não decide o resultado da
  ação. Fronteira em §2.6.

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1
auditoria do sistema de design existente → Fase 2 diagnóstico → Fase 3 plano
**contra** o sistema existente; **modo spec-only** — nenhuma edição de código).
Achados consolidados (categoria **Estado**, achado **F-5**):

1. **Botão de submit sem estado de envio** (checklist da skill, *States →
   "Pending / submitting — disable the trigger and show progress; never allow a
   double-submit"*; *"prevent error: a destructive or write action must not be
   re-triggerable while in flight"*): `button.tsx:45-76` **não tem** `isLoading`,
   nem spinner, nem texto de progresso, nem `aria-busy`. Cada autor reimplementa
   à mão — e **a maioria não desabilita o botão durante a escrita**, só **depois**
   (via `disabled={isSubmitting}` espalhado, frágil e inconsistente).
2. **Duplo-clique → ação duplicada** (skill, *"affordance must reflect system
   state; a button that looks clickable during an in-flight write invites a
   second submit"*): sem desabilitar **no início** da ação, o usuário da loja
   (touch, balcão, às pressas) clica de novo → **pedido duplicado**. É a
   materialização-UI de [[Dívida Técnica#D03]] e a dor textual do
   [[UX PRD#1. Problema / Oportunidade|PRD §1]] (*"cliquei, não apareceu nada,
   cliquei de novo — agora tem pedido duplicado"*).
3. **Sem vocabulário de "enviando" canônico** (skill, Fase 3 — *"does the
   project already have a primitive for this? if the same ad-hoc pattern repeats
   3+ times, it wants to be a prop"*): o padrão `{isSubmitting ? "Salvando..." :
   "…"}` se repete **≥10 vezes** com textos divergentes (`"Salvando..."`,
   `"Provisionando..."`, `"Entrando..."`, `"Salvar regras"` vs `"Salvar
   pedido"`) e **sem spinner** na maioria — ruído de consistência (Nielsen #4) e
   de feedback de estado (Nielsen #1). Sem um ponto canônico no `button.tsx`,
   `UX-0011`/`0013`/`0016` não têm alvo para padronizar.

UX-0004 ataca **(1)–(3)** adicionando **uma prop opcional** ao primitivo de
maior alavancagem (todo botão da casa passa pelo `button.tsx`) — puramente
**aditiva**, retrocompatível, reversível trivial — e **declara** a adoção ampla
como fronteira adiada (§2.6).

### 1.2 O que o `button.tsx` faz hoje (lido linha-a-linha — l.1-79)

Arquivo: `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/ui/button.tsx`
(79 linhas). É um shadcn-style `Button` + `cva`, **com lógica de tenant
read-only embutida** — ponto sensível desta spec.

**(a) `cva` `buttonVariants` (l.10-43):**
- Base (l.11): `inline-flex items-center justify-center gap-2 …
  disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none
  [&_svg:not([class*='size-'])]:size-4 … focus-visible:ring-ring/45
  focus-visible:ring-[3px] …`. Pontos relevantes para UX-0004:
  - **`gap-2`** entre filhos → spinner + texto já espaçam sem ajuste.
  - **`disabled:opacity-45`** + `disabled:pointer-events-none` → o estado
    desabilitado **já tem** afordância visual e **já bloqueia** clique. UX-0004
    **reutiliza** isso (não cria opacidade nova).
  - **`[&_svg:not([class*='size-'])]:size-4`** → um `<svg>` filho sem classe
    `size-*` é normalizado para `size-4` automaticamente; o `<Loader2>` do
    spinner herda o tamanho correto **sem** classe extra (mas a spec fixa
    `size-4`/`size-3` explícito por robustez — §2.2).
  - **`focus-visible:*`** → foco visível já é AA; UX-0004 **não pode** remover
    nem alterar (a11y §3.1).
- `variant` (l.14-26): `default`, `destructive`, `outline`, `secondary`,
  `ghost`, `link` (este último `h-auto border-none p-0`).
- `size` (l.27-36): `default h-10`, `xs h-7`, `sm h-8`, `lg h-11`, `icon
  size-10`, `icon-xs/-sm/-lg`. **Implicação:** nas variantes `icon*` **não há
  espaço para texto** — `loadingText` é ignorado nelas (só spinner) — §2.3.

**(b) Função `Button` (l.45-76) — props e read-only:**
```tsx
function Button({ className, variant = "default", size = "default",
  asChild = false, allowInReadOnly = false, ...props }
  : React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> &
    { asChild?: boolean; allowInReadOnly?: boolean; }) {
  const Comp = asChild ? Slot.Root : "button";
  const isReadOnlyTenantView =
    readClientAccessContext().accessMode === "read-only-tenant";
  const blocksInReadOnly = !allowInReadOnly && !asChild &&
    (variant === "default" || variant === "destructive"
     || props.type === "submit");
  const disabled = props.disabled || (isReadOnlyTenantView && blocksInReadOnly);
  return (
    <Comp data-slot="button" data-variant={variant} data-size={size}
      data-read-only-disabled={
        disabled && isReadOnlyTenantView ? "true" : "false"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} disabled={disabled} />
  );
}
```

Leitura crítica para a spec:

- **`disabled` é computado** (l.63): `props.disabled || (read-only-tenant ∧
  blocksInReadOnly)`. **UX-0004 NÃO pode redefinir esta variável** — só pode
  **somar** `isLoading` ao OR final. A precedência read-only **tem de ser
  preservada** integralmente.
- **`blocksInReadOnly` (l.59-62)** já desabilita `default`/`destructive`/
  `type=submit` em tenant read-only (afordância **desabilitada, não removida** —
  guard-rail da iniciativa, já respeitado). UX-0004 **não toca** essa expressão.
- **`asChild` (l.57)**: quando `true`, `Comp = Slot.Root` — o `<Button>` **não
  renderiza um `<button>` próprio**, mescla props no **filho** (geralmente um
  `<a>`/`<Link>`). **`Slot` aceita 1 único filho.** Injetar `<Loader2/> +
  texto` como irmãos quebraria o `Slot` (React.Children.only). → **Regra dura
  da spec:** com `asChild`, `isLoading` **não** injeta spinner/texto (degrada
  para no-op visual + `aria-busy` no slot, sem alterar children) — §2.3/§2.4.
  Além disso `blocksInReadOnly` já exige `!asChild`, então `asChild` é
  consistentemente "passagem para um link" — `isLoading` num link é raro e
  semanticamente fraco; a spec o trata explicitamente, não o ignora.
- **`data-read-only-disabled`** (l.70): atributo de teste/QA. UX-0004 **adiciona**
  um `data-loading` análogo (não substitui, não colide) — §2.2.
- **Spread order (l.72-73):** `{...props}` **antes** de `disabled={disabled}` →
  o `disabled` computado **vence** um `props.disabled` cru. UX-0004 mantém esse
  invariante: o `disabled` final = `props.disabled || readOnly… || isLoading`,
  aplicado **depois** do spread (a mesma posição de hoje).

### 1.3 O bom padrão de referência a generalizar — `loja/pedidos/page.tsx:1238-1244`

(O backlog cita "l.1235"; a leitura real situa o `<Button>` de submit em
**l.1238-1244** — o estado da arte atual da casa, a **referência a
generalizar**.) Lido:

```tsx
<Button
  type="button"
  onClick={() => void handleConfirmOrderSubmission()}
  disabled={isSubmitting || !selectedStore || selectedOrderItems.length === 0}
>
  {isSubmitting ? "Salvando..." : editingOrderId ? "Salvar alterações" : "Confirmar pedido"}
</Button>
```

`isSubmitting` deriva de `isCreating || isUpdating` dos hooks
`useCreateStoreOrder`/`useUpdateStoreOrder` (l.195-207). **O que esse padrão
faz certo** (e a convenção generaliza): (a) **desabilita** o botão durante a
ação (`disabled={isSubmitting || …}`) → previne duplo-disparo; (b) **troca o
texto** para um rótulo de progresso. **O que falta** (e a convenção adiciona):
(c) **spinner** (afordância visual de "em curso", não só texto — Nielsen #1);
(d) **`aria-busy`** (paridade para leitor de tela). O padrão também combina o
gating de domínio (`!selectedStore || …`) com `isSubmitting` no **mesmo**
`disabled` — a convenção **preserva** isso: `isLoading` é **somado** ao
`disabled` do autor, nunca o substitui (§2.3).

> **Decisão de fronteira (resumo; detalhe §2.6):** UX-0004 **adota** apenas a
> **convenção no `button.tsx`**. Reescrever este sítio (`loja/pedidos`) para
> consumir `isLoading` é **`UX-0011`/Onda 2** (a auditoria diz explicitamente
> "**preservar** o bom padrão de submit (l.1235), generalizar isso vira
> `UX-0004`, **não regredir aqui**"). UX-0004 **não toca `loja/pedidos`** —
> generalizar ≠ migrar. (Ver §2.6 para a única exceção opcional considerada e
> por que ela é **adiada**.)

### 1.4 Spinner — varredura de reuso (Fase 1 da skill)

`grep -rn "animate-spin" src --include="*.tsx"` → **2 ocorrências, nenhuma
compartilhada**:

| Arquivo:linha | Spinner | Observação |
|---|---|---|
| `src/app/login/login-form.tsx:131` | `<Loader2 className="size-4 animate-spin" />` (`lucide-react`) **+ "Entrando..."**, dentro de `<Button type="submit" disabled={submitting}>` (l.128-140) | **Idioma da casa** a generalizar: ícone `Loader2` + `animate-spin` + texto, no `Button`. **e2e clica este botão** (login) — §1.5. |
| `src/app/loja/pedidos/page.tsx:773` | `<div className="… animate-spin rounded-full border-4 border-border border-t-foreground" />` | Spinner de **loading de página** (não de botão) — fora do escopo (é estado de tela; UX-0003/0011). |

**Conclusão de reuso:** **não criar primitivo de spinner novo nem dependência.**
O spinner do botão = **`<Loader2 className="size-4 animate-spin" aria-hidden />`**
(ícone do `lucide-react`, **já dependência**; `animate-spin` Tailwind nativo),
**replicando exatamente** o idioma provado de `login-form.tsx:131`. Para
`size="sm"/"xs"` (botões h-8/h-7) o ícone usa `size-3` (a base `cva` já força
`size-3` em `icon-xs` — coerência). `motion-reduce:animate-none` explícito **e**
o `@media (prefers-reduced-motion: reduce)` global (`globals.css:255-263`, zera
`animation-duration` para `*`) → **dupla** garantia (espelha o padrão de
`toast.tsx`/`skeleton.tsx`).

### 1.5 O que o `e2e/regression.py` clica/asserta (rede M6)

Lido integralmente (260 linhas). Botões que o runner **clica**:

| Onde | Seletor (regression.py) | Botão real | Adota `isLoading` em UX-0004? |
|---|---|---|---|
| Login (6×, todas as personas) | `page.locator("button[type=submit]")` → `.click()` (l.52-63) | `login-form.tsx:128` `<Button type="submit" disabled={submitting}>` (já tem spinner `Loader2` + "Entrando..." próprio, **manual**) | **NÃO** (fronteira §2.6 — adiado p/ não tocar o fluxo de login na fundação; o botão **já** tem o comportamento, manual). Retrocompat garante: intacto. |
| Loja | `get_by_role("button", name=/Novo Pedido/i).click()` (l.136) | botão que **abre o diálogo** de novo pedido (não é submit de escrita) | **NÃO** (abre modal, não escreve; sem `isLoading`). |
| Gestor-fábrica | `get_by_text("Acompanhamento")`, `a[href*="/gestor-fabrica/…"]` (l.165-181) | **links** de KPI (`<a>`/`asChild`), não botões de submit | **NÃO** (são `asChild`/links; `isLoading` é no-op em `asChild` por regra §2.3). |

**Asserts** são todos **pós-`goto` + `networkidle` + `wait_for_timeout(2500)`**
(l.85-91) → **estado de carga já resolveu** quando o assert roda. `screen_ok`
reprova se `body()` contém a substring **`"error"`** (l.98) → **nenhum rótulo
de loading do botão pode conter `error`** (os defaults — `"Enviando…"` /
`loadingText` do autor — não contêm; a spec **proíbe** `error` no
texto/aria-label do estado loading — §4).

> **Conclusão de risco e2e:** seletor/fluxo afetado = **nenhum**. (a)
> Retrocompat: nenhum botão clicado pelo e2e adota `isLoading` neste escopo
> (§2.6) → comportamento byte-idêntico. (b) Mesmo em adoção futura: o `name`
> acessível do botão é preservado (o texto base **permanece** no DOM quando não
> loading; o e2e nunca clica **durante** uma escrita em voo — clica e espera o
> `networkidle`). (c) Login: o botão `type=submit` **já** desabilita+spinner
> manualmente; UX-0004 **não o toca** (§2.6) → o loop de re-tentativa do
> `login()` (l.61-74, que re-clica se ainda em `/login`) **não muda**. Detalhe
> em §4/§5.

### 1.6 Diagnóstico priorizado (impacto × risco — motor `/ux-ui-refiner`)

| # | Problema | Categoria | Severidade | Onde | Decisão UX-0004 |
|:--:|---|---|:--:|---|---|
| 1 | Submit não desabilita no início da ação → duplo-clique → ação duplicada | Estado | 🟡 (🔴 na loja) | `button.tsx` (ausência) + ~10 sítios de submit manual | **Resolve a convenção** — `isLoading` ⇒ `disabled` imediato |
| 2 | Sem spinner/`aria-busy` — feedback de "em curso" só textual, inconsistente | Estado/A11y | 🟡 | idem | **Resolve** — spinner + `aria-busy` canônicos |
| 3 | Texto de progresso ad-hoc e divergente ("Salvando…"/"Provisionando…"/sem nada) | Estado | 🟢 | ~10 sítios | **Resolve a convenção** (`loadingText` opcional, default neutro); adoção tela-a-tela **adiada** |
| 4 | ~10 sítios de submit manual reescreverem para `isLoading` | Estado | 🟡 | `src/app/**` (forms) | **Adia** (UX-0009 / Onda 2: `UX-0011`/`0013`/`0016` — §2.6) |
| 5 | `asChild` + spinner quebraria `Slot` (1 filho) | Estrutura | 🟡 | `button.tsx` | **Previne** — regra dura: `asChild` ⇒ `isLoading` não injeta children (§2.3) |
| 6 | Colisão de `isLoading` com `disabled`/read-only | Estrutura | 🔴 | `button.tsx:59-63` | **Previne** — `isLoading` é **somado** ao OR final, read-only intocado (§2.3) |

UX-0004 fecha **1, 2, 3 (a convenção), 5, 6** e **declara 4** como fronteira
adiada (não é esquecimento — é "1 `UX-####` por commit").

---

## 2. Spec de refinamento

> Implementação 100% em **1 arquivo**:
> `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/components/ui/button.tsx`
> (mais, **opcionalmente e só se aprovado**, o sítio de referência — ver §2.6,
> recomendação = **adiar**, escopo = só o primitivo). Diffs abaixo são
> **conceituais — NÃO aplicar nesta etapa**.

### 2.1 API pública proposta (exata)

Duas props **opcionais** somadas ao tipo atual (que é
`React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> &
{ asChild?: boolean; allowInReadOnly?: boolean }`):

```ts
type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    allowInReadOnly?: boolean;
    /** UX-0004: quando true, o botão entra em estado "enviando":
     *  - desabilita (somado ao disabled atual — read-only/disabled intactos)
     *  - prefixa um <Loader2 animate-spin aria-hidden> antes do conteúdo
     *  - troca o texto por `loadingText` quando informado
     *  - expõe aria-busy e data-loading
     *  Ausente/false ⇒ comportamento byte-idêntico ao atual. Default: false. */
    isLoading?: boolean;
    /** UX-0004: rótulo de progresso opcional. Quando ausente e isLoading,
     *  mantém o children original (só prefixa o spinner — não inventa texto).
     *  Ignorado em size="icon*" (sem espaço p/ texto) e em asChild (Slot 1-filho). */
    loadingText?: React.ReactNode;
  };
```

**Decisões de API (e o porquê):**

- **`isLoading` (não `loading`/`pending`/`busy`):** alinha com o nome **já
  usado no projeto** — `data-table.tsx` tem prop `isLoading`,
  `loja/pedidos/page.tsx:1263` `isLoading={isLoadingOrders}`, `KPICard`
  (UX-0003) ganhou `isLoading?`. Consistência de vocabulário da casa
  (Nielsen #4) > preferência pessoal.
- **`loadingText` opcional, default = manter children:** o backlog pede
  "texto de progresso". A spec **não** força um texto global (a casa diverge:
  "Salvando…"/"Provisionando…"/"Entrando…" são contextuais e corretos). Sem
  `loadingText`, o botão **mantém o próprio rótulo** e só ganha spinner +
  `disabled` + `aria-busy` — **mudança mínima**, retrocompat máxima, deixa o
  texto contextual a cargo do autor (como hoje, mas agora opcional e
  centralizado). **Não** se cria um default textual visível tipo "Enviando…"
  (seria mudança de conteúdo perceptível em adoções futuras e poderia colidir
  com o `name` acessível usado por testes) — o default é **"mantém o que já
  está"**.
- **Sem `spinnerPosition`/`spinnerOnly`/cor de spinner:** YAGNI + reuso. O
  spinner vai **antes** do conteúdo (idioma de `login-form.tsx:131`,
  `gap-2` da base já espaça); cor = `currentColor` (herda
  `text-primary-foreground`/etc. da variante — **zero token novo, zero
  ad-hoc**). Em `icon*` é spinner-only por ausência de texto, não por prop.
- **Tipo:** `isLoading?: boolean` e `loadingText?: React.ReactNode` somados ao
  intersection type existente (não a `cva` — não é variante; é estado runtime,
  como `asChild`/`allowInReadOnly` já são).

### 2.2 Comportamento — interação com `disabled`, read-only, `asChild`

> Esta é a seção de maior risco (achados #5, #6). Regras **duras**.

**(R-1) `disabled` é SOMADO, nunca redefinido.** A linha l.63 atual
`const disabled = props.disabled || (isReadOnlyTenantView && blocksInReadOnly);`
vira:
```ts
const disabled =
  props.disabled || (isReadOnlyTenantView && blocksInReadOnly) || isLoading;
```
→ a precedência read-only/`props.disabled` é **100% preservada**;
`isLoading` só **adiciona** uma razão de desabilitar. Como o `disabled` final
continua aplicado **depois** do `{...props}` (l.72-73, invariante mantido), e
`disabled:pointer-events-none` já está na base `cva` (l.11), o **duplo-clique
fica impossível** assim que `isLoading` vira `true` — **a mitigação de
[[Dívida Técnica#D03]] é exatamente isto**.

**(R-2) read-only vence, e isso é desejável.** Se o tenant é read-only e o
botão já está `disabled` por `blocksInReadOnly`, `|| isLoading` não muda nada
(já estava `true`). `data-read-only-disabled` (l.70) **mantém sua lógica
atual** (`disabled && isReadOnlyTenantView`). Não há conflito: read-only e
loading são razões **independentes e compatíveis** de `disabled`. A spec
**não** altera `blocksInReadOnly` nem `allowInReadOnly`.

**(R-3) `asChild` ⇒ não injeta children (regra dura).** `Slot.Root` exige
**1 único filho** (`React.Children.only`). Se `asChild && isLoading`:
- **NÃO** prefixar `<Loader2/>` nem trocar por `loadingText` (quebraria o
  `Slot`). O children passa **intacto**.
- **Aplicar** `aria-busy` e `data-loading` no slot (atributos, não children —
  o `Slot` repassa props ao filho sem violar 1-filho).
- **Não** somar `isLoading` ao `disabled` **via atributo `disabled`** quando
  `asChild` (um `<a>` não tem `disabled` nativo). Em vez disso: `aria-disabled`
  + `pointer-events-none` via classe condicional (não-bloqueia teclado de forma
  enganosa: ver §3.1). Como `blocksInReadOnly` já exige `!asChild`, `asChild` é
  consistentemente "link" — `isLoading` num link é raro; a degradação é
  **segura e explícita**, não silenciosa. (Recomendação ao Front-End: documentar
  no header que `isLoading + asChild` é caso-de-borda suportado mas
  desencorajado — preferir um `<Button>` real para ações que escrevem.)

**(R-4) `icon*` ⇒ spinner substitui o ícone, sem texto.** Em
`size="icon"|"icon-xs"|"icon-sm"|"icon-lg"` não há rótulo; `loadingText` é
**ignorado**; o conteúdo (o ícone) é **substituído** pelo `<Loader2/>` (mesma
caixa `size-*` — sem CLS). `aria-busy` + manter o `aria-label` original do
autor (um icon-button deve ter `aria-label`; UX-0004 não o remove).

**(R-5) `variant="link"`** (`h-auto border-none p-0`): o spinner ainda
prefixa (o `gap-2` da base aplica); sem caixa fixa, mas o link de ação que
escreve é raro e o comportamento é coerente (spinner + texto/`loadingText`).
Sem tratamento especial além do geral.

### 2.3 Render — diff conceitual (NÃO aplicar)

```diff
 function Button({
   className,
   variant = "default",
   size = "default",
   asChild = false,
   allowInReadOnly = false,
+  isLoading = false,
+  loadingText,
   ...props
 }: React.ComponentProps<"button"> &
   VariantProps<typeof buttonVariants> & {
     asChild?: boolean;
     allowInReadOnly?: boolean;
+    isLoading?: boolean;
+    loadingText?: React.ReactNode;
   }) {
   const Comp = asChild ? Slot.Root : "button";
   const isReadOnlyTenantView = readClientAccessContext().accessMode === "read-only-tenant";
   const blocksInReadOnly =
     !allowInReadOnly &&
     !asChild &&
     (variant === "default" || variant === "destructive" || props.type === "submit");
-  const disabled = props.disabled || (isReadOnlyTenantView && blocksInReadOnly);
+  const disabled =
+    props.disabled || (isReadOnlyTenantView && blocksInReadOnly) || isLoading;
+
+  const isIcon = typeof size === "string" && size.startsWith("icon");
+  const { children, ...rest } = props;
+  // asChild: Slot exige 1 filho — NÃO injetar spinner/texto; só atributos.
+  const showSpinnerAndText = isLoading && !asChild;
+  const content = showSpinnerAndText ? (
+    <>
+      <Loader2
+        className={cn(isIcon || size === "xs" || size === "sm" ? "size-3" : "size-4",
+          "animate-spin motion-reduce:animate-none")}
+        aria-hidden="true"
+      />
+      {isIcon ? null : (loadingText ?? children)}
+    </>
+  ) : (
+    children
+  );

   return (
     <Comp
       data-slot="button"
       data-variant={variant}
       data-size={size}
       data-read-only-disabled={disabled && isReadOnlyTenantView ? "true" : "false"}
+      data-loading={isLoading ? "true" : "false"}
+      aria-busy={isLoading || undefined}
+      aria-disabled={asChild && isLoading ? true : undefined}
       className={cn(
         buttonVariants({ variant, size, className }),
+        asChild && isLoading && "pointer-events-none",
       )}
-      {...props}
+      {...rest}
       disabled={disabled}
-    />
+    >
+      {asChild ? children : content}
+    </Comp>
   );
 }
```
*(+ `import { Loader2 } from "lucide-react";` no topo — já é dependência.)*

> ⚠️ Diff **conceitual**. Notas para o Front-End validar na implementação:
> - **`asChild ? children : content`**: com `asChild`, repassa `children`
>   **intacto** (1 filho — `Slot` não quebra). Sem `asChild`, usa `content`
>   (spinner + texto/children).
> - **Hoje o `Button` não desestrutura `children`** (passa via `{...props}`);
>   ao desestruturar `children` de `props`, **garantir** que `rest` ainda
>   espalha tudo o mais **na mesma ordem** (antes de `disabled=`), para o
>   invariante de precedência (§1.2/R-1) **não** mudar. Verificar que
>   `React.ComponentProps<"button">` continua satisfeito (children volta como
>   filho do JSX, não como prop) — TS deve compilar sem mudança de assinatura
>   pública além das 2 props novas.
> - **`size.startsWith("icon")`**: `size` pode ser `undefined` no tipo `cva`;
>   o default é `"default"` (l.48), mas a guarda `typeof size === "string"`
>   evita edge. (Front-End pode usar um `Set` literal por robustez.)
> - **`aria-busy={isLoading || undefined}`**: `undefined` ⇒ atributo **ausente**
>   quando não loading (não `aria-busy="false"` poluindo o DOM — espelha o
>   padrão de `skeleton.tsx` UX-0003).
> - **Precedente de sintaxe provado:** `<Loader2 className="size-4
>   animate-spin" />` é **exatamente** `login-form.tsx:131` (compila/roda em
>   produção) — risco de build ≈ 0.

### 2.4 Aparência (tokens da casa — zero ad-hoc)

- **Spinner:** `<Loader2>` (lucide), `size-4` (default/lg) ou `size-3`
  (xs/sm/icon*), `animate-spin` (Tailwind nativo) + `motion-reduce:animate-none`
  explícito. **Cor = `currentColor`** (herda a cor de texto da variante:
  `text-primary-foreground`, `text-foreground`, etc.) → **nenhuma cor/opacidade
  nova, nenhum token novo, nenhum `oklch` inline**. Contraste do spinner = o
  mesmo do texto da variante (já é o par texto/fundo existente; auditoria de
  contraste é **UX-0006**, fora — mas como o spinner usa **a cor do texto que
  já estava lá**, não introduz par novo a auditar).
- **Espaçamento:** o `gap-2` **já existente** na base `cva` (l.11) separa
  spinner↔texto. **Não** adicionar `gap-rhythm-*` (a base já resolve; mudar o
  gap seria alteração visual perceptível em todos os botões — proibido).
- **`disabled:opacity-45`** **já existente** (l.11) dá o esmaecimento de
  "enviando". UX-0004 **reutiliza** — não adiciona estado de cor próprio. O
  texto do `loadingText`/children herda essa opacidade (legível: 0.45 sobre o
  fundo da variante já é o estado disabled de produção da casa; não é par novo).
- **Sem CLS:** o spinner ocupa a mesma caixa de um `<svg>` filho normal
  (`size-4`, já normalizado pela base l.11 `[&_svg…]:size-4`); trocar texto por
  `loadingText` muda largura **só** se o autor passar `loadingText` mais
  longo/curto — recomendação no header: `loadingText` ≈ comprimento do label
  (ou omitir e manter children → **zero reflow**).

### 2.5 Exemplo de uso (documentação — não é código a aplicar)

```tsx
// Padrão recomendado (generaliza loja/pedidos:1238 — feito em UX-0011, não aqui):
<Button
  type="button"
  isLoading={isSubmitting}
  loadingText="Salvando..."
  onClick={() => void handleConfirmOrderSubmission()}
  disabled={!selectedStore || selectedOrderItems.length === 0}  // gating de domínio: SOMADO
>
  Confirmar pedido
</Button>
// isSubmitting=true ⇒ disabled (read-only/domínio preservados), spinner,
// "Salvando...", aria-busy. Duplo-clique impossível (D03 mitigado).

// Sem loadingText ⇒ mantém o rótulo, só spinner + disabled + aria-busy:
<Button type="submit" isLoading={saving}>Salvar regras</Button>

// asChild (link) ⇒ isLoading só aplica aria-busy/pointer-events (sem spinner):
<Button asChild isLoading={navPending}><Link href="/x">Abrir</Link></Button>
```

### 2.6 Fronteira — o que UX-0004 ADOTA vs o que ADIA (explícito)

| | **ADOTA (entra em UX-0004)** | **ADIA (não entra)** |
|---|---|---|
| **Convenção** | prop `isLoading` + `loadingText` no `src/components/ui/button.tsx` (a convenção canônica: spinner + `disabled` + `aria-busy` + `data-loading`) | — |
| **Sítio de referência `loja/pedidos`** | — (**não tocar** — auditoria: "preservar o bom padrão; generalizar vira UX-0004, **não regredir aqui**") | reescrever `loja/pedidos:1238` p/ consumir `isLoading` → **`UX-0011`/Onda 2** |
| **Login (`login-form.tsx:128`)** | — | migrar o `type=submit` do login p/ `isLoading` → **adiado** (já tem o comportamento manual; e2e clica este botão — não tocar na fundação; consumo futuro em Onda 2/3) |
| **~10 sítios de submit manual** | — | `administrador/usuarios`, `administrador-master/clientes`, `gestor-fabrica/page.tsx` (settings), `gestor-dados/{setores,lojas,linhas-producao}`, `gestor-fabrica/sublinhas-producao`, `loja/pedidos/[orderId]` etc. → **UX-0009 / Onda 2 (`UX-0011`/`0013`/`0016`) / Onda 3** |
| **`confirm-dialog.tsx` (Action Button)** | — | adicionar `isLoading` ao botão de confirmar do dialog (ele é `AlertDialogPrimitive.Action asChild` → caso `asChild`+`isLoading`; útil mas é **adoção**, não a convenção) → **Onda 2** (`UX-0013` usa confirm-dialog) |
| **Toast (UX-0002)** | — (UX-0004 **não** dispara toast) | comunicação de sucesso/erro = **UX-0002**, já commitado — fronteira dura |

> **Decisão explícita "adota vs adia" (requisito do escopo):** UX-0004 **adota
> SÓ a convenção no `button.tsx`**. A "opção" do escopo de "generalizar o padrão
> de referência onde já existe submit manual trivialmente seguro" foi avaliada:
> o candidato natural seria `loja/pedidos:1238` — mas a auditoria **proíbe
> explicitamente** tocá-lo aqui ("não regredir aqui", é `UX-0011`/Onda 2) e o
> outro candidato (login) é clicado pelo e2e e já tem o comportamento manual.
> **Portanto a recomendação do Refinador é: ADIAR 100% da adoção** — UX-0004 =
> **só o primitivo**, 1 arquivo, 1 commit revertível. Generalizar ≠ migrar: a
> convenção **disponibiliza** o padrão; os itens consumidores o **adotam**.
> Isto respeita "1 `UX-####` por commit" e mantém o raio de regressão mínimo.
> (Se o usuário, na aprovação, **quiser** uma adoção-piloto, o único sítio
> trivialmente seguro e fora do caminho do e2e seria
> `administrador-master/clientes/page.tsx:546` `"Provisionando..."` — mas
> permanece **recomendação: não**, por disciplina de escopo da fundação.)

---

## 3. Cobertura de estados / a11y / responsivo

### 3.1 Acessibilidade (WCAG 2.1/2.2 AA — guard-rail da iniciativa)

- **`aria-busy="true"`** no botão enquanto `isLoading` → leitor de tela anuncia
  que a região está ocupada (paridade AT com o spinner visual; espelha o
  `aria-busy` de `skeleton.tsx` UX-0003 e o `aria-live` de `toast.tsx`
  UX-0002). Ausente quando não loading (`|| undefined` — sem `aria-busy="false"`
  ruidoso).
- **Spinner é decorativo:** `<Loader2 aria-hidden="true">` — a informação de
  "ocupado" vem do `aria-busy` + da troca de texto, **não** do ícone (evita
  ruído de "imagem" no AT). **Mudança de canal, não remoção** (mesmo princípio
  de UX-0002/0003).
- **Foco preservado (crítico):** o botão **continua no DOM** (não desmonta) e
  **mantém o foco** ao entrar em loading — não há roubo nem perda de foco. Um
  `<button disabled>` **sai da ordem de tab** no estado disabled: isso é
  **aceitável e desejável aqui** (não se deve tabular para uma ação em voo); o
  foco do usuário não "cai no vazio" porque (a) a ação foi disparada pelo
  próprio botão e (b) o resultado (toast — UX-0002) reanuncia o desfecho. **Não
  introduzir `tabindex` manual** nem mover foco programaticamente (fora de
  escopo; seria mudança de comportamento).
- **Caso `asChild` (link):** `<a>` não tem `disabled` nativo → usa
  `aria-disabled={true}` + `pointer-events-none` (classe condicional). **Não**
  remover o link do tab-order silenciosamente de forma enganosa: `aria-disabled`
  comunica o estado ao AT; `pointer-events-none` evita o clique de mouse. (É
  caso-de-borda desencorajado — §2.2 R-3 — mas tratado, não ignorado.)
- **`focus-visible:*` intacto:** UX-0004 **não toca** a base `cva` (l.11) —
  `focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px]`
  permanece. Foco visível AA preservado byte-a-byte.
- **`prefers-reduced-motion`:** `motion-reduce:animate-none` explícito **no
  `<Loader2>`** **+** o `@media (prefers-reduced-motion: reduce)` global
  (`globals.css:255-263`, zera `animation-duration` p/ `*`). **Dupla**
  garantia: usuário com redução de movimento vê o ícone **estático** (ainda
  comunica "enviando" via `aria-busy` + texto + `disabled`), sem rotação.
  Espelha `toast.tsx`/`skeleton.tsx`.
- **Contraste:** o spinner usa **`currentColor`** = a cor de texto **já
  existente** da variante (par texto/fundo de produção, não novo). UX-0004
  **não introduz par de cor a auditar**; contraste de tokens é **UX-0006**
  (fora). O texto sob `disabled:opacity-45` é o **estado disabled atual da
  casa** (não regressão; não é par novo).

### 3.2 Responsivo / touch

- **Sem mudança de tamanho/hit-target:** UX-0004 **não altera** nenhuma classe
  de `size` do `cva` (l.27-36). `h-10`/`h-11`/`h-8`/`h-7`, `icon size-10` etc.
  permanecem idênticos → hit-target da loja/chão (M7, do shell/UX-0010)
  **não regride**. O spinner vive **dentro** da caixa existente (`gap-2` base).
- **Sem CLS / sem reflow** se `loadingText` for omitido (mantém children) ou
  ≈ do mesmo comprimento (recomendação no header). O spinner substitui a caixa
  de um `<svg>` filho de mesmo `size-*` (a base já normaliza `[&_svg…]:size-4`)
  → largura estável.
- **Touch:** estado `disabled`/`pointer-events-none` no início da ação **é**
  a proteção touch da loja (toque repetido no balcão não re-dispara) — é o
  ganho-alvo de F-5/D03 para a persona Loja.

### 3.3 Estados cobertos

| Estado | Antes (hoje) | Depois (UX-0004) | Regressão? |
|---|---|---|:--:|
| **Idle** (sem `isLoading`) | `<button>`/`Slot` com children, `disabled` computado | **byte-idêntico** (prop ausente/false ⇒ nenhum caminho novo executa) | **nenhuma** |
| **Enviando** (`isLoading`) | (não existia no primitivo — manual e inconsistente) | `disabled` (somado), `<Loader2 animate-spin>`, `loadingText`/children, `aria-busy`, `data-loading` | n/a (novo, opt-in) |
| **read-only-tenant** | `disabled` por `blocksInReadOnly`, `data-read-only-disabled` | **idêntico** (`|| isLoading` não muda quando já disabled; expressão read-only intocada) | **nenhuma** |
| **`asChild`/link** | `Slot` repassa props a 1 filho | **idêntico** se não loading; se `isLoading` ⇒ só `aria-busy`/`aria-disabled`/`pointer-events-none` (children intacto) | **nenhuma** |
| **`disabled` explícito do autor** | `props.disabled` vence (spread antes) | **idêntico** (invariante de precedência mantido; `isLoading` só soma) | **nenhuma** |

> UX-0004 cobre **só** o par Idle↔Enviando. Error/empty/loading-de-página
> **não** são deste primitivo (são UX-0002/0007/0003) — fronteira.

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas → ✅):

- [ ] **Sem `isLoading` = byte-idêntico** — `<Button>` sem a prop (ou
      `isLoading={false}`) renderiza **exatamente** o de hoje: mesmas classes
      `buttonVariants`, mesmo `Comp` (`button`/`Slot`), mesmo `disabled`
      computado, mesmos `data-slot/-variant/-size/-read-only-disabled`,
      `children` no mesmo lugar. (Prova: §5 passo 2 — diff de DOM/`tsc`.)
- [ ] **Read-only-tenant intacto** — `blocksInReadOnly` (l.59-62) e
      `allowInReadOnly` **não alterados**; `disabled` final =
      `props.disabled || (readOnly ∧ blocks) || isLoading` (read-only **vence**
      e independe de `isLoading`); `data-read-only-disabled` mesma lógica.
- [ ] **`asChild` intacto** — com `asChild`, children passa **1 filho**
      intacto (sem injeção de spinner/texto → `Slot`/`React.Children.only`
      não quebra); só `aria-busy`/`aria-disabled`/`pointer-events-none` quando
      `isLoading`. Todos os ~30+ usos `<Button asChild>` (links) compilam e
      renderizam igual.
- [ ] **Precedência de `disabled` preservada** — `{...rest}` espalhado **antes**
      de `disabled={disabled}` (mesma ordem da l.72-73 atual); `props.disabled`
      cru continua perdendo para o computado.
- [ ] **e2e clica os mesmos botões, sem mudança** — `e2e/regression.py`
      0-FAIL, PASS ≥ baseline (≥26). Nenhum botão clicado pelo runner
      (`button[type=submit]` login, "Novo Pedido", links KPI `asChild`) adota
      `isLoading` neste escopo (§1.5/§2.6) ⇒ comportamento e `name` acessível
      **inalterados**. **Nenhum** rótulo/`aria-label` de loading contém a
      substring `error` (smoke `screen_ok` body-check, l.98).
- [ ] **Nenhuma mudança de regra/dado** — `git diff` toca **só**
      `src/components/ui/button.tsx`; **nenhum** `src/lib/**`, `src/app/**`,
      hook, query, `permission-modules`, engine ou cálculo. `isLoading` **não**
      dispara/cancela/altera nenhuma ação — só apresentação + bloqueio de
      re-submit.
- [ ] **Sem dependência nova** — `package.json` inalterado; `Loader2` é
      `lucide-react` (já dep, usado em `login-form.tsx`/`toast.tsx`);
      `animate-spin`/`motion-reduce` Tailwind nativo.
- [ ] **Só token / sem ad-hoc** — spinner usa `currentColor` + `size-3/4`
      (existentes); reusa `gap-2` e `disabled:opacity-45` da base `cva`.
      `grep` no diff: **nenhum** `/NN` ad-hoc novo, **nenhum** `oklch(` inline,
      **nenhuma** classe de cor nova.
- [ ] **a11y** — `aria-busy` presente só quando loading; `<Loader2
      aria-hidden>`; `focus-visible:*` da base intocado;
      `motion-reduce:animate-none` no spinner; foco não roubado/perdido.
- [ ] **Sem CLS** — spinner = caixa de `<svg>` `size-*` já normalizada;
      `loadingText` omitido ⇒ mantém children ⇒ zero reflow.
- [ ] **Escopo: 1 arquivo** — `git diff --name-only` = **só**
      `src/components/ui/button.tsx`. Nenhuma adoção em telas (fronteira §2.6;
      `loja/pedidos`/login **não tocados**).
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso (assinatura pública só
      **ganha** 2 props opcionais → nenhum caller existente quebra).
- [ ] **Commit isolado revertível** — único commit `UX-0004`; `git revert`
      remove só as linhas inseridas em `button.tsx` (nada consome `isLoading`
      ainda — adoção é adiada) → reversão garantidamente sem colateral.

---

## 5. Plano de verificação para o Front-End

Objetivo: provar que **sem `isLoading` o comportamento é byte-idêntico**, que
read-only/`asChild` estão intactos, e que **nenhum seletor/fluxo e2e** mudou.

1. **Escopo do diff (prova mecânica):**
   `git diff --name-only` → **exatamente** `src/components/ui/button.tsx`.
   **Nenhum** `src/lib/**`; **nenhum** `src/app/**` (nem `loja/pedidos`, nem
   `login-form.tsx` — fronteira §2.6). `git diff --stat` ≈ só inserções +
   o `import Loader2`.
2. **Retrocompat byte-idêntica (prova-âncora):**
   `npx tsc --noEmit` exit 0 → as 2 props novas são **opcionais**; **nenhum**
   dos ~29 arquivos com `<Button>` quebra (assinatura só cresceu). Inspeção: o
   ramo `isLoading=false` não executa nenhum código novo (spinner/`content`
   atrás de `showSpinnerAndText`/`isLoading`); `disabled` com `isLoading=false`
   ≡ expressão atual; `children` volta ao mesmo lugar do JSX. (Opcional:
   snapshot/`@testing-library` de um `<Button>` sem a prop antes/depois =
   markup idêntico.)
3. **`asChild` não quebra `Slot`:** procurar (`grep -rn "Button asChild"
   src/app`) os ~30+ usos; `tsc` + `npm run build` verdes provam que
   `asChild ? children : content` mantém 1-filho. Teste manual: um
   `<Button asChild><Link/></Button>` com e sem `isLoading` não lança
   `React.Children.only`.
4. **read-only-tenant intacto:** revisar que `blocksInReadOnly`/`allowInReadOnly`
   e `data-read-only-disabled` **não** mudaram; em mock `accessMode =
   "read-only-tenant"`, um `<Button variant="default">` continua `disabled`
   com `data-read-only-disabled="true"` **com e sem** `isLoading`.
5. **Lint / build / test:** `npm run lint` (0 erro novo), `npm run build`
   (`next build` — Tailwind 4 resolve `animate-spin`/`size-4`; precedente
   provado `login-form.tsx:131`), `npx tsc --noEmit` (exit 0),
   `npm test` (sem regressão).
6. **Smoke visual, 6 personas** (`e2e/README.md` na memória do projeto):
   logar nas 6 personas; abrir telas com botões variados (loja/pedidos,
   gestor-fabrica settings, administrador/usuarios). Verificar: (a) **todos os
   botões idle pixel-idênticos** ao baseline (UX-0004 não adota em tela —
   nenhuma deve mudar visualmente; se algo mudar, há erro de implementação:
   parar); (b) **canário read-only**: persona master (read-only-tenant) — botões
   `default`/`submit` continuam desabilitados como hoje. **Nenhuma** tela deve
   exibir spinner (não há adoção — prova da fronteira).
7. **Runner E2E de não-regressão (âncora M6):**
   `e2e/regression.py` (versionado — ver [[e2e-playwright-setup]] na memória do
   projeto / [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0 D-0]])
   → **0-FAIL**, PASS **≥ baseline (≥26)**, 6 personas. Login das 6
   (`button[type=submit]` — não tocado), "Novo Pedido" (loja), links KPI
   (`asChild`), smoke piloto — **todos inalterados** (assert pós-`networkidle`;
   nenhum botão do caminho do runner adota `isLoading`). Qualquer queda =
   parada + rollback do item (regra do plano de orquestração).

> Critério de aprovação do Gate 1 p/ este item: passos 1-7 verdes **e**
> checklist §4 100% marcado no autorreview.

---

## 6. Riscos & notas de implementação (para o Front-End)

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | **Quebra de retrocompat** ao desestruturar `children` de `props` (hoje passa via `{...props}`) — ordem de spread/precedência de `disabled` muda | Média | **Alto** | §2.3: `rest` espalhado **antes** de `disabled=` (mesma posição da l.72-73); `children` volta como filho do JSX. Passo 2 (`tsc` + snapshot idle antes/depois = markup idêntico) é a prova-âncora. **Se o snapshot diferir com `isLoading` ausente: parar** — a retrocompat é o requisito #1. |
| **R2** | **`asChild` + `isLoading`** injeta 2º filho → `React.Children.only` lança em runtime | Média | Alto | Regra dura §2.2 R-3 / §2.3: com `asChild`, `children` passa **intacto** (nunca `content`); só atributos (`aria-busy`/`aria-disabled`/`pointer-events-none`). Passo 3 cobre os ~30+ usos `asChild`. |
| **R3** | **Colisão com read-only**: `isLoading` redefine/encobre o `disabled` de tenant | Baixa | **Alto** | §2.2 R-1/R-2: `isLoading` é **`||`-somado** ao final; expressão read-only e `data-read-only-disabled` **não tocadas**. Passo 4 valida em mock read-only. |
| **R4** | Front-End **adotar** `isLoading` em telas dentro de UX-0004 (escopo UX-0009/Onda 2 — esp. tocar `loja/pedidos:1238` ou `login-form.tsx`, que a auditoria proíbe/are e2e-críticos) | **Média** | Alto | Fronteira escrita (§1.3, §2.6). Passo 1 **reprova** qualquer `src/app/**` no diff. "Generalizar ≠ migrar" — recomendação explícita: **adiar 100% da adoção**. |
| **R5** | Spinner com `loadingText` mais longo que o label → reflow/CLS no botão | Baixa | Baixo | §2.4: sem `loadingText` ⇒ mantém children (zero reflow); header recomenda `loadingText` ≈ comprimento do label. Botão tem `whitespace-nowrap` (base l.11) → não quebra linha. |
| **R6** | `motion-reduce` não aplicar / spinner gira com redução de movimento | Baixa | Médio | Dupla garantia: `motion-reduce:animate-none` no `<Loader2>` **+** `@media reduce` global (`globals.css:255`). Passo 6 verifica estático com DevTools "reduce". |
| **R7** | e2e: rótulo de loading contém `error` → falso-FAIL no `screen_ok` body-check | Baixa | Médio | §2.1: sem default textual "Enviando…"; `loadingText` é do autor (adoção adiada → **nenhum** loadingText existe neste escopo). Passo 7 (e2e 0-FAIL) é o canário; `git diff | grep -i error` no button.tsx = vazio. |
| **R8** | `lucide-react` `Loader2` aumentar bundle / tree-shaking | Baixa | Baixo | `lucide-react` já é dep e já importa ícones em dezenas de sítios (inclui `Loader2` em `login-form.tsx`); 1 ícone a mais é desprezível e tree-shakeável. |

**Notas de implementação:**

- **Ordem de toque (plano):** UX-0004 vem na leva "primitivos de estado" da
  Onda 1, **após** `UX-0005` (commitado), `UX-0002` (commitado), `UX-0003`
  (commitado) e **antes** de `UX-0001`/`UX-0007`
  ([[Backlog UX (RICE)]] §Sequência, l.176). Commit isolado `UX-0004`.
- **Espelhar a gramática de primitivo da casa** (`button.tsx` atual +
  `toast.tsx`/`skeleton.tsx` UX-0002/0003): `"use client"` já no topo;
  `import * as React`; manter `cva`/`cn`/`data-slot`; `motion-reduce`
  explícito; `aria-*` com `|| undefined` (sem atributo "false" ruidoso);
  header-comentário `/* UX-0004 — … */` explicando o porquê (espelha
  `toast.tsx:16-21`).
- **Reversibilidade:** como **nada** consome `isLoading` em UX-0004 (adoção
  adiada — §2.6), `git revert` remove só as linhas inseridas em `button.tsx`,
  **garantidamente sem colateral**.
- **Não introduzir** dark-mode, primitivo de spinner novo, dependência
  (lucide já é dep), default textual visível, nem mover foco programaticamente
  — fora de escopo / guard-rail.
- **Entregar no autorreview/Changelog** ([[10 - Changelog Vivo/2026-05|Changelog
  do mês]], template em `Docs/10 - Changelog Vivo/Template — Entrada de
  Changelog.md`): a API final (`isLoading`/`loadingText` + regras `asChild`/
  `icon*`/read-only) + a nota de fronteira (§2.6) — é o contrato que
  `UX-0011`/`0013`/`0016`/UX-0009 vão consumir para a adoção tela-a-tela.

---

## 7. Autorreview (Front-End)

> Preenchido pelo agente `frontend-design-senior` (skill `/frontend-design`
> aplicada como passo obrigatório no início). Implementação executada
> **2026-05-19**, loop autônomo Onda 1 (após UX-0005/0002/0003 commitados).

### 7.1 Resumo do diff (mecânico)

`git diff --name-only` em `src/` → **exatamente 1 arquivo**:
`src/components/ui/button.tsx` (`+71 −4`). Nenhum `src/lib/**`, nenhum
`src/app/**` (loja/pedidos e login-form **não tocados** — fronteira §2.6).
Mudanças aplicadas (exatamente o diff conceitual §2.3 + as 3 notas de
validação):

1. `+ import { Loader2 } from "lucide-react";` (já dependência — usado em
   `login-form.tsx`/`toast.tsx`). Nenhuma alteração em `package.json`.
2. Header-comentário `/* UX-0004 — … */` (espelha a gramática de
   `toast.tsx`/`skeleton.tsx`) + `type ButtonSize` + `const ICON_SIZES =
   new Set<ButtonSize>([...])` (robustez sobre `startsWith` — recomendação §2.3).
3. 2 props opcionais destrutudas (`isLoading = false`, `loadingText`) somadas
   ao **intersection type existente** (não à `cva`), com JSDoc do contrato.
4. `disabled` agora `props.disabled || (readOnly ∧ blocks) || isLoading` —
   `isLoading` **somado** ao OR final; expressão read-only/`blocksInReadOnly`/
   `allowInReadOnly` **byte-idêntica**.
5. `const { children, ...rest } = props;` → `rest` espalhado **na mesma
   posição** (antes de `disabled={disabled}`); `children` volta como **filho do
   JSX** (`{asChild ? children : content}`), não como prop.
6. `data-loading`, `aria-busy={isLoading || undefined}`,
   `aria-disabled={asChild && isLoading ? true : undefined}` e a classe
   condicional `asChild && isLoading && "pointer-events-none"` adicionados —
   todos no-op quando `!isLoading`.

`git diff src/components/ui/button.tsx | grep -i error` → **vazio** (nenhum
default textual; sem `loadingText` neste escopo — adoção adiada). Sem `oklch(`
inline, sem `/NN` ad-hoc novo, sem classe de cor nova: spinner = `currentColor`
+ `size-3/4` + `gap-2`/`disabled:opacity-45` **da base `cva` existente**.

### 7.2 Prova de retrocompat (requisito-âncora) + decisões de risco

**Prova byte-idêntica (R1).** Sem `isLoading` (ou `isLoading={false}`):
`disabled = props.disabled || (readOnly ∧ blocks) || false` ≡ expressão atual
(`|| false` é identidade booleana). `showSpinnerAndText = false && !asChild =
false` → `content = children` (ramo `else`, **nenhum** caminho novo executa:
nem `Loader2`, nem `loadingText`, nem `isIcon`). `asChild ? children : content`
⇒ ambos os ramos resolvem para `children`. `rest` é espalhado **na mesma
posição** que o antigo `{...props}` (antes de `disabled=`), e `children`
desestruturado de `props` apenas migra de prop-via-spread para filho-do-JSX —
React trata `<Comp {...{children:x}} />` e `<Comp>{x}</Comp>` de forma
idêntica; quando não há children, `{undefined}` como filho ≡ ausência. Os 3
`data-*` atuais inalterados; `data-loading="false"`/ausência de `aria-busp`
(`|| undefined`) não poluem o DOM. `npx tsc --noEmit` exit 0 → as 2 props são
opcionais, **nenhum** dos ~29 callers de `<Button>` quebra (assinatura só
**cresceu**). Conclusão: render byte-idêntico provado por construção + tsc.

**R2 — `asChild` + `isLoading`.** Regra dura aplicada: `Comp = Slot.Root`
recebe **`children` intacto** (`{asChild ? children : content}` → `children`,
nunca `content`); `showSpinnerAndText = isLoading && !asChild` é `false` quando
`asChild` ⇒ spinner/`loadingText` **nunca** injetados → `React.Children.only`
do Slot **não pode** quebrar. Só atributos no slot:
`aria-busy`/`aria-disabled`/`pointer-events-none`. `blocksInReadOnly` já exige
`!asChild` (inalterado), então `asChild` continua "passagem para link"
coerente. Todos os usos `<Button asChild><Link/></Button>` compilam (tsc verde)
e renderizam igual.

**R3 — colisão read-only.** `isLoading` é `||`-somado **depois** de
`(isReadOnlyTenantView && blocksInReadOnly)`; a expressão read-only,
`allowInReadOnly` e `data-read-only-disabled` **não foram tocados**. Se o
tenant é read-only e o botão já está `disabled`, `|| isLoading` é inerte
(já `true`). read-only e loading são razões independentes e compatíveis de
`disabled` — read-only vence e é preservado.

**R4 — adoção indevida.** Zero adoção: `git diff --name-only` em `src/` = só
`button.tsx`; `loja/pedidos`/`login-form`/`confirm-dialog`/~10 submits manuais
**não tocados** (fronteira §2.6). R5/R6/R7/R8: sem `loadingText` neste escopo
(zero CLS/reflow); `motion-reduce:animate-none` no `<Loader2>` + `@media
reduce` global (dupla garantia); nenhum `error` no diff; `Loader2` é 1 ícone
tree-shakeável de dep já presente.

### 7.3 Checklist §4 — todas ✅

- [x] **Sem `isLoading` = byte-idêntico** — provado §7.2 (R1) + `tsc` exit 0;
      mesmas classes `buttonVariants`, mesmo `Comp`, mesmo `disabled`
      computado, mesmos `data-slot/-variant/-size/-read-only-disabled`,
      `children` no mesmo lugar lógico.
- [x] **Read-only-tenant intacto** — `blocksInReadOnly`/`allowInReadOnly` não
      alterados; `disabled` final `= props.disabled || (readOnly ∧ blocks) ||
      isLoading`; `data-read-only-disabled` mesma lógica.
- [x] **`asChild` intacto** — `children` 1 filho intacto, sem injeção; só
      atributos quando `isLoading`. tsc verde p/ os ~30+ usos `asChild`.
- [x] **Precedência de `disabled` preservada** — `{...rest}` antes de
      `disabled={disabled}` (mesma ordem da l.72-73 antiga); `props.disabled`
      cru continua perdendo para o computado.
- [x] **e2e clica os mesmos botões, sem mudança** — nenhum botão clicado pelo
      runner adota `isLoading` (login/`Novo Pedido`/KPI links inalterados —
      diff só em `button.tsx`); sem `isLoading` ⇒ comportamento e `name`
      acessível idênticos. **Nenhum** `error` no diff (verificado por grep).
      *(execução do runner = orquestrador.)*
- [x] **Nenhuma mudança de regra/dado** — diff só `src/components/ui/button.tsx`;
      nenhum `src/lib/**`/`src/app/**`/hook/query/permission/engine.
      `isLoading` só apresentação + bloqueio de re-submit.
- [x] **Sem dependência nova** — `package.json` inalterado; `Loader2` de
      `lucide-react` (já dep); `animate-spin`/`motion-reduce` Tailwind nativo.
- [x] **Só token / sem ad-hoc** — `currentColor` + `size-3/4`; reusa `gap-2` e
      `disabled:opacity-45` da base. Diff sem `oklch(`, sem `/NN` novo, sem cor.
- [x] **a11y** — `aria-busy` só quando loading (`|| undefined`); `<Loader2
      aria-hidden>`; `focus-visible:*` da base intocado;
      `motion-reduce:animate-none` no spinner; botão não desmonta (foco não
      roubado/perdido).
- [x] **Sem CLS** — spinner = caixa `<svg>` `size-*` já normalizada;
      `loadingText` não usado neste escopo ⇒ zero reflow.
- [x] **Escopo: 1 arquivo** — `git diff --name-only` (src) = só `button.tsx`.
- [x] **lint/tsc/test verdes** — `npm run lint` 0 erros (6 warnings
      pré-existentes em **outros** arquivos, nenhuma em `button.tsx`);
      `npx tsc --noEmit` exit 0; `npm test` 110 pass / 0 fail.
      *(build/e2e = orquestrador, conforme processo.)*
- [x] **Commit isolado revertível** — nada consome `isLoading` (adoção
      adiada) → `git revert` remove só as linhas inseridas, sem colateral.

### 7.4 API final (contrato p/ UX-0009 / Onda 2 — `UX-0011`/`0013`/`0016`)

```ts
isLoading?: boolean;            // default false. Soma disabled + spinner +
                                // aria-busy + data-loading. Ausente ⇒ no-op total.
loadingText?: React.ReactNode;  // opcional. Ausente ⇒ mantém children (zero
                                // reflow). Ignorado em size="icon*" e asChild.
```

Regras de consumo: (a) `disabled` de domínio do autor é **somado** (`isLoading`
nunca o substitui); (b) `size="icon*"` ⇒ só spinner (mantenha o `aria-label`
do autor); (c) `asChild`/link ⇒ só `aria-busy`/`aria-disabled`/
`pointer-events-none` (sem spinner — prefira `<Button>` real para escrita);
(d) NÃO usar `loadingText` contendo a substring `error` (smoke `screen_ok`).

### 7.5 Verificação §5 (passos executados pelo Front-End)

| Passo | Resultado |
|---|---|
| 1. Escopo do diff | ✅ só `src/components/ui/button.tsx` (+71 −4); nenhum `src/app`/`src/lib` |
| 2. Retrocompat byte-idêntica | ✅ provado por construção (§7.2 R1) + `tsc --noEmit` exit 0 |
| 3. `asChild` não quebra Slot | ✅ `children` 1-filho intacto; tsc verde p/ usos `asChild` |
| 4. read-only intacto | ✅ expressão/`data-read-only-disabled` inalterados; `||`-soma inerte quando já disabled |
| 5. lint/tsc/test | ✅ lint 0 erros; tsc exit 0; test 110/110 |
| 6. Smoke 6 personas | ⏳ orquestrador (nenhuma tela adota → nenhum botão deve mudar visualmente) |
| 7. Runner E2E não-regressão | ⏳ orquestrador (sem `isLoading` em botões do runner ⇒ 0-FAIL esperado) |

> Passos 1-5 (Front-End) ✅. Passos 6-7 (build/smoke/e2e) = orquestrador,
> conforme processo de entrega da iniciativa.
