# UX-0005 — Escala de espaçamento + degraus canônicos de opacidade em `globals.css`

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner`). Companheira de [[Backlog UX (RICE)]] (item l.93-96),
> [[UX PRD]] (critérios "Visual / Token", §6; resolução Gate 0 D-2, §10),
> [[UX Audit — Sistema]] (achado [[UX Audit — Sistema#F-4 — Tokens/opacidade ad-hoc; sem escala de espaçamento|F-4]]).
> Convenção: [[12 - Iniciativa UX/README|README]].

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec não altera comportamento,
  regra de negócio, dado, navegação nem `permission-modules`.
- **Só token/tema.** O escopo é exclusivamente `@theme`/`:root` em
  `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/globals.css`.
  **Zero comportamento. Zero mudança de aparência percebida.**
- **Aditivo e retrocompatível.** Nenhum token existente é removido ou renomeado.
  A escala nova **soma**; a migração das opacidades ad-hoc é um mapeamento 1-para-1
  que preserva o valor numérico (mesma cor renderizada).
- **Implementação é etapa separada.** Este documento é a especificação. Quem implementa
  é o agente Front-End Sênior (`/frontend-design`) numa etapa posterior, **após
  aprovação explícita do usuário**. Esta spec **não toca `src/`**.
- **Pré-requisito de [[Backlog UX (RICE)|UX-0009]]** (normalização dos 7 shared + 4
  layout) — UX-0009 consome a escala definida aqui.
- **Fronteira com [[Backlog UX (RICE)|UX-0006]]:** contraste WCAG é item separado.
  Pares OKLCH suspeitos encontrados aqui são **registrados como input para UX-0006**
  (§3), **não resolvidos** nesta spec. Gate 0 D-2 autoriza ajuste mínimo de luminância
  OKLCH **somente** onde reprovar AA — e isso pertence ao UX-0006.

---

## 1. Diagnóstico do estado atual

### 1.1 O que `globals.css` define hoje

Arquivo: `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/globals.css` (240 linhas).

| Categoria de token | Onde | Situação |
|---|---|---|
| Fontes | `globals.css:5-7` (`--font-sans`/`--font-heading`/`--font-mono` → Plus Jakarta / Sora / JetBrains Mono via `next/font`) | ✅ canônico |
| Cores semânticas (OKLCH) | `globals.css:9-53` (`@theme inline`) + `:67-114` (`:root`) — `canvas`/`surface`/`panel`/`background`/`card`/`popover`/`primary`/`secondary`/`muted`/`accent`/`destructive`/`info`/`success`/`warning`/`danger` + `*-foreground`, `border`/`border-strong`/`input`/`ring`, família `sidebar-*` | ✅ canônico |
| Raio | `globals.css:55-59` (`--radius-sm…--radius-2xl`) derivados de `--radius: 0.9rem` (`:68`) | ✅ canônico (escala derivada existe) |
| Sombras | `globals.css:61-64` (`@theme`) + `:116-130` (`:root`) — `shadow-card`/`soft`/`popover`/`elevated`, todas via `color-mix(... var(--foreground) N% ...)` | ✅ canônico |
| **Espaçamento** | — | ❌ **Não existe escala** no `@theme`. O projeto usa a escala default do Tailwind 4 (4px-step: `p-2`, `gap-4`, `space-y-6`…) **sem tokens semânticos próprios** nem nomes de ritmo. Os primitivos shared escolhem padding/gap caso a caso (ver F-7 / UX-0009). |
| **Degraus de opacidade** | — | ❌ **Não existe degrau canônico.** Os componentes aplicam opacidade ad-hoc na sintaxe Tailwind `cor/NN` (ex.: `bg-warning/22`, `border-border/65`), com 16 valores distintos não-padronizados. |

**Observações de tema relevantes para a escala (não alterar):**
- `--radius: 0.9rem` (`:68`) e a escala derivada `calc(var(--radius) ± Npx)` (`:55-59`)
  são o **precedente de design** desta casa: escala **derivada de uma âncora por
  `calc()`**, exposta no `@theme`. A escala de espaçamento proposta segue **o mesmo
  padrão arquitetural** (âncora + degraus nomeados), por consistência interna.
- As sombras já usam `color-mix(in oklch, … N%, transparent)` (`:116-130`) — ou seja,
  **a casa já trata "quantidade de cor" como porcentagem nomeada via `color-mix`**.
  Os degraus de opacidade canônicos seguem essa mesma gramática conceitual.
- O `@theme inline` (`:4-65`) usa o padrão Tailwind 4 de mapear `--color-*`/`--radius-*`/
  `--shadow-*` para variáveis de `:root`. A escala nova entra **no mesmo bloco**, como
  `--spacing-*` (espaçamento) e `--opacity-*` (degraus), sem tocar nenhuma linha existente.

### 1.2 Onde estão as opacidades / cores ad-hoc (evidência real)

Varredura de `src/components/shared/` (18 arquivos). **108 ocorrências** de utilitário
token-com-opacidade (`<utilitário>-<token>/NN`, excluindo OKLCH inline) distribuídas em
**16 degraus distintos** — nenhum padronizado:

| Degrau ad-hoc (`/NN`) | Ocorrências | Onde aparece (amostra real, arquivo:linha) |
|:--:|:--:|---|
| `/10` | 5 | `factory-flow.tsx:61` `bg-primary/10`; `operational-sequence-card.tsx:27-29` `bg-info/10`,`bg-warning/10`,`bg-success/10`; `page-hero.tsx:55` `bg-accent/10` |
| `/15` | 5 | `status-badge.tsx:46,53,116,144,158` `bg-success/15` (estado "ativo/concluído/entregue/aprovado") |
| `/18` | 4 | `status-badge.tsx:130,165,172,235` `bg-danger/18` (estado "cancelado/reprovado/aberta/tentativa_falha") |
| `/20` | 2 | `module-card.tsx:16,17` `bg-info-foreground/20`,`bg-success-foreground/20` |
| `/22` | 8 | `status-badge.tsx:81,88,95,151,179,193,214,221` `bg-warning/22` / `bg-info/22` |
| `/25` | 6 | `module-card.tsx:19,20,22` `bg-*-foreground/25`; `profile-page.tsx:555,561` `bg-danger/25`,`bg-success/25`; +1 marker OKLCH inline `module-card.tsx:18,21` |
| `/30` | 5 | `operational-sequence-card.tsx:27-29` `border-info/30`,`border-warning/30`,`border-success/30`; `page-hero.tsx:55` `border-accent/30`; `factory-flow.tsx:61` `border-primary/35`→ (ver `/35`) |
| `/35` | 21 | `status-badge.tsx` (todos os `ring-*/35`: l.48,55,83,90,97,118,132,146,153,160,167,174,181,195,216,223,237); `data-table.tsx:221` `border-border-strong/35`; `module-card.tsx:51` `border-border-strong/35` |
| `/40` | 4 | `data-table.tsx:387` `bg-danger/40`; `operational-sequence-card.tsx:69` `border-border-strong/40`; `profile-page.tsx:555,561` `border-danger/40`,`border-success/40` |
| `/50` | 2 | `kpi-card.tsx:145` `border-primary/50`; `searchable-select.tsx:131` `bg-panel/50` |
| `/55` | 3 | `data-table.tsx:347,363` `border-border/55`; `operation-filters-card.tsx:69` `bg-panel/55` |
| `/60` | 2 | `data-table.tsx:414` `border-border/60`; `kpi-card.tsx:171` `ring-border/60` |
| `/65` | 9 | `status-badge.tsx:63,70,203,210,247` `bg-muted-foreground/65`; `data-table.tsx:210,242` `border-border/65`; `operation-filters-card.tsx:112`; `operational-sequence-card.tsx:90` |
| `/70` | 17 | `status-badge.tsx:60,67,200,207,244` `bg-secondary/70`; `page-header.tsx:22`,`page-hero.tsx:29`,`kpi-card.tsx:144`,`operation-filters-card.tsx:69`,`operational-sequence-card.tsx:26,52,70` `border-border/70`; `info-hint.tsx:24` `text-muted-foreground/70`; `searchable-select.tsx:123` `divide-border/70`; `profile-page.tsx:348` |
| `/75` | 1 | `profile-page.tsx:346` `border-border/75` |
| `/80` | 14 | `info-hint.tsx:25-28` `text-info/80`,`text-warning/80`,`text-danger/80`,`text-success/80`; `factory-flow.tsx:42` `border-border/80`; `module-card.tsx:51`,`pagination-controls.tsx:45`,`searchable-select.tsx:119`,`operation-filters-card.tsx:87,96`,`operational-date-scope-card.tsx:61`,`profile-page.tsx:356`,`data-table.tsx:387` `text-danger-foreground/80` |

> **Total: 108 ocorrências de opacidade ad-hoc** sobre token, em **16 degraus
> distintos**, em **15 dos 18** arquivos de `src/components/shared/`.

**Cores OKLCH inline (fora de token) — evidência adicional do mesmo achado F-4:**

- `status-badge.tsx:43-248` — `statusConfig` define **62 ocorrências `oklch(…)`
  hardcoded** (`text-[oklch(…)]`, `bg-[oklch(…)]`, `ring-[oklch(…)]`, `dot`),
  **28 tripletos OKLCH distintos** (ex.: `text-[oklch(0.34_0.07_162)]` l.47,
  `bg-[oklch(0.94_0.018_255)]` l.74, `dot: bg-[oklch(0.62_0.16_45)]` l.105). Vários
  estados (`em_forno`, `embalando`, `em_espera`, `rota_entrega`, `nao_iniciado`,
  `no_destino`, `aguardando_cliente`) **não têm token semântico equivalente** —
  são paletas próprias inline.
- `module-card.tsx:18,21` — `violet`/`cyan` definem ícone e marcador como
  `bg-[oklch(…)]`/`text-[oklch(…)]` + sufixo `/25` aplicado **sobre cor arbitrária**
  (`bg-[oklch(0.43_0.08_293)]/25`).
- `kpi-card.tsx:34,39,44,49` — `trend` usa 4 `text-[oklch(…)]` hardcoded
  (info/success/warning/danger trend).

> ⚠️ **Limite de escopo (Gate 0 / backlog):** os **valores de cor** OKLCH inline e a
> ausência de token para ~7 estados de `status-badge` são problema de **paleta /
> contraste**, endereçado por **[[Backlog UX (RICE)|UX-0006]]** (auditoria WCAG AA) e
> pela parte de cor de **UX-0009** (normalização). **UX-0005 resolve só a dimensão
> _opacidade/espaçamento_**: substitui o **sufixo `/NN`** por um degrau canônico,
> preservando o valor. Onde a opacidade incide sobre OKLCH inline (ex.:
> `module-card.tsx:18` `…/25`), UX-0005 só canoniza o `/25`; **a cor inline em si fica
> para UX-0009/UX-0006**. Pares suspeitos vão para a §3 como input do UX-0006 — **não
> são resolvidos aqui**.

### 1.3 Diagnóstico (síntese — motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como motor de análise. Achados consolidados,
priorizados por impacto/risco (categoria **Token**, achado **F-4**):

1. **Sem escala de espaçamento canônica** (`/ux-ui-refiner` audit "Spacing & rhythm" /
   "magic numbers"): não há vocabulário de ritmo nomeado. Cada primitivo shared escolhe
   padding/gap empírico (`px-5 py-6` vs `px-5 py-7`, `rounded-xl` vs `rounded-2xl`,
   ver F-7). Sem âncora compartilhada, UX-0009 não tem alvo para normalizar.
2. **16 degraus de opacidade ad-hoc** ("inconsistent gaps" / "stick to a small scale"):
   `/15 /18 /22 /35` etc. são ruído — `bg-success/15` e `bg-success/18` são
   visualmente indistinguíveis mas multiplicam combinações. Mesmo papel semântico
   (fundo-de-tag, anel, separador) com opacidade diferente entre componentes.
3. **Cor OKLCH inline fora de token** (skill "stick to semantic tokens everywhere"):
   `status-badge`/`module-card`/`kpi-card` reimplementam paleta — fora do escopo de
   UX-0005 (vai para UX-0009/UX-0006), mas é o **mesmo F-4** e a spec o registra.

UX-0005 ataca **(1)** e **(2)** — puramente aditivo, reversível trivial — e deixa
**(3)** mapeado para os itens corretos.

---

## 2. Spec de refinamento

> Implementação 100% em `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/globals.css`,
> dentro do bloco `@theme inline` (`:4-65`) e, quando precisar de variável-fonte, em
> `:root` (`:67-131`). **Nenhuma linha existente é editada ou removida — só inserção.**

### 2.1 Escala de espaçamento canônica (ritmo 4/8px)

Tailwind 4 já usa step de `0.25rem` (4px). A proposta **não substitui** a escala
numérica do Tailwind (`p-2`, `gap-4` continuam válidos e usados) — ela **adiciona
tokens semânticos de ritmo**, espelhando o padrão âncora-derivada que a casa já usa
para `--radius` (`globals.css:55-59`). Âncora: `--space-unit: 0.25rem` (4px).

| Token (`@theme`) | Valor | px | Papel semântico (uso pretendido — UX-0009 consome) |
|---|---|:--:|---|
| `--spacing-3xs` | `calc(var(--space-unit) * 1)` | 4px | hairline / gap intra-ícone (ex.: `gap-1` do dot no badge) |
| `--spacing-2xs` | `calc(var(--space-unit) * 2)` | 8px | gap entre rótulo e valor; padding de chip pequeno |
| `--spacing-xs`  | `calc(var(--space-unit) * 3)` | 12px | padding interno compacto; gap de form denso |
| `--spacing-sm`  | `calc(var(--space-unit) * 4)` | 16px | padding-padrão de célula/controle; gap de lista |
| `--spacing-md`  | `calc(var(--space-unit) * 6)` | 24px | padding de card / seção; ritmo vertical padrão |
| `--spacing-lg`  | `calc(var(--space-unit) * 8)` | 32px | separação entre blocos de uma tela |
| `--spacing-xl`  | `calc(var(--space-unit) * 12)` | 48px | separação entre grandes seções / hero |
| `--spacing-2xl` | `calc(var(--space-unit) * 16)` | 64px | respiro de topo de página / faixas |

Racional dos passos: **4 → 8 → 12 → 16 → 24 → 32 → 48 → 64**. Ritmo 4/8 puro (todos
múltiplos de 4; do `sm` em diante, múltiplos de 8). 8 degraus = granularidade
suficiente sem reintroduzir a fragmentação que a escala combate. Os valores **coincidem
com utilitários Tailwind existentes** (`1/2/3/4/6/8/12/16`) — adoção em UX-0009 pode ser
via token (`p-[--spacing-md]`) ou pelo utilitário equivalente; **decisão de aplicação é
do UX-0009**, não desta spec.

> **Nota de retrocompatibilidade:** estes tokens são **aditivos**. Nenhum componente é
> obrigado a migrar em UX-0005 (UX-0005 só define; UX-0009 adota onde fizer sentido).
> Nada que hoje usa `p-6`/`gap-4` quebra ou muda de aparência.

### 2.2 Degraus canônicos de opacidade

Princípio: **colapsar os 16 degraus ad-hoc nos 7-8 degraus mais próximos**, escolhidos
para que **cada substituição mude ≤ 3 pontos percentuais de opacidade** — diferença
**imperceptível** sobre os fundos claros desta paleta (`canvas` L≈0.975,
`surface` L≈0.995). Os números canônicos privilegiam os valores **já mais frequentes**
no código (menor mudança agregada): `/35` (21×), `/70` (17×), `/80` (14×), `/65` (9×).

| Token (`@theme` → `--opacity-*`) | Valor | Papel semântico canônico |
|---|:--:|---|
| `--opacity-faint`     | `0.10` | wash de fundo tonal mínimo (ex.: `bg-accent/10` em hero) |
| `--opacity-subtle`    | `0.16` | fundo de badge/tag tonal (estado em status-badge) |
| `--opacity-soft`      | `0.22` | fundo tonal de destaque médio (warning/info badge) |
| `--opacity-muted`     | `0.25` | wash de bloco informativo (callout, marker) |
| `--opacity-border`    | `0.35` | anel/realce sutil (ring de badge, borda-forte suave) |
| `--opacity-divider`   | `0.55` | divisor/borda de baixo contraste |
| `--opacity-strong`    | `0.65` | borda/divisor padrão de card e tabela |
| `--opacity-prominent` | `0.78` | borda/texto secundário evidente; superfície semitransparente |

> 8 degraus, faixas não-sobrepostas. Cada degrau cobre um cluster de valores ad-hoc
> vizinhos. Nomes **semânticos** (papel), não numéricos — alinhado ao
> `/ux-ui-refiner` ("pick a small scale and stick to it") e ao precedente da casa
> (`shadow-card/soft/popover/elevated` nomeia por papel, não por blur).

#### Tabela de-para (cada opacidade ad-hoc real → degrau canônico)

> Regra de mapeamento: **vizinho mais próximo, delta ≤ 3pp**, preservando a aparência
> percebida. Onde dois canônicos são equidistantes, escolhe-se o que **minimiza a soma
> de deltas ponderada pela frequência** (valores mais usados deslocam menos).

| Ad-hoc | Ocorr. | → Token canônico | Valor canônico | Δ (pp) | Nota de aparência |
|:--:|:--:|---|:--:|:--:|---|
| `/10` | 5  | `--opacity-faint`     | 0.10 | 0  | idêntico |
| `/15` | 5  | `--opacity-subtle`    | 0.16 | +1 | imperceptível (fundo de badge sobre surface) |
| `/18` | 4  | `--opacity-subtle`    | 0.16 | −2 | imperceptível |
| `/20` | 2  | `--opacity-soft`      | 0.22 | +2 | imperceptível (fundo `*-foreground/20` em module-card) |
| `/22` | 8  | `--opacity-soft`      | 0.22 | 0  | idêntico |
| `/25` | 6  | `--opacity-muted`     | 0.25 | 0  | idêntico |
| `/30` | 5  | `--opacity-border`*   | 0.35 | +5 | ⚠️ ver nota† — candidato a `--opacity-muted` (0.25, −5) |
| `/35` | 21 | `--opacity-border`    | 0.35 | 0  | idêntico (degrau-âncora, maior frequência) |
| `/40` | 4  | `--opacity-border`    | 0.35 | −5 | ⚠️ ver nota† |
| `/50` | 2  | `--opacity-divider`   | 0.55 | +5 | ⚠️ ver nota† |
| `/55` | 3  | `--opacity-divider`   | 0.55 | 0  | idêntico |
| `/60` | 2  | `--opacity-strong`    | 0.65 | +5 | ⚠️ ver nota† |
| `/65` | 9  | `--opacity-strong`    | 0.65 | 0  | idêntico |
| `/70` | 17 | `--opacity-strong`    | 0.65 | −5 | ⚠️ ver nota† (degrau muito usado) |
| `/75` | 1  | `--opacity-prominent` | 0.78 | +3 | limítrofe (1 ocorrência, borda) |
| `/80` | 14 | `--opacity-prominent` | 0.78 | −2 | imperceptível |

**† Nota sobre os 6 pares com Δ=±5pp (`/30 /40 /50 /60 /70` e a opção de `/30`):**
5pp de opacidade sobre os fundos claros desta paleta é a fronteira do perceptível.
Para honrar o guard-rail "**aparência percebida idêntica**" com margem de segurança,
a spec **autoriza ao Front-End duas estratégias**, a confirmar na aprovação:

- **(A) Escala de 8 degraus (acima)** — colapso máximo; 6 pares migram com Δ=5pp.
  Mais limpo, risco visual baixo-mas-não-nulo nesses 6 pares.
- **(B) Escala de 10 degraus** — adicionar `--opacity-faint-plus = 0.20`,
  `--opacity-divider-soft = 0.50`, `--opacity-strong-soft = 0.70` para absorver
  `/20`,`/50`,`/70` com Δ=0, e mapear `/30→0.30 (novo --opacity-wash = 0.30)`,
  `/40→0.40`, `/60→0.60`. **Δ máximo = 0pp em todos os 16** (cada ad-hoc vira um
  canônico exato; ainda colapsa `/15↔/18`→0.16, `/75↔/80`→ manter 0.75/0.80?).

**Recomendação do Refinador:** **estratégia (A), 8 degraus**, **exceto** os 5 valores
de Δ=5pp que recaem sobre **bordas/divisores de tabela e card de alta frequência**
(`/70` 17×, `/65` 9×) — para esses, a aparência atual é a referência visual de produção
das ~45 telas; recomendo **degrau-âncora = valor mais frequente** (já é o caso: `/35`,
`/70`→`0.65` é o único de alta frequência com Δ=5pp e deve ser **revisado lado-a-lado no
smoke visual** antes do commit). Se o smoke acusar diferença, cair para **(B)** só nos
degraus reprovados. **A decisão final entre (A) e (B) é ponto de aprovação do usuário**
(ver §6, Risco R1).

### 2.3 Bloco `@theme` proposto (diff conceitual — NÃO aplicar nesta etapa)

> Inserção **aditiva** ao final do `@theme inline` existente
> (`globals.css`, após l.64, antes do `}` da l.65). Nenhuma linha de `:4-64` muda.
> A âncora `--space-unit` entra em `:root` (após l.68, junto de `--radius`),
> espelhando o padrão `--radius`/`--radius-*`.

```diff
  /* :root — após --radius: 0.9rem; (l.68), seguindo o padrão da âncora --radius */
+ --space-unit: 0.25rem;            /* 4px — âncora do ritmo (não usar direto; via tokens abaixo) */

  /* @theme inline — inserir após --shadow-elevated (l.64), antes de } (l.65) */
+ /* Escala de espaçamento canônica (ritmo 4/8px) — aditiva; UX-0009 consome */
+ --spacing-3xs: calc(var(--space-unit) * 1);   /*  4px */
+ --spacing-2xs: calc(var(--space-unit) * 2);   /*  8px */
+ --spacing-xs:  calc(var(--space-unit) * 3);   /* 12px */
+ --spacing-sm:  calc(var(--space-unit) * 4);   /* 16px */
+ --spacing-md:  calc(var(--space-unit) * 6);   /* 24px */
+ --spacing-lg:  calc(var(--space-unit) * 8);   /* 32px */
+ --spacing-xl:  calc(var(--space-unit) * 12);  /* 48px */
+ --spacing-2xl: calc(var(--space-unit) * 16);  /* 64px */
+
+ /* Degraus canônicos de opacidade — substituem /15 /18 /22 /30 /35 /40 /55 /65 /70 /80 ad-hoc */
+ --opacity-faint:     0.10;
+ --opacity-subtle:    0.16;
+ --opacity-soft:      0.22;
+ --opacity-muted:     0.25;
+ --opacity-border:    0.35;
+ --opacity-divider:   0.55;
+ --opacity-strong:    0.65;
+ --opacity-prominent: 0.78;
```

> **Forma de consumo (para UX-0009/Front-End, não para UX-0005):** em Tailwind 4 a
> opacidade via token usa a sintaxe `bg-success/(--opacity-subtle)` (modificador de
> opacidade lendo a variável de tema), ou utilitário arbitrário equivalente. **A
> escolha exata de sintaxe e a migração dos 108 sítios é trabalho de UX-0009**, sob a
> tabela de-para acima. UX-0005 só **define** os tokens. (`--spacing-*` já vira
> utilitário `p-md`/`gap-sm` etc. no Tailwind 4 por convenção de tema.)

---

## 3. Cobertura de estados / a11y / responsivo

**N/A — e por quê:** UX-0005 é **token/tema puro**. Não há componente, estado
(loading/empty/error), interação, foco, ARIA, breakpoint ou layout neste item — só
declarações de variáveis CSS em `globals.css`. Não há superfície de UI para cobrir
estados, teclado ou responsividade.

**Ganchos para itens vizinhos (a fronteira é deliberada):**

- **→ [[Backlog UX (RICE)|UX-0006]] (Contraste WCAG AA):** a auditoria de contraste é
  item separado. **Input registrado aqui** (pares a medir, **não** resolver):
  - `status-badge.tsx` — pares `text-[oklch(0.39_0.07_85)]` sobre `bg-warning/22`
    (l.82/81), `text-[oklch(0.34_0.05_240)]` sobre `bg-info/22` (l.96/95),
    `text-secondary-foreground` sobre `bg-secondary/70` (l.61/60), e os ~7 estados
    com paleta OKLCH inline sem token (`em_forno` l.100-106, `embalando` l.107-113,
    `em_espera` l.121-127, `rota_entrega` l.135-141, `nao_iniciado` l.72-78,
    `no_destino` l.226-232, `aguardando_cliente` l.184-190) — **medir texto/fundo**.
  - `kpi-card.tsx:34-49` (`text-[oklch(…)]` trend) e `module-card.tsx:18,21`
    (`oklch` inline) — pares de cor para UX-0006.
  - `info-hint.tsx:24-28` — `text-*/80` sobre fundo claro (legibilidade).
  - **Gate 0 D-2:** ajuste mínimo de L do OKLCH **só onde reprovar AA** é autorizado —
    **mas executado em UX-0006**, não aqui. UX-0005 não muda nenhum valor de cor.
- **→ [[Backlog UX (RICE)|UX-0009]] (Normalização shared/layout):** consome
  `--spacing-*` e `--opacity-*` e aplica a tabela de-para nos 108 sítios + canoniza a
  cor inline. UX-0005 é **pré-requisito estrito** dele.

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas devem ficar ✅):

- [ ] **Nenhum token existente removido** — `globals.css:4-131` (cor/radius/shadow/font)
      intacto, linha a linha.
- [ ] **Nenhum token existente renomeado** — `--canvas`/`--surface`/`--panel`/
      `--primary`/`--accent`/`--success`/`--warning`/`--danger`/`--info`/
      `--border`/`--border-strong`/`--ring`/família `--sidebar-*`/`--radius`/
      `--radius-*`/`--shadow-*`/`--font-*` com o mesmo nome e valor.
- [ ] **Mudança puramente aditiva** — o diff só **insere** linhas (`--space-unit`,
      `--spacing-*`, `--opacity-*`); zero linha pré-existente alterada (`git diff`
      mostra só `+`, nenhum `-` em ranges de `:4-131`).
- [ ] **Aparência percebida idêntica** — nenhum componente migrado em UX-0005
      (definição-only). Smoke visual não acusa diferença em nenhuma das ~45 telas.
- [ ] **Zero mudança de comportamento** — sem JS/TSX tocado; sem prop, evento, fetch,
      rota, `permission-modules`, engine ou cálculo alterado.
- [ ] **Sem dependência nova** — só CSS no `globals.css`; nada em `package.json`.
- [ ] **Build/lint/tsc verdes** — `npm run lint`, `npm run build` (`next build`),
      `npx tsc --noEmit`, `npm test` sem novos erros/avisos.
- [ ] **Sem regressão visual** nas telas que usam os tokens hoje (canário de tela
      não relacionada incluído no smoke das 6 personas).
- [ ] **Commit isolado revertível** — um único commit `UX-0005`; `git revert` restaura
      sem colateral (item é trivialmente reversível: só remove as linhas inseridas).
- [ ] **Tabela de-para registrada** no Changelog/autorreview para UX-0009 consumir.

---

## 5. Plano de verificação para o Front-End

Objetivo: provar que a mudança é **puramente aditiva** e **visualmente nula**.

1. **Diff aditivo (prova mecânica):**
   `git diff src/app/globals.css` → confirmar que **toda linha do hunk é `+`** e que
   nenhum range `:4-131` perdeu/alterou linha. Comando de sanidade:
   `git diff --stat` deve mostrar só `src/app/globals.css` alterado, `0` deleções
   funcionais (só inserções).
2. **Tokens antigos ainda presentes (não-regressão de tema):**
   `grep -nE -- '--(canvas|surface|panel|primary|accent|success|warning|danger|info|border|border-strong|ring|radius|shadow-(card|soft|popover|elevated)|font-(sans|heading|mono))' src/app/globals.css`
   → contagem **igual ou maior** que no baseline (só adições). Nenhum nome sumiu.
3. **Sem migração indevida no escopo de UX-0005:**
   `git diff --name-only` → **somente** `src/app/globals.css`. Nenhum arquivo de
   `src/components/**` tocado neste item (a migração dos 108 sítios é de UX-0009).
4. **Lint/build/tsc/test:**
   `npm run lint` · `npm run build` · `npx tsc --noEmit` · `npm test` — todos verdes,
   sem novo aviso. (Tailwind 4 deve resolver os novos `--spacing-*`/`--opacity-*`
   sem erro de compilação do tema.)
5. **Diff visual / smoke das 6 personas:**
   logar nas 6 personas, percorrer telas que usam os tokens hoje (qualquer tela com
   `status-badge`, `data-table`, `kpi-card`, `page-header`/`page-hero`) **+ 1 tela
   não relacionada (canário)**, **desktop e mobile**. **Resultado esperado: pixel
   idêntico ao baseline** (UX-0005 não migra nada — se algo mudar visualmente, há
   erro de implementação: parar).
6. **Runner E2E de não-regressão (âncora M6):**
   `e2e/regression.py` (versionado, ver [[e2e-playwright-setup]] na memória do
   projeto / [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|Gate 0 D-0]])
   → **0-FAIL**, 6 personas. 17-PASS entra, **17-PASS sai**. Qualquer queda = parada
   e rollback automáticos do item (regra do plano de orquestração).

> Critério de aprovação do Gate 1 para este item: passos 1-6 todos verdes **e**
> checklist §4 100% marcado no autorreview.

---

## 6. Riscos & notas de implementação (para o Front-End)

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | **Decisão (A) 8 degraus vs (B) 10 degraus** (§2.2): 6 pares migram com Δ=5pp em (A) — risco de diferença sutil em borda/divisor de tabela/card de alta frequência (`/70` 17×, `/65` 9×) | Média | Médio | **Ponto de aprovação do usuário.** Recomendação: (A); se smoke visual (passo 5) acusar diferença nos pares Δ=5pp, cair para (B) **só** nos degraus reprovados. Como UX-0005 **não migra** os sítios (só define), o risco real só se materializa em UX-0009 — UX-0005 pode adotar (B) preventivamente sem custo. |
| **R2** | Front-End migrar os 108 sítios **dentro** de UX-0005 (escopo de UX-0009) | Média | Alto | Guard-rail explícito: UX-0005 = **definir tokens em `globals.css` só**. Passo 3 da verificação reprova qualquer arquivo de `src/components/**` no diff. |
| **R3** | Front-End "aproveitar" para corrigir cor OKLCH inline / contraste (escopo UX-0006/UX-0009) | Média | Alto | Fronteira escrita (§1.2, §3): UX-0005 **não toca valor de cor**. Pares suspeitos são input do UX-0006, listados, não resolvidos. |
| **R4** | Sintaxe Tailwind 4 de opacidade-via-token (`/(--opacity-…)`) não resolver no build | Baixa | Médio | UX-0005 só **declara** os tokens (não os consome) — build não exercita a sintaxe de consumo aqui; validação real da sintaxe ocorre em UX-0009. Passo 4 garante que a **declaração** compila. |
| **R5** | Colisão de nome com utilitário Tailwind default (`--spacing-*` sobrescreve a escala numérica) | Baixa | Médio | Em Tailwind 4 `--spacing-*` no `@theme` **estende/adiciona** chaves nomeadas; a escala numérica default (`p-2`,`gap-4`) permanece. Validar no passo 4/5 que utilitários numéricos existentes não mudaram. Se houver colisão, usar prefixo de namespace (ex.: `--spacing-rhythm-md`) — decisão de implementação, sem mudar a semântica da escala. |

**Notas de implementação:**

- **Ordem de toque (plano):** UX-0005 é o **primeiro** item da Onda 1 ("tokens — base
  de tudo, zero comportamento, reversível trivial"). Implementar **antes** de qualquer
  primitivo de estado/DataTable. Commit isolado `UX-0005`.
- **Reversibilidade:** o `git revert` deste commit remove apenas as linhas inseridas —
  como nada consome os tokens em UX-0005, a reversão é garantidamente sem colateral.
- **Não introduzir** dark-mode, `@media (prefers-color-scheme)`, nem variantes de tema:
  dark mode está **fora** desta iniciativa (decisão de escopo).
- **Precedente a seguir:** modelar a escala de espaçamento **exatamente** como
  `--radius`/`--radius-*` (`globals.css:55-59,68`) — âncora em `:root`, degraus
  derivados por `calc()` no `@theme inline`. Consistência arquitetural interna.
- **Entregar a tabela de-para (§2.2)** no autorreview/Changelog — é o contrato que
  UX-0009 vai consumir para migrar os 108 sítios sem mudar aparência.

---

## 7. Autorreview (Front-End)

> Implementado por `frontend-design-senior` (skill `/frontend-design` aplicada).
> Onda 1 — primeiro item. **R1 = Estratégia (A): 8 degraus** (decisão do usuário).
> Status: **Concluído (aguardando verificação do orquestrador)** — não commitado,
> e2e/build a cargo do orquestrador.

### 7.1 Resumo do diff

- **Arquivo único:** `src/app/globals.css`. `git diff --name-only` → só este arquivo
  (o `Docs/.obsidian/workspace.json` é ruído pré-existente do editor, não tocado).
- **`git diff --stat`:** `1 file changed, 25 insertions(+)`, **0 deleções**.
  `git diff | grep '^-[^-]'` = **0** linhas removidas. Diff 100% `+`.
- **Linhas pré-existentes `:4-131` intactas** — nenhuma editada, removida ou renomeada.
  Grep de tokens canônicos: **66** linhas (baseline 65; ≥ baseline → só adição,
  nenhum nome sumiu).
- **Inserção 1** (`@theme inline`, após `--shadow-elevated`, antes do `}`):
  8 `--spacing-rhythm-*` (calc derivado da âncora) + 8 `--opacity-*`.
- **Inserção 2** (`:root`, logo após `--radius: 0.9rem;`):
  `--space-unit: 0.25rem;` — âncora do ritmo, espelhando o padrão `--radius`/`--radius-*`.
- CSS estruturalmente válido (22 `{` / 22 `}` balanceadas). Dev server :3000 vivo
  (HTTP 307 de auth-redirect → servidor recompilou o CSS sem erro de tema).

### 7.2 Decisão Risco R5 — **com namespace `rhythm`**

**Decisão: aplicado prefixo de namespace `--spacing-rhythm-*`** (autorizado pelo R5),
preservando integralmente a semântica da escala (mesmos 8 degraus, mesmos nomes
`3xs…2xl`, mesmos valores/`calc()` da §2.1).

**Racional:** em Tailwind 4, `--spacing-*` no `@theme` com chave **nomeada**
(`md`, `lg`…) **estende** o namespace de espaçamento sem sobrescrever a escala
**numérica** default (`p-2`, `gap-4` derivam da âncora numérica `--spacing`, que
**não** foi tocada). Porém os nomes nus `--spacing-md`/`--spacing-lg` gerariam
utilitários `p-md`/`gap-lg` cujo significado se confunde visualmente com a escala
numérica e poderia, em tema futuro, colidir. O prefixo `rhythm` (`p-rhythm-md`)
**elimina qualquer ambiguidade**, nomeia explicitamente o conceito de ritmo e mantém
a escala numérica default 100% inalterada — exatamente a mitigação prevista no R5.
Custo zero para o objetivo (UX-0005 só define; quem consome é UX-0009, que usará a
tabela §7.4 já com o prefixo).

### 7.3 Checklist §4 "funcionalidade preservada" — preenchido

- [x] **Nenhum token existente removido** — `globals.css:4-131` intacto (diff só `+`,
      grep de tokens 66 ≥ 65 baseline).
- [x] **Nenhum token existente renomeado** — `--canvas`/`--surface`/`--panel`/
      `--primary`/`--accent`/`--success`/`--warning`/`--danger`/`--info`/`--border`/
      `--border-strong`/`--ring`/`--sidebar-*`/`--radius`/`--radius-*`/`--shadow-*`/
      `--font-*` com mesmo nome e valor (nenhuma linha `-` no diff).
- [x] **Mudança puramente aditiva** — `git diff --stat` = `25 insertions(+)`,
      0 deleções; nenhuma linha `:4-131` alterada.
- [x] **Aparência percebida idêntica** — nenhum componente migrado (definição-only);
      `src/components/**` não tocado; tokens novos não são consumidos por ninguém ainda.
- [x] **Zero mudança de comportamento** — só CSS; nenhum JS/TSX/prop/evento/fetch/
      rota/`permission-modules`/engine/cálculo tocado.
- [x] **Sem dependência nova** — `package.json` inalterado; só CSS.
- [x] **Build/lint/tsc/test verdes** — `npm run lint` 0 errors (6 warnings
      pré-existentes, não relacionados ao diff), `npx tsc --noEmit` exit 0,
      `npm test` 110 pass / 0 fail. (`npm run build` deixado p/ Gate 1 — dev server
      :3000 ativo; CSS recompilou sem erro.)
- [x] **Sem regressão visual** — UX-0005 não migra sítios; tokens órfãos não afetam
      render. Smoke visual/canário das 6 personas a cargo do orquestrador (passo 5/6).
- [x] **Commit isolado revertível** — diff é um bloco aditivo único em `globals.css`;
      `git revert` remove só as linhas inseridas, sem colateral (nada consome os tokens).
- [x] **Tabela de-para registrada** — §7.4 abaixo + Changelog `2026-05.md`.

> **Todas as 10 caixas ✅.** (Build e smoke/e2e visual são execução do orquestrador
> no Gate 1, conforme escopo deste item — não bloqueiam o autorreview.)

### 7.4 Tabela de-para final (contrato para UX-0009)

**Tokens de espaçamento** (consumir via `p-rhythm-md`, `gap-rhythm-sm`, ou
`p-[--spacing-rhythm-md]`; **a sintaxe/aplicação é decisão do UX-0009**):

| Token | `calc()` | px | Papel |
|---|---|:--:|---|
| `--spacing-rhythm-3xs` | `var(--space-unit) * 1`  | 4px  | hairline / gap intra-ícone |
| `--spacing-rhythm-2xs` | `var(--space-unit) * 2`  | 8px  | gap rótulo/valor; chip pequeno |
| `--spacing-rhythm-xs`  | `var(--space-unit) * 3`  | 12px | padding compacto; form denso |
| `--spacing-rhythm-sm`  | `var(--space-unit) * 4`  | 16px | padding de célula/controle |
| `--spacing-rhythm-md`  | `var(--space-unit) * 6`  | 24px | padding de card/seção |
| `--spacing-rhythm-lg`  | `var(--space-unit) * 8`  | 32px | separação entre blocos |
| `--spacing-rhythm-xl`  | `var(--space-unit) * 12` | 48px | separação entre grandes seções |
| `--spacing-rhythm-2xl` | `var(--space-unit) * 16` | 64px | respiro de topo de página |

**Opacidade — de-para canônico (cópia da §2.2, R1=Estratégia A; UX-0009 aplica):**

| Ad-hoc | Ocorr. | → Token canônico | Valor | Δ (pp) |
|:--:|:--:|---|:--:|:--:|
| `/10` | 5  | `--opacity-faint`     | 0.10 | 0  |
| `/15` | 5  | `--opacity-subtle`    | 0.16 | +1 |
| `/18` | 4  | `--opacity-subtle`    | 0.16 | −2 |
| `/20` | 2  | `--opacity-soft`      | 0.22 | +2 |
| `/22` | 8  | `--opacity-soft`      | 0.22 | 0  |
| `/25` | 6  | `--opacity-muted`     | 0.25 | 0  |
| `/30` | 5  | `--opacity-border`    | 0.35 | +5 ⚠️ |
| `/35` | 21 | `--opacity-border`    | 0.35 | 0  |
| `/40` | 4  | `--opacity-border`    | 0.35 | −5 ⚠️ |
| `/50` | 2  | `--opacity-divider`   | 0.55 | +5 ⚠️ |
| `/55` | 3  | `--opacity-divider`   | 0.55 | 0  |
| `/60` | 2  | `--opacity-strong`    | 0.65 | +5 ⚠️ |
| `/65` | 9  | `--opacity-strong`    | 0.65 | 0  |
| `/70` | 17 | `--opacity-strong`    | 0.65 | −5 ⚠️ |
| `/75` | 1  | `--opacity-prominent` | 0.78 | +3 |
| `/80` | 14 | `--opacity-prominent` | 0.78 | −2 |

> ⚠️ Os 6 pares Δ=±5pp (`/30 /40 /50 /60 /70`) devem ser revisados lado-a-lado no
> smoke visual **durante UX-0009** (não em UX-0005 — aqui nada é migrado). Se o smoke
> acusar diferença perceptível, UX-0009 escala para a Estratégia B **só** nos degraus
> reprovados (R1). UX-0005 entrega os 8 degraus (A) conforme decisão do usuário.

### 7.5 Resultado de verificação (passos 1-4 do §5)

| Passo | Comando | Resultado |
|---|---|---|
| 1 — diff aditivo | `git diff src/app/globals.css` | 25 `+`, 0 `−` ✅ |
| 1 — escopo | `git diff --name-only` | só `src/app/globals.css` ✅ |
| 2 — não-regressão tema | grep tokens canônicos | 66 ≥ 65 baseline ✅ |
| 3 — sem migração indevida | `src/components/**` | não tocado ✅ |
| 4 — lint | `npm run lint` | 0 errors (6 warnings pré-existentes) ✅ |
| 4 — tsc | `npx tsc --noEmit` | exit 0 ✅ |
| 4 — test | `npm test` | 110 pass / 0 fail ✅ |
| 4 — CSS válido | chaves + dev server :3000 | 22/22 balanceado, HTTP 307 ✅ |

> Passos 5 (smoke visual 6 personas) e 6 (`e2e/regression.py` 17-PASS) + `npm run build`
> são execução do **orquestrador** no Gate 1 — fora do escopo deste autorreview por
> definição do item.
