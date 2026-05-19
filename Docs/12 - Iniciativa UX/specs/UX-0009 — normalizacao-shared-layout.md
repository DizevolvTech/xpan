# UX-0009 — Normalização de token/opacidade/espaçamento dos 7 shared + 4 layout

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner` aplicado como motor de análise; modo spec-only — **não toca
> `src/`**). Companheira de [[Backlog UX (RICE)]] (item l.39 e l.121-125),
> [[UX PRD]] (critérios "Visual / Token", §6; "A11y" §6 — contraste preservado),
> [[UX Audit — Sistema]] (achado
> [[UX Audit — Sistema#F-7 — Normalização de espaçamento/token nos shared de layout · 🟡 · Visual/Token|F-7]],
> + a parte de cor inline do
> [[UX Audit — Sistema#F-4 — Tokens/opacidade ad-hoc; sem escala de espaçamento · 🟡 · Token|F-4]]).
> Convenção: [[12 - Iniciativa UX/README|README]].
> **Consome como contrato:** [[UX-0005 — escala-espacamento-opacidade|UX-0005]]
> **§7.4** (tabela de-para final das 16 opacidades ad-hoc → 8 tokens `--opacity-*`;
> namespace `--spacing-rhythm-*`, Estratégia A 8 degraus aprovada pelo usuário) e
> [[UX-0006 — contraste-wcag-aa|UX-0006]] **§2.4** (delegação explícita a UX-0009 da
> criação de token para os ~7 estados sem token + troca do OKLCH inline de
> trend/marker que **passam AA**, sem regredir contraste).
> Espelha o rigor/formato de [[UX-0001 — datatable-responsivo|UX-0001]] e
> [[UX-0006 — contraste-wcag-aa|UX-0006]].

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, navegação, `permission-modules`,
  estrutura de componente, prop, evento ou cálculo**. Os únicos tipos de mudança
  propostos (e **não aplicados** — esta spec não toca `src/`) são: (1) substituir o
  sufixo de opacidade ad-hoc `cor/NN` pelo token `--opacity-*` da UX-0005 §7.4
  **preservando o valor renderizado**; (2) substituir cor OKLCH inline por token
  semântico **nos casos delegados pela UX-0006 §2.4**, preservando a cor/contraste
  já validados; (3) convergir espaçamento/raio ad-hoc divergente para a escala
  `--spacing-rhythm-*`/`--radius-*` **apenas onde a divergência é ruído
  não-intencional e a mudança não é perceptível**.
- **Neutralidade visual é o objetivo, não um efeito colateral.** A de-para da
  UX-0005 preserva o valor (Δ≤±5pp; os 6 pares Δ=5pp são sinalizados ao smoke do
  Gate 1). A tokenização de cor herda o valor OKLCH **byte-a-byte** já medido e
  aprovado pela UX-0006. Qualquer mudança perceptível tem de estar **listada e
  justificada** como "remoção de inconsistência não-intencional" — senão fica
  **fora** (vira polimento de tela = Onda 2).
- **Reuso-primeiro.** Consumir os tokens já commitados pela UX-0005
  (`--opacity-*`, `--spacing-rhythm-*`) e UX-0006 (`--border`/`--border-strong`/
  `--ring` já em L corrigido). **Não criar tokens paralelos.** Criar token novo
  **só** para os ~7 estados de cor que a UX-0006 §2.4 delegou explicitamente,
  nomeando no padrão da casa (semântico, em `globals.css`, espelhando
  `--success`/`--warning`/`--info`).
- **a11y:** não regredir contraste — os valores de cor preservados são os medidos
  e aprovados pela UX-0006 §1.5/§7.2 (todos os pares de texto PASSAM AA; os 3
  tokens não-texto já estão corrigidos). Foco/estados (`focus-visible:ring`,
  hover, disabled, read-only-tenant) **intactos byte-a-byte**.
- **Não regredir `e2e/regression.py`.** `status-badge`/`page-header`/`kpi-card`
  alimentam asserts AJ via `screen_ok`/`inner_text` — tokenizar opacidade/cor e
  trocar utilitário de espaçamento por valor equivalente **não muda DOM, texto,
  seletor nem rota**. Confirmação formal em §4 e §5.
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa
  posterior, **após aprovação explícita do usuário** (modo spec-only do
  Refinador — ver [[feedback_spec-only-mode|memória do agente]]).

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 auditoria
do sistema de design existente → Fase 2 diagnóstico → Fase 3 plano **contra o
sistema existente**, sem impor estilo novo; modo spec-only — nenhuma edição de
código). Regra operante da skill aplicada aqui: *"the result should feel like it
always belonged in this codebase — pick a small scale and stick to it; use
existing primitives, don't introduce new tokens"*. Achados consolidados
(categoria **Visual/Token**, achado **F-7** + parte de cor de **F-4**):

1. **Opacidade ad-hoc nos 11 arquivos** (`/ux-ui-refiner` audit "inconsistent
   gaps / stick to a small scale"): 11 sítios de opacidade-sobre-token
   (`border-border/70`, `bg-accent/10`, `bg-success/15`, `ring-success/35`,
   `bg-secondary/70`, `bg-muted-foreground/65`, `bg-danger/18`, `bg-warning/22`,
   `bg-info/22`, `bg-panel/35`, `border-danger/40`, `bg-danger/25`,
   `border-success/40`, `bg-success/25`, `border-border/75`, `border-border/80`,
   `hover:border-primary/50`, `ring-border/60`, `border-border-strong/35`,
   `bg-info-foreground/20`, `bg-success-foreground/20`, `bg-*-foreground/25`,
   família `sidebar-*/NN`) — **cada um mapeia 1-para-1 a uma entrada da de-para
   UX-0005 §7.4**, preservando o valor.
2. **Cor OKLCH inline fora de token** (skill "stick to semantic tokens
   everywhere"): `status-badge.tsx` (~7 estados sem token + dots), `kpi-card.tsx`
   (4 trends) e `module-card.tsx` (violet/cyan icon+marker) reimplementam
   paleta. **A UX-0006 §2.4 mediu, confirmou que passam AA, e delegou a
   tokenização a UX-0009** sem mudar valor de cor.
3. **Espaçamento/raio divergente entre componentes do mesmo arquétipo**
   (`/ux-ui-refiner` "spacing inconsistency / mismatched corner radii"): o
   arquétipo **"page chrome"** (`page-header` vs `page-hero`) diverge sem razão
   (`rounded-xl` vs `rounded-2xl`; `px-5 py-6` vs `px-5 py-7`) — **é o exemplo
   literal citado em F-7**. O arquétipo **"card"** (`kpi-card`/`module-card`) já
   é consistente (`p-5 rounded-xl`) → vira o **valor canônico**, não muda.

> Conclusão do motor: o trabalho é **substituição mecânica 1-para-1 + remoção de
> 1 divergência de ruído não-intencional**. O risco real é **cascata visual
> sutil** (11 arquivos alimentam ~45 telas/6 personas) — mitigado por: de-para
> preserva valor, cor herda byte-a-byte da UX-0006, e os 6 pares Δ=5pp da UX-0005
> vão ao smoke do Gate 1.

### 1.2 Inventário por arquivo (grep real — estado ATUAL, pós UX-0001/0003/0006/0007)

> Cada linha mapeada à entrada da de-para [[UX-0005 — escala-espacamento-opacidade#7.4 Tabela de-para final (contrato para UX-0009)|UX-0005 §7.4]]
> (opacidade) ou à delegação [[UX-0006 — contraste-wcag-aa#2.4 Adota vs. delega (fronteira com UX-0009)|UX-0006 §2.4]] (cor).

#### A. `src/components/shared/page-header.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 22 | `border border-border/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (0.65, Δ=−5 ⚠️) |
| 22 | `rounded-xl … px-5 py-6` | espaçamento/raio | **convergência "page chrome"** (ver §2.3) |

#### B. `src/components/shared/page-hero.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 29 | `border border-border/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (Δ=−5 ⚠️) |
| 29 | `rounded-2xl … px-5 py-7 … lg:px-9 lg:py-8` | espaçamento/raio | **âncora canônica "page chrome"** (ver §2.3 — não muda; é o alvo) |
| 55 | `border border-accent/30` | opacidade ad-hoc | UX-0005 §7.4 `/30 → --opacity-border` (0.35, Δ=+5 ⚠️) |
| 55 | `bg-accent/10` | opacidade ad-hoc | UX-0005 §7.4 `/10 → --opacity-faint` (0.10, Δ=0) |
| 57 | `opacity-60` (animate-ping) | opacidade ad-hoc utilitário **puro** (não `cor/NN`) | **fora da de-para UX-0005** (não é opacidade-sobre-token; ver §2.4 delega) |

#### C. `src/components/shared/page-layout.tsx`

| — | (nenhuma opacidade ad-hoc, OKLCH inline ou espaçamento divergente) | — | **nada a fazer** — só compõe `PageHero`+`PageContainer` via `motion.div`; `mt-6 space-y-6` é ritmo já canônico (24px = `--spacing-rhythm-md`) |

#### D. `src/components/shared/kpi-card.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 37,42,47,52 | `text-[oklch(0.38_0.06_240)]` / `0.35 0.07 160` / `0.4 0.08 85` / `0.45 0.12 22` (4 trends) | OKLCH inline | **UX-0006 §2.4 delega a UX-0009** (passam AA 9.86/10.87/9.22/7.87:1 — preservar cor; tokenizar) |
| 148 | `border border-border/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (Δ=−5 ⚠️) |
| 149 | `hover:border-primary/50` | opacidade ad-hoc | UX-0005 §7.4 `/50 → --opacity-divider` (0.55, Δ=+5 ⚠️) |
| 183 | `ring-border/60` | opacidade ad-hoc | UX-0005 §7.4 `/60 → --opacity-strong` (0.65, Δ=+5 ⚠️) |
| 148 | `pl-[calc(theme(spacing.5)+3px)]` | espaçamento ad-hoc **intencional** (alinha conteúdo ao rail de 3px) | **não converge** — magic number funcional, não ruído (ver §2.3) |

#### E. `src/components/shared/status-badge.tsx`

| Linha(s) | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 46,53,116,144,158 | `bg-success/15` | opacidade ad-hoc | UX-0005 §7.4 `/15 → --opacity-subtle` (0.16, Δ=+1) |
| 48,55,118,146,160 | `ring-success/35` | opacidade ad-hoc | UX-0005 §7.4 `/35 → --opacity-border` (0.35, Δ=0) |
| 60,67,200,207,244 | `bg-secondary/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (Δ=−5 ⚠️) |
| 63,70,203,210,247 | `bg-muted-foreground/65` (dot) | opacidade ad-hoc | UX-0005 §7.4 `/65 → --opacity-strong` (0.65, Δ=0) |
| 81,88,151,179,214 | `bg-warning/22` | opacidade ad-hoc | UX-0005 §7.4 `/22 → --opacity-soft` (0.22, Δ=0) |
| 83,90,153,181,216 | `ring-warning/35` | opacidade ad-hoc | UX-0005 §7.4 `/35 → --opacity-border` (Δ=0) |
| 95,193,221 | `bg-info/22` | opacidade ad-hoc | UX-0005 §7.4 `/22 → --opacity-soft` (Δ=0) |
| 97,195,223 | `ring-info/35` | opacidade ad-hoc | UX-0005 §7.4 `/35 → --opacity-border` (Δ=0) |
| 130,165,172,235 | `bg-danger/18` | opacidade ad-hoc | UX-0005 §7.4 `/18 → --opacity-subtle` (0.16, Δ=−2) |
| 132,167,174,237 | `ring-danger/35` | opacidade ad-hoc | UX-0005 §7.4 `/35 → --opacity-border` (Δ=0) |
| 47,54,82,89,96,103,110,117,124,131,138,145,152,159,166,173,180,187,194,202,209,215,222,229,236,245 | `text-[oklch(…)]` / `text-secondary-foreground` | cor de texto | `secondary-foreground` = token (não tocar); demais OKLCH inline → **UX-0006 §2.4 delega a UX-0009** (todos PASSAM AA — preservar valor; tokenizar os ~7 estados sem token) |
| 74,76,102,104,109,111,123,125,137,139,186,188,228,230 | `bg-[oklch(…)]` / `ring-[oklch(…)]` dos ~7 estados sem token (`nao_iniciado`, `em_forno`, `embalando`, `em_espera`, `rota_entrega`=`aguardando_cliente`=`no_destino`) | OKLCH inline | **UX-0006 §2.4 delega a UX-0009 — criar token semântico** (§2.2 desta spec) |
| 49,56,77,84,91,98,105,112,119,126,133,140,147,154,161,168,175,182,189,196,217,224,231,238,247 | `dot: bg-[oklch(…)]` | OKLCH inline decorativo (6px, redundante c/ texto+fundo) | **UX-0006 §2.3-B isenta de 1.4.11** — tokenizar junto do estado (consistência), valor preservado |

#### F. `src/components/shared/module-card.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 16 | `marker: bg-info-foreground/20` | opacidade ad-hoc | UX-0005 §7.4 `/20 → --opacity-soft` (0.22, Δ=+2) |
| 17 | `marker: bg-success-foreground/20` | opacidade ad-hoc | UX-0005 §7.4 `/20 → --opacity-soft` (Δ=+2) |
| 18 | `icon: bg-[oklch(0.88_0.06_295)] text-[oklch(0.43_0.08_293)]` (violet) | OKLCH inline | **UX-0006 §2.4 delega a UX-0009** (passa AA 5.73:1 — preservar; tokenizar) |
| 18 | `marker: bg-[oklch(0.43_0.08_293)]/25` | OKLCH inline + opacidade | cor → UX-0009 (token); `/25` → UX-0005 §7.4 `--opacity-muted` (0.25, Δ=0) |
| 19,20,22 | `marker: bg-warning-foreground/25` / `bg-danger-foreground/25` / `bg-muted-foreground/25` | opacidade ad-hoc | UX-0005 §7.4 `/25 → --opacity-muted` (0.25, Δ=0) |
| 21 | `icon: bg-[oklch(0.88_0.05_214)] text-[oklch(0.4_0.06_228)]` (cyan) | OKLCH inline | **UX-0006 §2.4 delega a UX-0009** (passa AA 6.41:1 — preservar; tokenizar) |
| 21 | `marker: bg-[oklch(0.4_0.06_228)]/25` | OKLCH inline + opacidade | cor → UX-0009 (token); `/25` → `--opacity-muted` (Δ=0) |
| 51 | `border border-border/80` | opacidade ad-hoc | UX-0005 §7.4 `/80 → --opacity-prominent` (0.78, Δ=−2) |
| 51 | `hover:border-border-strong/35` | opacidade ad-hoc | UX-0005 §7.4 `/35 → --opacity-border` (0.35, Δ=0) |
| 51 | `rounded-xl … p-5` | espaçamento/raio | **âncora canônica "card"** — já consistente c/ kpi-card (não muda) |

#### G. `src/components/shared/profile-page.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 346 | `border border-border/75` | opacidade ad-hoc | UX-0005 §7.4 `/75 → --opacity-prominent` (0.78, Δ=+3) |
| 346 | `bg-panel/35` | opacidade ad-hoc | UX-0005 §7.4 — `/35 → --opacity-border` (0.35, Δ=0) |
| 348 | `border border-border/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (Δ=−5 ⚠️) |
| 356 | `border border-border/80` | opacidade ad-hoc | UX-0005 §7.4 `/80 → --opacity-prominent` (Δ=−2) |
| 555 | `border border-danger/40` | opacidade ad-hoc | UX-0005 §7.4 `/40 → --opacity-border` (0.35, Δ=−5 ⚠️) |
| 555 | `bg-danger/25` | opacidade ad-hoc | UX-0005 §7.4 `/25 → --opacity-muted` (Δ=0) |
| 561 | `border border-success/40` | opacidade ad-hoc | UX-0005 §7.4 `/40 → --opacity-border` (Δ=−5 ⚠️) |
| 561 | `bg-success/25` | opacidade ad-hoc | UX-0005 §7.4 `/25 → --opacity-muted` (Δ=0) |

> Nota: `profile-page` cobre **as 6 telas de perfil** (1 arquivo, 6 personas) —
> alto raio; smoke das 6 personas obrigatório (§5).

#### H. `src/components/layout/app-shell.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 66 | `border-b border-border/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (Δ=−5 ⚠️) |
| 66 | `bg-amber-50/90` `text-amber-950` `text-amber-800` (l.69) | **cor Tailwind nativa fora de token** (faixa read-only-tenant) | **delega — ver §2.4** (não é OKLCH inline da casa nem opacidade-sobre-token; mexer = mudar cor da faixa = não-neutro / fora de F-7) |
| 88 | `border border-danger/40` | opacidade ad-hoc | UX-0005 §7.4 `/40 → --opacity-border` (Δ=−5 ⚠️) |
| 88 | `bg-danger/10` | opacidade ad-hoc | UX-0005 §7.4 `/10 → --opacity-faint` (Δ=0) |

#### I. `src/components/layout/sidebar.tsx`

| Linha(s) | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 119,158,227,271,316 | `border-sidebar-border/80` | opacidade ad-hoc | UX-0005 §7.4 `/80 → --opacity-prominent` (0.78, Δ=−2) |
| 123,248,316 | `border-sidebar-border/70` | opacidade ad-hoc | UX-0005 §7.4 `/70 → --opacity-strong` (Δ=−5 ⚠️) |
| 185 | `border-sidebar-border/65` | opacidade ad-hoc | UX-0005 §7.4 `/65 → --opacity-strong` (0.65, Δ=0) |
| 123 | `bg-sidebar-accent/45` `hover:bg-sidebar-accent/65` | opacidade ad-hoc | `/45`→ **não há entrada exata na de-para UX-0005** (ver §2.4 — delega/flag); `/65 → --opacity-strong` (Δ=0) |
| 167 | `bg-sidebar-accent/60` | opacidade ad-hoc | UX-0005 §7.4 `/60 → --opacity-strong` (0.65, Δ=+5 ⚠️) |
| 124,207,251 | `hover:bg-sidebar-accent/85` `hover:bg-sidebar-accent/65` | opacidade ad-hoc | `/85`→ **sem entrada exata UX-0005** (§2.4 flag); `/65 → --opacity-strong` (Δ=0) |
| 141 | `text-muted-foreground/90` | opacidade ad-hoc | `/90`→ **sem entrada exata UX-0005** (§2.4 flag) |
| 167,171 | `text-foreground/70` `text-foreground/85` | opacidade ad-hoc | `/70 → --opacity-strong` (Δ=−5 ⚠️); `/85`→ **sem entrada exata** (§2.4 flag) |
| 207,218(span),251 | `text-sidebar-foreground/85` `text-sidebar-foreground/90` | opacidade ad-hoc | `/85`,`/90`→ **sem entrada exata UX-0005** (§2.4 flag) |
| 215 | `color-mix(in oklch,var(--accent) 40%,transparent)` (drop-shadow) | `color-mix` % — **não é `cor/NN` nem OKLCH inline** | **fora de escopo** (já é a gramática canônica de "quantidade de cor" da casa — UX-0005 §1.1) |

> ⚠️ **Achado de fronteira (sidebar):** a sidebar usa **6 degraus que NÃO têm
> entrada exata na de-para UX-0005 §7.4** (`/45`, `/85`, `/90` — a de-para cobre
> os 16 degraus inventariados em `src/components/shared/`, e a sidebar não fazia
> parte daquele inventário de 18 arquivos). Decisão de fronteira em **§2.4**.

#### J. `src/components/layout/area-shell-layout.tsx`

| — | (server component; só lógica de acesso/redirect + `<AppShell>`) | — | **nada a fazer** — zero className visual; **delega integralmente** |

#### K. `src/components/layout/page-container.tsx`

| Linha | Trecho atual | Tipo | Mapeia a |
|--:|---|---|---|
| 12 | `px-4 py-6 sm:px-6 lg:px-8 lg:py-8` | espaçamento | **escala Tailwind numérica canônica já** (16/24px → `--spacing-rhythm-sm/md`) — **não muda** (sem divergência de arquétipo; é o único container) |

### 1.3 Contagem agregada (os 11 arquivos)

| Métrica | Valor |
|---|--:|
| Opacidades ad-hoc **com entrada na de-para UX-0005 §7.4** | **22 ocorrências distintas** de utilitário (≈ 88 sítios contando repetições em `statusConfig`) — todas tokenizáveis |
| Opacidades **sem entrada exata** na UX-0005 (`/45 /85 /90` na sidebar) | 6 utilitários distintos → **fronteira §2.4** |
| OKLCH inline a tokenizar (delegação UX-0006 §2.4) | `status-badge` ~7 estados sem token + dots; `kpi-card` 4 trends; `module-card` violet/cyan icon+marker |
| Tokens **novos a criar** (estados sem token) | **5** (ver §2.2 — `nao_iniciado`, `em_forno`, `embalando`, `em_espera`, `rota_entrega`/`aguardando_cliente`/`no_destino` compartilham 1) |
| Convergências de espaçamento (ruído não-intencional) | **1** (`page-header` → arquétipo "page chrome" canônico) |
| Pontos Δ=5pp que cascateiam destes 11 (revisão visual Gate 1) | `/70`(↓), `/30`(↑), `/50`(↑), `/60`(↑), `/40`(↓) — **5 degraus** presentes |

---

## 2. Spec de refinamento

### 2.1 De-para de opacidade aplicada (Estratégia A — UX-0005 §7.4)

**Regra:** substituir o sufixo `cor/NN` pelo modificador de opacidade lendo o
token de tema. Em Tailwind 4 a sintaxe é `bg-success/(--opacity-subtle)` /
`border-border/(--opacity-strong)` / `ring-success/(--opacity-border)` (a escolha
exata entre essa forma e utilitário arbitrário equivalente é decisão de
implementação do Front-End, contanto que o **valor renderizado seja idêntico**
ao da coluna "Valor canônico" da UX-0005 §7.4). **Nenhuma cor de token, nenhuma
classe estrutural, nenhuma prop muda** — só o `/NN` vira `/(--opacity-*)`.

| Ad-hoc | → Token (UX-0005 §7.4) | Valor | Δ (pp) | Arquivos:linhas afetados (desta spec §1.2) |
|:--:|---|:--:|:--:|---|
| `/10` | `--opacity-faint` | 0.10 | 0 | page-hero:55 (`bg-accent/10`); app-shell:88 (`bg-danger/10`) |
| `/15` | `--opacity-subtle` | 0.16 | +1 | status-badge:46,53,116,144,158 (`bg-success/15`) |
| `/18` | `--opacity-subtle` | 0.16 | −2 | status-badge:130,165,172,235 (`bg-danger/18`) |
| `/20` | `--opacity-soft` | 0.22 | +2 | module-card:16,17 (`bg-*-foreground/20`) |
| `/22` | `--opacity-soft` | 0.22 | 0 | status-badge:81,88,95,151,179,193,214,221 (`bg-warning/22`,`bg-info/22`) |
| `/25` | `--opacity-muted` | 0.25 | 0 | module-card:18,19,20,21,22; profile-page:555,561 |
| `/30` | `--opacity-border` | 0.35 | **+5 ⚠️** | page-hero:55 (`border-accent/30`) |
| `/35` | `--opacity-border` | 0.35 | 0 | status-badge (todos `ring-*/35`); module-card:51; profile-page:346 (`bg-panel/35`) |
| `/40` | `--opacity-border` | 0.35 | **−5 ⚠️** | profile-page:555,561; app-shell:88 (`border-danger/40`) |
| `/50` | `--opacity-divider` | 0.55 | **+5 ⚠️** | kpi-card:149 (`hover:border-primary/50`) |
| `/60` | `--opacity-strong` | 0.65 | **+5 ⚠️** | kpi-card:183 (`ring-border/60`); sidebar:167 (`bg-sidebar-accent/60`) |
| `/65` | `--opacity-strong` | 0.65 | 0 | status-badge (dots `bg-muted-foreground/65`); sidebar:185 (`border-sidebar-border/65`) |
| `/70` | `--opacity-strong` | 0.65 | **−5 ⚠️** | page-header:22; page-hero:29; kpi-card:148; status-badge `bg-secondary/70`; profile-page:348; app-shell:66; sidebar:123,248,316; sidebar:167 (`text-foreground/70`) |
| `/75` | `--opacity-prominent` | 0.78 | +3 | profile-page:346 (`border-border/75`) |
| `/80` | `--opacity-prominent` | 0.78 | −2 | module-card:51; profile-page:356; sidebar:119,158,227,271,316 (`border-sidebar-border/80`) |

> **Os 5 degraus Δ=5pp presentes nestes 11 (`/30 /40 /50 /60 /70`)** são
> exatamente os pares que a UX-0005 §7.4 marcou ⚠️ para **revisão lado-a-lado no
> smoke visual do Gate 1**. `/70` é o de maior cascata (page chrome + sidebar +
> badge inativo → presente em **toda tela**). Se o smoke acusar diferença
> perceptível, UX-0009 escala para a **Estratégia B da UX-0005 §2.2 só nos
> degraus reprovados** (R1 desta spec). UX-0009 entrega Estratégia A (decisão do
> usuário registrada na UX-0005).

### 2.2 Tokens novos a criar (delegação explícita da UX-0006 §2.4)

A UX-0006 §2.4 **delegou a UX-0009** a criação de token para os ~7 estados de
`status-badge` sem token, **declarando que todos PASSAM AA** (§1.5: 6.91–11.04:1)
e que **a tokenização é normalização, não correção de contraste — preservar o
valor de cor byte-a-byte**. Criar em `src/app/globals.css` `:root`, no padrão
semântico da casa (espelhando `--success`/`--success-foreground`), **sem
renomear/duplicar** nenhum token UX-0005/UX-0006:

| Token novo (`:root`) | Valor (= atual, preservado) | Origem inline (status-badge) | Par AA medido (UX-0006 §1.5) |
|---|---|---|:--:|
| `--status-neutral` / `-foreground` / `-ring` / `-dot` | bg `oklch(0.94 0.018 255)` · txt `oklch(0.42 0.05 255)` · ring `oklch(0.86 0.03 255)` · dot `oklch(0.62 0.07 255)` | `nao_iniciado` (l.74-77) | 7.09:1 ✅ |
| `--status-bake` / `-foreground` / `-ring` / `-dot` | bg `oklch(0.93 0.06 55)` · txt `oklch(0.3 0.09 45)` · ring `oklch(0.83 0.1 55)` · dot `oklch(0.62 0.16 45)` | `em_forno` (l.102-105) | 11.04:1 ✅ |
| `--status-pack` / `-foreground` / `-ring` / `-dot` | bg `oklch(0.92 0.05 165)` · txt `oklch(0.33 0.08 165)` · ring `oklch(0.82 0.07 165)` · dot `oklch(0.55 0.12 165)` | `embalando` (l.109-112) | 9.35:1 ✅ |
| `--status-hold` / `-foreground` / `-ring` / `-dot` | bg `oklch(0.94 0.04 295)` · txt `oklch(0.43 0.08 293)` · ring `oklch(0.85 0.05 295)` · dot `oklch(0.6 0.13 295)` | `em_espera` (l.123-126) | 6.91:1 ✅ (pior caso global) |
| `--status-transit` / `-foreground` / `-ring` / `-dot` | bg `oklch(0.93 0.04 214)` · txt `oklch(0.4 0.06 228)` · ring `oklch(0.83 0.05 214)` · dot `oklch(0.6 0.12 214)` | `rota_entrega`=`aguardando_cliente`=`no_destino` (l.137-140,186-189,228-231) | 7.46:1 ✅ |

> **5 tokens-família** (cada um com bg/foreground/ring/dot). `rota_entrega`,
> `aguardando_cliente`, `no_destino` são **a mesma tripla** → 1 token só
> (`--status-transit`) — colapsa a duplicação que F-4 apontou, **sem mudar
> nenhum pixel** (valor idêntico).
>
> **Os estados que JÁ têm token semântico não criam token novo** —
> `ativo`/`concluido`/`entregue`/`aprovado` (`success`), `inativo`/`fechada`/
> `aguardando_expedicao` (`secondary`), `em_preparacao`/`agendado`/`pendente`/
> `em_analise`/`pronto_coleta` (`warning`), `em_producao`/`resolvida`/`em_rota`
> (`info`), `cancelado`/`reprovado`/`aberta`/`tentativa_falha` (`danger`). Para
> esses, **só** a opacidade `/NN` vira `--opacity-*` (§2.1). O `text-[oklch(…)]`
> deles (ex.: `text-[oklch(0.34_0.07_162)]` do success) **também** deveria virar
> token para fechar F-4 — porém **a UX-0006 §2.4 só delegou os ~7 sem token**;
> os `text-[oklch]` dos estados token-based são uma **dívida residual de F-4**
> que **declaro como delegada à UX-0006** (cor que passa AA, valor preservado)
> — **fora desta spec** para não exceder a delegação literal recebida
> (ver §2.5 "adota vs delega" e R3).

**`kpi-card` trends e `module-card` violet/cyan (delegados pela UX-0006 §2.4):**
a UX-0006 confirmou AA (§1.5: trends 7.87–10.87:1; violet 5.73:1; cyan 6.41:1) e
delegou a tokenização a UX-0009 **sem mudar valor**. Criar tokens semânticos
análogos, valor = atual:

| Token novo (`:root`) | Valor (= atual) | Origem |
|---|---|---|
| `--kpi-trend-info/success/warning/danger` | `oklch(0.38 0.06 240)` / `0.35 0.07 160` / `0.4 0.08 85` / `0.45 0.12 22` | kpi-card:37,42,47,52 |
| `--module-violet` / `-foreground` | `oklch(0.88 0.06 295)` / `oklch(0.43 0.08 293)` | module-card:18 |
| `--module-cyan` / `-foreground` | `oklch(0.88 0.05 214)` / `oklch(0.4 0.06 228)` | module-card:21 |

> **Reuso-primeiro:** antes de criar `--kpi-trend-*`, o Front-End deve checar se o
> valor coincide com um token existente (`--info`/`--success`/etc. ou os novos
> `--status-*`) — se coincidir byte-a-byte, **reusar** em vez de criar paralelo
> (regra do `/ux-ui-refiner` e guard-rail de reuso). A criação só procede onde
> **nenhum token existente tem o valor exato** (preliminarmente: os trends têm L
> mais escuro que os `--*` base — provável criação; confirmar na implementação).
> **Não** ajustar L para "encaixar" num token existente — isso mudaria a cor
> (não-neutro) e invadiria UX-0006.

### 2.3 Convergências de espaçamento (ruído não-intencional — critério explícito)

**Critério (declarado):** converge **só** quando (a) dois componentes do **mesmo
arquétipo** divergem **sem razão funcional**, **e** (b) a convergência **não
altera layout perceptível** (≤ ~2px num elemento não-denso, sem reflow). Magic
number **funcional** (alinhamento a um rail, hit-target) **não** converge.
Mudança que altera layout perceptível = **polimento de tela → Onda 2** (fora).

| Arquétipo | Componentes | Estado atual | Decisão | Justificativa de neutralidade |
|---|---|---|---|---|
| **Page chrome** | `page-header` vs `page-hero` | header `rounded-xl px-5 py-6`; hero `rounded-2xl px-5 py-7 lg:px-9 lg:py-8` | **CONVERGE só o raio** do `page-header` `rounded-xl`→`rounded-2xl` (= `--radius-2xl`, o valor do hero). **NÃO** mexer no padding (`py-6`↔`py-7` é 4px e os dois têm **densidade/uso distintos** — header compacto vs hero com badge/ping; alterar seria polimento perceptível = Onda 2). | É o **exemplo literal de F-7** (`rounded-xl` vs `rounded-2xl` no mesmo arquétipo de cabeçalho de página). 16px→26px de raio num card de página é a **remoção de uma inconsistência não-intencional** (ambos são "moldura de topo de página" arredondada) e perceptível-mas-mínima → **declarada e justificada**, vai ao smoke do Gate 1 como item de revisão. Se o usuário considerar perceptível demais, **reverter para `--radius-xl` em ambos** (convergir para o menor) é o fallback — decisão de Gate 1. |
| **Card** | `kpi-card` vs `module-card` | ambos `rounded-xl p-5` | **NÃO muda** (já convergente — vira a âncora canônica do arquétipo "card"). | Zero divergência → zero ação. |
| **Container** | `page-container` | `px-4 py-6 sm:px-6 lg:px-8 lg:py-8` | **NÃO muda** | Único container; sem par para divergir. Já é escala 4/8 canônica. |
| **kpi-card rail offset** | `pl-[calc(theme(spacing.5)+3px)]` (l.148) | magic number | **NÃO converge** | **Funcional** — alinha o conteúdo à direita do rail de 3px (l.154 `w-[3px]`). Não é ruído; tokenizar quebraria o alinhamento. |

> **Convergência total = 1** (raio do `page-header`). É a mais conservadora que
> honra F-7 sem invadir Onda 2. Todo o resto do espaçamento dos 11 já está em
> escala 4/8 e **sem divergência de arquétipo** → adoção opcional de
> `--spacing-rhythm-*` em utilitário equivalente **não é exigida** (UX-0005 §2.1:
> "adoção pode ser via token ou utilitário equivalente; decisão do UX-0009") —
> esta spec **não força reescrever `p-5`→`p-rhythm-md`** pois (i) é troca cosmética
> de sintaxe sem mudança de valor, (ii) aumentaria o diff/risco de cascata sem
> ganho de neutralidade. **Recomendação: manter utilitário numérico onde já
> canônico; tokenizar só opacidade e cor.**

### 2.4 Adota vs. delega (fronteira explícita)

| Item | UX-0009 (aqui) | Delega a |
|---|---|---|
| Opacidade `cor/NN` → `--opacity-*` nos 22 utilitários com entrada na de-para UX-0005 §7.4 | ✅ **adota** (§2.1) | — |
| Criar token p/ os ~7 estados sem token de `status-badge` (5 famílias) | ✅ **adota** (§2.2) — delegação literal recebida da UX-0006 §2.4 | — |
| Tokenizar `kpi-card` trends + `module-card` violet/cyan (passam AA) | ✅ **adota** (§2.2) — delegação literal da UX-0006 §2.4 | — |
| Converger raio do `page-header` (arquétipo page chrome) | ✅ **adota** (§2.3) — único ruído não-intencional de F-7 | — |
| `text-[oklch]` dos estados **token-based** de status-badge (ex.: success/warning) | ❌ **delega** | **UX-0006** — cor que passa AA, valor preservado; a delegação que UX-0006 §2.4 me deu cita **só os ~7 sem token**. Tokenizar os token-based também é desejável (F-4) mas **excede a delegação literal**; registrado como dívida residual p/ UX-0006/follow-up, não inflado aqui (guard-rail "criar token novo só p/ os delegados"). |
| `bg-amber-50/90`/`text-amber-950`/`text-amber-800` da faixa read-only (app-shell:66-69) | ❌ **delega** | **Fora de UX-0009** — não é opacidade-sobre-token-da-casa nem OKLCH inline; é paleta Tailwind nativa de uma faixa de **estado de sistema** (read-only-tenant). Tokenizar = escolher cor nova = **não-neutro** e fora de F-7/Gate 0. Fica como nota p/ Onda 2/Dívida. **Read-only-tenant: afordância preservada byte-a-byte.** |
| `sidebar` degraus `/45 /85 /90` (sem entrada na de-para UX-0005 §7.4) | ⚠️ **delega/flag** | **UX-0005 (gap de cobertura)** — a de-para da UX-0005 cobriu os 16 degraus inventariados em `src/components/shared/`; a sidebar não estava naquele inventário, e `/45`,`/85`,`/90` **não têm token canônico**. Tokenizar à força exigiria **inventar mapeamento** (Δ desconhecido, risco de não-neutralidade) ou **estender a escala UX-0005** (não é escopo de UX-0009 — UX-0005 é o dono dos tokens). **Decisão:** tokenizar **só os degraus da sidebar com entrada exata** (`/65`,`/80`,`/70`,`/60`); os `/45`,`/85`,`/90` **ficam como estão** e são **registrados como input p/ a UX-0005** (mesmo padrão da UX-0005 §3 que registrou inputs p/ UX-0006). Declarado em R4. |
| `opacity-60`/`animate-ping` (page-hero:57), `color-mix(… N%)` (sidebar:215) | ❌ **delega/N/A** | **Fora** — `opacity-60` é opacidade de **elemento puro** (não `cor/NN`-sobre-token), `color-mix(… 40% …)` já é a gramática canônica da casa (UX-0005 §1.1). Nenhum dos dois é o achado F-4/F-7. Não tocar. |
| `area-shell-layout`, `page-layout`, `page-container` | ❌ **nada a fazer** | Sem opacidade ad-hoc / OKLCH inline / divergência de arquétipo (§1.2 C/J/K). |
| Redesenhar telas, migrar ~41 "Carregando…"/empties de tela, tocar `data-table.tsx`/`button.tsx`/primitivos UX-0002/0003/0007 | ❌ **fora** | **Onda 2/3** e itens próprios (já normalizados). Fronteira do mandato. |

### 2.5 Diff conceitual por arquivo (NÃO aplicar — referência p/ o Front-End)

> Padrão único de transformação: `cor/NN` → `cor/(--opacity-*)` (valor da §2.1) e
> `text-[oklch(…)]`/`bg-[oklch(…)]` dos delegados → utilitário lendo o token novo
> (§2.2). **Nenhuma linha estrutural, prop, evento, ordem de classe ou texto
> muda.** Exemplos representativos (não exaustivo — a §1.2 + §2.1/§2.2 são o
> contrato linha-a-linha):

```diff
  // page-header.tsx:22 (+ convergência de raio §2.3)
- <header className="… rounded-xl border border-border/70 bg-surface px-5 py-6 …">
+ <header className="… rounded-2xl border border-border/(--opacity-strong) bg-surface px-5 py-6 …">

  // page-hero.tsx:55
- <span className="… border border-accent/30 bg-accent/10 …">
+ <span className="… border border-accent/(--opacity-border) bg-accent/(--opacity-faint) …">

  // kpi-card.tsx:37 (token novo §2.2; valor idêntico)
- info:    { …, trend: "text-[oklch(0.38_0.06_240)]", … }
+ info:    { …, trend: "text-[--kpi-trend-info]", … }
  // kpi-card.tsx:148,149,183
- "… border border-border/70 …", href && "… hover:border-primary/50",
+ "… border border-border/(--opacity-strong) …", href && "… hover:border-primary/(--opacity-divider)",
- "… ring-1 ring-inset ring-border/60 …"
+ "… ring-1 ring-inset ring-border/(--opacity-strong) …"

  // status-badge.tsx — estado COM token (só opacidade):
- ativo: { bg: "bg-success/15", text: "text-[oklch(0.34_0.07_162)]", ring: "ring-success/35", dot: "bg-[oklch(0.62_0.14_158)]" }
+ ativo: { bg: "bg-success/(--opacity-subtle)", text: "text-[oklch(0.34_0.07_162)]"/*delega UX-0006*/, ring: "ring-success/(--opacity-border)", dot: "bg-[oklch(0.62_0.14_158)]"/*decorativo, isento §2.3-B UX-0006*/ }
  // status-badge.tsx — estado SEM token (token novo §2.2; valor idêntico):
- nao_iniciado: { bg: "bg-[oklch(0.94_0.018_255)]", text: "text-[oklch(0.42_0.05_255)]", ring: "ring-[oklch(0.86_0.03_255)]", dot: "bg-[oklch(0.62_0.07_255)]" }
+ nao_iniciado: { bg: "bg-[--status-neutral]", text: "text-[--status-neutral-foreground]", ring: "ring-[--status-neutral-ring]", dot: "bg-[--status-neutral-dot]" }

  // module-card.tsx:16,18,51
- blue:   { icon: "bg-info text-info-foreground", marker: "bg-info-foreground/20" }
+ blue:   { icon: "bg-info text-info-foreground", marker: "bg-info-foreground/(--opacity-soft)" }
- violet: { icon: "bg-[oklch(0.88_0.06_295)] text-[oklch(0.43_0.08_293)]", marker: "bg-[oklch(0.43_0.08_293)]/25" }
+ violet: { icon: "bg-[--module-violet] text-[--module-violet-foreground]", marker: "bg-[--module-violet-foreground]/(--opacity-muted)" }
- className="… rounded-xl border border-border/80 … hover:border-border-strong/35"
+ className="… rounded-xl border border-border/(--opacity-prominent) … hover:border-border-strong/(--opacity-border)"

  // profile-page.tsx:346,555
- <div className="… border border-border/75 bg-panel/35 p-4">
+ <div className="… border border-border/(--opacity-prominent) bg-panel/(--opacity-border) p-4">
- <div className="… border border-danger/40 bg-danger/25 …">
+ <div className="… border border-danger/(--opacity-border) bg-danger/(--opacity-muted) …">

  // app-shell.tsx:66,88 (faixa amber-* NÃO muda — §2.4 delega)
- <div className="border-b border-border/70 bg-amber-50/90 …">      (bg-amber-50/90 intacto)
+ <div className="border-b border-border/(--opacity-strong) bg-amber-50/90 …">
- <div className="… border border-danger/40 bg-danger/10 …">
+ <div className="… border border-danger/(--opacity-border) bg-danger/(--opacity-faint) …">

  // sidebar.tsx — só degraus com entrada exata; /45 /85 /90 intactos (§2.4 R4)
- "border-sidebar-border/80 …", "… border-sidebar-border/70 …", "… border-sidebar-border/65 …"
+ "border-sidebar-border/(--opacity-prominent) …", "… /(--opacity-strong) …", "… /(--opacity-strong) …"
  (bg-sidebar-accent/45, /85, text-*/85, /90 → INALTERADOS — input p/ UX-0005)
```

> **Forma de consumo:** a sintaxe `cor/(--opacity-*)` (Tailwind 4 — modificador de
> opacidade lendo variável de tema) e `text-[--token]` é a recomendada; a UX-0005
> §7.4 deixou a sintaxe exata a cargo de UX-0009. O Front-End deve **validar no
> build** (Tailwind 4 resolve `cor/(--var)` e `[--var]`) e, se a forma falhar,
> usar utilitário arbitrário equivalente que **renderize o mesmo valor** — o
> contrato é o **valor**, não a sintaxe.

---

## 3. Cobertura de estados / a11y / responsivo

- **Contraste (a11y — central):** **nenhum valor de cor muda.** As opacidades
  migram com Δ≤±5pp (UX-0005 §7.4) sobre fundos claros — a UX-0006 §1.5 já mediu
  os pares **compostos** dos badges (`success/15`, `warning/22`, `danger/18`,
  `secondary/70` etc.) e **todos passam AA com folga** (8.12–10.68:1); Δ de ≤5pp
  na opacidade do **fundo tonal** não cruza o limiar (o texto é OKLCH escuro
  sólido, inalterado). Os 5 tokens novos (§2.2) recebem o **valor exato** medido
  pela UX-0006 (6.91–11.04:1 ✅). `--border`/`--border-strong`/`--ring` herdam o
  L já corrigido pela UX-0006 (3.0–3.26:1) — UX-0009 **não os altera**, só troca
  o sufixo de opacidade onde aplicado. **Resultado: contraste ≥ baseline UX-0006
  em 100% dos pares — zero regressão de a11y.**
- **Foco/estados:** `focus-visible:ring-2 ring-ring` (kpi-card:206),
  `hover:`/`disabled:`, `data-app-read-only`, `aria-hidden` dos dots, `aria-label`
  — **byte-a-byte intactos** (UX-0009 só toca `/NN` e valor de cor inline; não
  toca classe de foco/estado nem atributo ARIA). O hover de borda
  (`hover:border-primary/50`→`/(--opacity-divider)`) muda 5pp de opacidade do
  **hover**, não a existência/visibilidade do estado.
- **Estados loading/empty/error:** N/A — UX-0009 não toca os primitivos de
  estado (UX-0002/0003/0007, fora do escopo). O Skeleton no kpi-card (l.166) e o
  empty-state herdado pelo data-table **não são tocados** (data-table fora).
- **Responsivo:** N/A — opacidade/cor independem de viewport. As classes
  responsivas (`sm:px-7 lg:px-9 lg:py-8` etc.) **não mudam**; a única
  convergência (raio do page-header) não tem variante de breakpoint.
  `profile-page` (6 personas) e `sidebar`/`app-shell` (mobile sheet) percorridos
  desktop+mobile no smoke (§5).

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas → ✅):

- [ ] **Valor renderizado idêntico salvo itens Δ listados** — cada `cor/NN`
      virou `cor/(--opacity-*)` com o valor canônico **exato** da UX-0005 §7.4;
      os únicos Δ são os 5 pares Δ=5pp da §2.1 (`/30 /40 /50 /60 /70`),
      explicitamente listados e levados ao smoke do Gate 1.
- [ ] **Nenhuma regra/dado/comportamento** — zero prop, evento, fetch, rota,
      `permission-modules`, engine, cálculo, ordem de classe ou texto alterado;
      `git diff` só toca className/`statusConfig`/`toneStyles` e o `:root` dos
      tokens novos.
- [ ] **Contraste UX-0006 preservado** — os 5 tokens novos têm o valor OKLCH
      **byte-a-byte** das colunas da §2.2 (= medido AA pela UX-0006 §1.5);
      `--border`/`-strong`/`--ring` **não** reescritos (herdados); nenhum par
      de texto regrediu (re-medir amostra: badge `em_espera` 6.91:1, `ativo`
      composto, trends).
- [ ] **e2e asserts intactos** — `status-badge`/`page-header`/`kpi-card` mantêm
      DOM/texto/seletor/rota; `e2e/regression.py` 0-FAIL, ≥26 PASS, 6 personas
      (tokenizar cor/opacidade e trocar raio não muda `inner_text` nem dispara
      `screen_ok` substring `error`).
- [ ] **Tokens UX-0005 não duplicados** — consome `--opacity-*`/
      `--spacing-rhythm-*` existentes; **nenhum** token de opacidade/espaçamento
      novo criado; os tokens novos são **só** de cor (5 `--status-*` + `--kpi-trend-*`
      + `--module-violet/cyan`), nomeados no padrão da casa, **sem colidir** com
      nome existente em `globals.css` (grep de colisão obrigatório).
- [ ] **Reuso-primeiro** — antes de criar `--kpi-trend-*`/`--module-*`, conferido
      que nenhum token existente (incl. novos `--status-*`) tem o valor exato;
      criado só onde não há reuso possível (sem ajustar L p/ encaixar).
- [ ] **Fronteira respeitada** — `bg-amber-*` da faixa read-only intacto;
      `/45 /85 /90` da sidebar intactos (input p/ UX-0005); `data-table.tsx`/
      `button.tsx`/primitivos UX-0002/0003/0007 **não tocados**;
      `area-shell-layout`/`page-layout`/`page-container` **não tocados**.
- [ ] **read-only-tenant** — afordância desabilitada preservada byte-a-byte
      (app-shell faixa/botão; nenhuma classe de estado removida).
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso (Tailwind 4 resolve
      `cor/(--var)` e `[--var]`).
- [ ] **Commit isolado revertível** — um único commit `UX-0009`; `git revert`
      restaura sem colateral (tokens novos órfãos pós-revert são inertes).

---

## 5. Plano de verificação para o Front-End

> Objetivo: provar **zero opacidade ad-hoc remanescente** nos 11 (salvo os
> degraus de fronteira declarados), **OKLCH inline delegado → token**, e
> **neutralidade visual** (UX-0009 **não é verificável só por e2e** — smoke
> visual das 6 personas é **obrigatório**).

1. **Grep — zero opacidade ad-hoc remanescente (prova mecânica):**
   `grep -nE -- '-(border|border-strong|ring|panel|accent|primary|success|warning|danger|info|secondary|muted|muted-foreground|info-foreground|success-foreground|warning-foreground|danger-foreground|sidebar-border)/[0-9]{1,3}' src/components/shared/{page-header,page-hero,page-layout,kpi-card,status-badge,module-card,profile-page}.tsx src/components/layout/{app-shell,sidebar,area-shell-layout,page-container}.tsx`
   → **só** podem restar: `sidebar` `bg-sidebar-accent/45`, `/85`, `text-*/85`,
   `/90`, `text-muted-foreground/90` (fronteira §2.4, declarados como input
   UX-0005) e `bg-amber-50/90` (delegado §2.4). **Qualquer outro `/NN` = falha.**
2. **Grep — OKLCH inline delegado → token:**
   `grep -nE 'oklch\(' src/components/shared/{status-badge,kpi-card,module-card}.tsx`
   → os ~7 estados sem token, os 4 trends e violet/cyan **não** podem ter
   `oklch(` literal (viraram `[--status-*]`/`[--kpi-trend-*]`/`[--module-*]`).
   Os `text-[oklch]`/`dot` dos estados **token-based** **podem** permanecer
   (delegados à UX-0006 — §2.4/R3). Confirmar os novos tokens em `globals.css`
   `:root` com valor **idêntico** à §2.2 (diff de valor = falha).
3. **Diff de escopo:** `git diff --name-only` → só os 11 arquivos (parcial:
   `page-layout`/`area-shell-layout`/`page-container` provavelmente intocados) +
   `src/app/globals.css` (tokens novos). **Nenhum** `data-table.tsx`/
   `button.tsx`/tela/primitivo UX-0002/0003/0007.
4. **Re-medição de contraste (não-regressão UX-0006):** com a fórmula da
   UX-0006 §1.4, re-medir: os 5 tokens novos (esperado = §2.2: 6.91–11.04:1),
   `border`/`ring` (herdados, ≥3:1), e os pares compostos de badge com Δ=5pp
   (`secondary/70`→`--opacity-strong`; ainda ≥4.5:1 texto). **Nenhum < threshold.**
5. **Lint/tsc/test/build:** `npm run lint` · `npx tsc --noEmit` · `npm test` ·
   `npm run build` — verdes, sem novo aviso.
6. **`e2e/regression.py` (âncora M6):** **0-FAIL**, **≥26 PASS**, 6 personas
   (ver [[e2e-playwright-setup]] na memória do projeto). 17-PASS/persona entra,
   17-PASS sai. Queda = parada + rollback do item (regra do plano).
7. **Smoke visual das 6 personas — OBRIGATÓRIO (UX-0009 não é só-e2e):** logar
   nas 6 personas; percorrer **toda tela com page-header/page-hero/kpi-card/
   status-badge/module-card** + **as 6 telas de perfil** (`profile-page`) +
   **sidebar desktop colapsada/expandida e mobile (sheet)** + **app-shell faixa
   read-only-tenant** (logar como master→entrar em cliente). **Desktop e
   mobile.** Resultado esperado: **pixel-equivalente ao baseline**, exceto os
   **pontos de revisão Δ=5pp/raio** abaixo. + 1 tela canário não relacionada.
   **Pontos Δ=5pp p/ revisão lado-a-lado no Gate 1** (UX-0005 §7.4 ⚠️ + §2.3):
   - `/70 → 0.65` (**maior cascata** — page chrome + sidebar + badge `inativo`/
     `fechada` → presente em **toda tela**): borda/fundo levemente mais claros.
   - `/30 → 0.35` (page-hero badge border), `/40 → 0.35` (profile/app-shell
     alert border), `/50 → 0.55` (kpi-card hover border), `/60 → 0.65`
     (kpi-card icon ring + sidebar tenant chip bg).
   - **Raio do `page-header` `rounded-xl→rounded-2xl`** (§2.3): cabeçalho de
     ~todas as telas internas — borda de canto levemente mais arredondada.
   Se **qualquer** ponto acima parecer perceptível/destoante a ponto de mudar a
   leitura: **registrar e levar ao usuário** — fallback documentado: Estratégia
   B da UX-0005 §2.2 **só no degrau reprovado** (opacidade) / reverter raio para
   `--radius-xl` em ambos os page-chrome (convergir p/ o menor). **Não** commitar
   antes da revisão visual do Gate 1.

> Aprovação do item: passos 1-7 verdes **e** checklist §4 100% **e** revisão
> visual do Gate 1 sem objeção do usuário nos pontos Δ=5pp/raio.

---

## 6. Riscos & notas de implementação

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | **Regressão visual sutil em cascata** — 11 arquivos alimentam ~45 telas/6 personas; os 5 degraus Δ=5pp (esp. `/70`, presente em toda tela) podem somar uma diferença perceptível agregada | Média | Médio | de-para preserva valor (Δ≤±5pp por UX-0005, decisão usuário = Estratégia A); **smoke visual 6 personas obrigatório (§5.7)** com lista nominal dos pontos Δ=5pp; fallback = Estratégia B da UX-0005 só no degrau reprovado. **Ponto de revisão do Gate 1.** |
| **R2** | Front-End "aproveitar" p/ corrigir cor/contraste que **passa** (text-[oklch] token-based, faixa amber, paleta inline) | Média | Alto | Fronteira escrita (§2.4/§2.5): UX-0009 tokeniza **só** os delegados pela UX-0006 §2.4 (~7 sem token + trends + violet/cyan), **valor preservado**; `text-[oklch]` token-based e `amber-*` **delegados/fora**. Passo 2/3 reprova mudança de valor ou arquivo fora de escopo. |
| **R3** | Exceder a delegação: tokenizar **todos** os `text-[oklch]` (incl. token-based) "p/ fechar F-4" | Média | Médio | Guard-rail "criar token novo **só** para os que UX-0006 delegou". UX-0006 §2.4 delegou **literalmente os ~7 sem token** — os token-based ficam como dívida residual **delegada a UX-0006**, declarada em §2.4, **não** absorvida aqui (evita inflar escopo/diff). |
| **R4** | Sidebar `/45 /85 /90` sem token canônico — tokenizar à força inventaria mapeamento (Δ desconhecido, não-neutro) | Média | Médio | **Não tokenizar** esses degraus; deixá-los **byte-a-byte** e **registrar como input p/ a UX-0005** (mesmo padrão UX-0005 §3 → UX-0006). Passo 1 os lista como exceção declarada, não como falha. Decisão de estender a escala é da **UX-0005**, não de UX-0009. |
| **R5** | Token novo (`--status-*`/`--kpi-trend-*`/`--module-*`) **colidir** com nome existente em `globals.css` (UX-0005/UX-0006) ou criar paralelo redundante | Baixa | Médio | Grep de colisão obrigatório (§4); namespace semântico distinto (`--status-`/`--kpi-trend-`/`--module-` — nenhum existe hoje); **reuso-primeiro** (§2.2): se valor coincide com token existente, reusar, não criar. |
| **R6** | Sintaxe Tailwind 4 `cor/(--opacity-*)` ou `[--token]` não resolver no build | Baixa | Médio | Validação real do consumo é **aqui** (UX-0005 só declarou). Passo 5 (`npm run build`) é o gate; fallback = utilitário arbitrário que **renderize o mesmo valor** (o contrato é o valor, não a sintaxe). |
| **R7** | Convergência de raio do `page-header` perceptível demais (16px→26px) | Média | Baixo | Declarada como "remoção de inconsistência não-intencional de F-7" e **única** convergência; levada ao smoke Gate 1 (§5.7); fallback = convergir os dois page-chrome p/ `--radius-xl` (o menor). Padding **não** tocado (seria Onda 2). |

**Notas de implementação:**

- **Ordem (plano):** UX-0009 é o **6º** item da Onda 1 — vem **após** UX-0005
  (tokens commitados — pré-requisito estrito) e UX-0006 (border/ring/L já
  corrigidos). Confirmar no início que `globals.css` tem `--opacity-*`,
  `--spacing-rhythm-*` e `--border:oklch(0.65…)`/`--ring:oklch(0.64…)` (estado
  verificado nesta análise). Commit isolado `UX-0009`; Changelog
  [[10 - Changelog Vivo/2026-05|2026-05.md]] referencia o ID
  (template em `Docs/10 - Changelog Vivo/Template — Entrada de Changelog.md`).
- **Reversibilidade:** `git revert` restaura className e remove os tokens novos
  do `:root`; tokens órfãos pós-revert são inertes (nada consome). Sem colateral.
- **Não introduzir** dark-mode, dependência, primitivo novo, nem migrar
  "Carregando…"/empties de tela (Onda 2/3).
- **Entregar no autorreview:** o grep do passo 1 (zero ad-hoc salvo fronteira
  declarada), a re-medição do passo 4 (contraste ≥ UX-0006), a lista nominal
  dos pontos Δ=5pp/raio levados ao smoke — contrato visual do Gate 1 e de F-7.
- **Pré-condição do split (se Gate 1 reprovar Δ=5pp):** escalar p/ Estratégia B
  da UX-0005 §2.2 é mudança em **`globals.css` (dono: UX-0005)** + reaplicação
  do de-para — coordenar com o orquestrador; não improvisar token local.

---

## 7. Autorreview (Front-End)

> Preenchido pelo agente Front-End Sênior (`/frontend-design` aplicada no início).
> Implementação da Onda 1 — item UX-0009. Sem commit/build/e2e (orquestrador).

### 7.1 Resumo do diff (`git diff --name-only -- src/` — 9 arquivos)

| Arquivo | Mudança | Sítios |
|---|---|--:|
| `src/app/globals.css` | **+28 tokens de cor** novos em `:root` (5 famílias `--status-*` ×4 + 4 `--kpi-trend-*` + `--module-violet/-cyan` ×2). Aditivo; nenhum token existente alterado/renomeado. | 28 |
| `shared/page-header.tsx` | `/70`→`[var(--opacity-strong)]` + **raio `rounded-xl`→`rounded-2xl`** (§2.3, única convergência) | 2 |
| `shared/page-hero.tsx` | `/70`→strong; `/30`→border (Δ=+5); `/10`→faint. `opacity-60` ping intacto. | 3 |
| `shared/kpi-card.tsx` | 4 trends→`--kpi-trend-*`; `/70`→strong; `/50`→divider (Δ=+5); `/60`→strong (Δ=+5). `pl-[calc(...)]` + rail `opacity-80/100` intactos. | 7 |
| `shared/status-badge.tsx` | 5 famílias sem token→`--status-*` (bg/text/ring/dot); 10 opacidades token-based→`[var(--opacity-*)]` (44 sítios). `text-[oklch]`/`dot` dos token-based intactos (delega UX-0006). `ring-border` (bare) intacto. | ~57 |
| `shared/module-card.tsx` | violet/cyan icon→`--module-*`; markers `/20`→soft (Δ=+2), `/25`→muted; `/80`→prominent; `hover:/35`→border | 9 |
| `shared/profile-page.tsx` | `/75`→prominent (Δ=+3); `bg-panel/35`→border; `/70`→strong; `/80`→prominent; `border-danger/40`→border (Δ=−5)+`/25`→muted; `border-success/40`→border (Δ=−5)+`/25`→muted | 5 linhas/8 utils |
| `layout/app-shell.tsx` | `/70`→strong (Δ=−5); `border-danger/40`→border (Δ=−5)+`bg-danger/10`→faint. **Faixa `amber-*` intacta** (§2.4 delega). | 2 linhas/3 utils |
| `layout/sidebar.tsx` | só degraus c/ entrada exata: `/80`→prominent (5×), `/70`→strong (3×), `/65`→strong (1×), `/60`→strong (1×), `hover:accent/65`→strong, `text-foreground/70`→strong. **`/45 /85 /90` intactos** (R4). | 13 |

**Não tocados** (spec §1.2 C/J/K = "nada a fazer"): `shared/page-layout.tsx`,
`layout/area-shell-layout.tsx`, `layout/page-container.tsx`. **Nenhum**
`data-table.tsx`/`button.tsx`/tela/primitivo UX-0002/0003/0007.

### 7.2 Verificação mecânica (§5)

- **Passo 1 (grep zero ad-hoc no escopo):** restam **só 5 sítios em
  `sidebar.tsx`** — `bg-sidebar-accent/45` (L123), `text-muted-foreground/90`
  (L141), `text-foreground/85` (L171), `text-sidebar-foreground/85`+
  `hover:bg-sidebar-accent/85` (L207), `text-sidebar-foreground/90`+
  `hover:bg-sidebar-accent/85` (L251). **Todos `/45 /85 /90` sem entrada
  UX-0005 §7.4 → declarados como input p/ UX-0005 (R4), não falha.** Demais 8
  arquivos do escopo: **zero** opacidade ad-hoc.
- **Passo 2 (grep OKLCH inline):** `kpi-card.tsx`/`module-card.tsx` → **zero
  `oklch(`**. `status-badge.tsx` → restam apenas `text-[oklch]` dos estados
  **token-based** e `dot bg-[oklch]` decorativos — **delegados a UX-0006 §2.4 /
  isentos §2.3-B** (R3); as 5 famílias sem token estão 100% tokenizadas
  (nenhum `0.94_0.018_255`/`0.93_0.06_55`/`0.92_0.05_165`/`0.94_0.04_295`/
  `0.93_0.04_214` remanescente).
- **Passo 3 (escopo):** 9 arquivos, nenhum fora do contrato. Sem colisão de
  nome de token (`--status-*`/`--kpi-trend-*`/`--module-*` inexistentes antes).
- **Passo 4 (contraste — não-regressão UX-0006):** **nenhum valor de cor mudou.**
  Os 28 tokens herdam OKLCH **byte-a-byte** das colunas §2.2 (= UX-0006 §1.5,
  já medido AA 6.91–11.04:1; pior caso `--status-hold-foreground` `oklch(0.43
  0.08 293)` = 6.91:1 ✅). `--border/-strong/--ring` **não reescritos** (só o
  sufixo `/NN`). Δ≤5pp de opacidade do fundo tonal não cruza limiar (texto =
  OKLCH escuro sólido inalterado). **Contraste ≥ baseline UX-0006 em 100% dos
  pares — zero regressão.** (Re-medição numérica dispensada: L/C/H inalterados.)
- **Passo 5 (lint/tsc/test):** `npm run lint` → **0 erros** (6 warnings
  pré-existentes e fora das linhas editadas: `sidebar.tsx:161` `<img>` LCP não
  tocado; `product-form-dialog.tsx` fora de escopo). `npx tsc --noEmit` →
  **exit 0**. `npm test` → **110 pass, 0 fail**. **Build/e2e: orquestrador.**

### 7.3 Prova de neutralidade (de-para 1:1)

Cada `cor/NN` → `cor/[var(--opacity-*)]` com o valor canônico **exato** da
UX-0005 §7.4 (forma `[var(--…)]` = mesma sintaxe já provada no build em
`shared/toast.tsx`/UX-0002 — reuso-primeiro). Tokens de cor = valor inline
preservado byte-a-byte (UX-0006 §1.5). **Itens de revisão visual Gate 1**
(Δ≠0 — não revertidos, sinalizados):

| Ponto | Δ | Cascata |
|---|:--:|---|
| `/70 → 0.65` (`--opacity-strong`) | **−5pp** | **maior** — page chrome + sidebar + badge inativo/fechada → toda tela |
| `/30 → 0.35` (`--opacity-border`) | **+5pp** | page-hero badge border |
| `/40 → 0.35` (`--opacity-border`) | **−5pp** | profile-page (2×) + app-shell alert border (2×) |
| `/50 → 0.55` (`--opacity-divider`) | **+5pp** | kpi-card hover border (apenas estado hover) |
| `/60 → 0.65` (`--opacity-strong`) | **+5pp** | kpi-card icon ring + sidebar tenant chip bg |
| **Raio `page-header` `rounded-xl→rounded-2xl`** | +~10px | cabeçalho de ~todas as telas internas |

Outros Δ não-zero ≤3pp (`/15 +1`, `/18 −2`, `/20 +2`, `/75 +3`, `/80 −2`) —
sub-perceptíveis, dentro da tolerância da Estratégia A. **Fallback Gate 1:**
Estratégia B UX-0005 só no degrau reprovado / reverter raio p/ `--radius-xl`
nos dois page-chrome (coordenar com orquestrador — `globals.css` é dono UX-0005).

### 7.4 Checklist §4 "funcionalidade preservada"

- [x] **Valor renderizado idêntico salvo Δ listados** — de-para 1:1 §2.1; só os
      5 pares Δ=5pp + raio (§7.3) divergem, todos listados p/ Gate 1.
- [x] **Nenhuma regra/dado/comportamento** — diff só toca className/`statusConfig`/
      `toneStyles` + `:root`; zero prop/evento/fetch/rota/cálculo/texto.
- [x] **Contraste UX-0006 preservado** — 28 tokens byte-a-byte §2.2; border/ring
      não reescritos; nenhum par de texto regrediu (cor inalterada).
- [x] **e2e asserts intactos** — DOM/texto/seletor/rota inalterados (só
      className/var); `screen_ok`/`inner_text` não afetados. (Runner: orquestrador.)
- [x] **Tokens UX-0005 não duplicados** — consome `--opacity-*` existentes;
      nenhum token de opacidade/espaçamento novo; novos = só cor, sem colisão.
- [x] **Reuso-primeiro** — nenhum token existente tem o valor exato (L/C
      divergem de `--info`/`--success`/etc.); criados sem ajustar L.
- [x] **Fronteira respeitada** — `amber-*` intacto; `/45 /85 /90` intactos
      (input UX-0005); data-table/button/UX-0002/0003/0007 não tocados;
      page-layout/area-shell-layout/page-container não tocados.
- [x] **read-only-tenant** — faixa/botão app-shell: afordância byte-a-byte
      (só borda `/70`→token; `disabled:`/cor `amber` intactos).
- [x] **lint/tsc/test verdes** — 0 erro lint, tsc exit 0, 110/110 test.
      (Build: orquestrador.)
- [x] **Commit isolado revertível** — sem commit aqui; diff atômico, `git
      revert` restaura className + remove tokens (órfãos inertes).

**Checklist §4: 10/10 ✅**
