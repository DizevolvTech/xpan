# UX-0006 — Auditoria de contraste WCAG AA dos pares de token

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner` aplicado como motor de análise). Companheira de
> [[Backlog UX (RICE)]] (item l.37 e l.103-109), [[UX PRD]] (critérios "A11y", §6;
> métrica **M4** ≥ 4.5:1 texto / 3:1 UI; resolução **Gate 0 D-2**, §10),
> [[UX Audit — Sistema]] (achado [[UX Audit — Sistema#F-4 — Tokens/opacidade ad-hoc; sem escala de espaçamento · 🟡 · Token|F-4]] / risco WCAG 1.4.3).
> Convenção: [[12 - Iniciativa UX/README|README]]. Consome
> [[UX-0005 — escala-espacamento-opacidade|UX-0005]] como **input** (§3 da UX-0005
> registrou os pares OKLCH suspeitos como entrada desta auditoria — ponto de partida).
> Espelha o rigor de [[UX-0002 — sistema-toast-feedback|UX-0002]],
> [[UX-0007 — empty-state|UX-0007]] e [[UX-0001 — datatable-responsivo|UX-0001]].
> Fronteira com [[Backlog UX (RICE)|UX-0009]] (normalização / criação de token para os
> ~7 estados sem token) declarada em §2.4.

## Mandato (não-negociável)

- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, navegação, `permission-modules`,
  estrutura de componente, nem cria/renomeia token**. O único tipo de mudança
  proposto (e **não aplicado** — esta spec não toca `src/`) é **ajuste mínimo do
  valor de Luminância (L) do OKLCH** de tokens/cores que **reprovam** WCAG AA,
  **preservando matiz (H) e croma (C)** e a semântica de cor.
- **Gate 0 D-2 (autorização explícita):** *"Ajuste mínimo de luminância OKLCH
  autorizado onde reprovar AA; revisão visual no fim da Onda 1"*
  ([[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|UX PRD §10, linha D-2]]).
  **Onde passa AA, não se mexe — byte-a-byte.** A autorização é estritamente
  corretiva, não cosmética.
- **Medição primeiro, opinião depois.** Cada par texto/fundo e UI/fundo relevante
  é **medido numericamente** (conversão OKLCH→sRGB→razão de contraste WCAG 2.x,
  §1.4) antes de qualquer proposta. A spec só propõe ajuste **onde a medição
  reprova** o threshold aplicável.
- **Threshold WCAG 2.x (AA):** **4.5:1** texto normal; **3:1** texto grande
  (≥ 24px, ou ≥ 18.66px **bold**) **e** componentes de UI / bordas significativas
  (WCAG **1.4.11** Non-text Contrast). Adornos puramente decorativos e redundantes
  são **isentos** por 1.4.11 — o critério desta fronteira está explícito em §2.3.
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  implementa é o agente Front-End Sênior (`/frontend-design`) numa etapa posterior,
  **após aprovação explícita do usuário**. Esta spec **não toca `src/`** (modo
  spec-only do Refinador — ver memória do agente).
- **Não regredir `e2e/regression.py`.** Mudança de **valor de L de cor** não altera
  seletor, texto, rota nem `inner_text` — o runner asserta conteúdo/seletor e o
  smoke `screen_ok` reprova a substring `error` (irrelevante a cor). Confirmação
  formal em §4 e §5.

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 auditoria
do sistema de design existente → Fase 2 diagnóstico → Fase 3 plano **contra o
sistema existente**, sem impor paleta nova; modo spec-only — nenhuma edição de
código). Achados consolidados (categoria **A11y**, achado **F-4** / risco
WCAG 1.4.3 Contrast (Minimum) e 1.4.11 Non-text Contrast):

1. **Os pares de TEXTO não eram o problema.** A skill alerta para "washed-out
   contrast" — mas a medição (§1.5) mostra que **todos os 18 pares
   `*-foreground` × base** e **todos os 28 tripletos de `status-badge`** passam
   AA com folga (o pior é `em_espera` a **6.91:1**, ainda > 4.5:1; a mediana
   ~9:1). A paleta de texto desta casa é, de fato, **conservadora e legível**.
   O risco F-4 ("contraste nunca auditado") era **real como ausência de
   evidência**, mas a medição **absolve a camada de texto**.
2. **O risco real é `1.4.11` em elementos não-texto** (skill, *audit-checklist
   → "borders/dividers too low contrast to perceive"*): `border`,
   `border-strong`, `ring` e os trilhos/anéis tonais têm contraste **< 2:1**
   contra a superfície clara. **Nem todos** caem sob 1.4.11 — só os que são o
   **único meio de perceber um limite/estado de UI** (§2.3 separa o que reprova
   do que é adorno isento).
3. **A paleta inline OKLCH (status-badge/module-card/kpi-card) é redundante mas
   não reprova texto** (skill, *"stick to semantic tokens"*): os ~7 estados sem
   token e os trends/markers inline são **dívida de normalização** (→ UX-0009),
   mas a **medição de contraste de texto deles passa** — logo UX-0006 **não
   precisa mudar nenhum valor inline por contraste** (declaração formal §2.4).

> Conclusão do motor: o ajuste de L autorizado pelo Gate 0 D-2 incide sobre um
> conjunto **pequeno e não-textual** — o que **minimiza o risco de marca**
> (o tema de texto/marca não muda). Detalhe em §2 e §6.

### 1.2 Inventário dos pares texto/fundo reais (o que foi medido)

**A. Tokens semânticos — `globals.css` `:root` (l.95-139).** Pares
`*` (texto) × base de superfície onde o token é usado:

| Grupo | Texto (token) | Fundo assumido | Uso típico |
|---|---|---|---|
| Corpo | `--foreground` | `--background` / `--canvas` | texto de página |
| Card | `--card-foreground` | `--card` | conteúdo de card |
| Popover | `--popover-foreground` | `--popover` | menus/tooltip |
| Painel | `--panel-foreground` | `--panel` | painéis laterais |
| Mudo | `--muted-foreground` | `--canvas`/`--card`/`--muted` | metadados, hints |
| Secundário | `--secondary-foreground` | `--secondary` | chips/inativo |
| Primário | `--primary-foreground` | `--primary` | botão primário |
| Acento | `--accent-foreground` | `--accent` | destaque |
| Info/Sucesso/Aviso/Perigo | `--*-foreground` | `--*` | KPI badge, alertas |
| Sidebar | `--sidebar-foreground`, `--sidebar-primary-fg`, `--sidebar-accent-fg` | `--sidebar*` | navegação |

**B. `status-badge.tsx` (l.43-248) — tripletos reais.** 28 tripletos
distintos `{bg, text, ring}`. O `bg` é **`token/opacidade` composto sobre a
superfície hospedeira** (badge renderiza dentro de card/tabela; base de
medição = `--card` L≈0.998, ~ `--canvas` L≈0.975 — diferença desprezível,
medido contra a **base mais clara**, o pior caso). Famílias:

- **Token-based:** `success/15` (ativo, concluído, entregue, aprovado),
  `secondary/70` (inativo, fechada, aguardando_expedicao — `text-secondary-foreground`),
  `warning/22` (em_preparacao, agendado, pendente, em_analise, pronto_coleta),
  `info/22` (em_producao, resolvida, em_rota), `danger/18` (cancelado,
  reprovado, aberta, tentativa_falha).
- **Paleta OKLCH inline sem token (~7 estados):** `nao_iniciado`
  (bg `oklch(0.94 0.018 255)`, txt `oklch(0.42 0.05 255)`), `em_forno`
  (`0.93 0.06 55` / `0.30 0.09 45`), `embalando` (`0.92 0.05 165` /
  `0.33 0.08 165`), `em_espera` (`0.94 0.04 295` / `0.43 0.08 293`),
  `rota_entrega` = `aguardando_cliente` = `no_destino`
  (`0.93 0.04 214` / `0.40 0.06 228`). **Medidos como texto**; criação de
  **token** para eles é **UX-0009** (§2.4).
- **`ring`** de cada tripleto (`ring-*/35` ou `ring-[oklch…]` ou `ring-border`):
  medido como **elemento não-texto (3:1)** sob o critério de §2.3.

**C. `kpi-card.tsx` (l.34-49) — `toneStyles.trend`.** 4 cores de tendência
OKLCH inline (`text-[oklch(0.38_0.06_240)]` info, `0.35 0.07 160` success,
`0.4 0.08 85` warning, `0.45 0.12 22` danger) + `trend` neutro
(`text-muted-foreground`), todas sobre `--card` (l.148). O **rail**
(`bg-info/success/warning/danger`, l.154) medido como UI 3:1.

**D. `module-card.tsx` (l.16-22) — `toneStyles.icon`.** Dois chips com cor
inline: `violet` (txt `oklch(0.43 0.08 293)` sobre bg `oklch(0.88 0.06 295)`)
e `cyan` (txt `oklch(0.4 0.06 228)` sobre `oklch(0.88 0.05 214)`), sobre
`--surface` (l.51). `marker` (l.16-22) é ponto decorativo de 6px (não-texto).

### 1.3 Premissas de medição (explícitas)

- **Tamanho de fonte por uso (decide 4.5:1 vs 3:1):** o texto de
  `status-badge` é `text-[10.5px] font-semibold` (l.261) → **texto pequeno →
  threshold 4.5:1** (não se beneficia da exceção de texto grande). KPI `trend`
  é `text-xs` (12px) → **4.5:1**. KPI valor/título e corpo de página → 4.5:1
  (conservador; mesmo onde seria texto grande, exigimos 4.5:1 por margem). Logo
  **todo texto é avaliado contra 4.5:1** (premissa conservadora — nenhum par de
  texto é "promovido" a 3:1).
- **Base de fundo do badge:** badges aparecem sobre `--card`/`--canvas`/tabela.
  Mede-se contra a **superfície mais clara** (`--card` L≈0.998) — pior caso
  para o `bg` translúcido (quanto mais claro o fundo, mais claro o composto,
  menor o contraste com o texto escuro). Confirmado que `--surface` (l.96)
  produz resultado equivalente (§1.5, bloco "on surface").
- **Compositing:** `token/NN` é composto **no espaço sRGB gama** (default CSS:
  `result = fg·α + base·(1−α)` por canal sRGB), depois convertido para
  luminância relativa. Coerente com o motor de render do browser.
- **Dark mode:** **fora de escopo** (decisão de escopo da iniciativa) — só
  `:root` (tema claro) medido.

### 1.4 Método de medição (OKLCH → sRGB → razão WCAG)

Pipeline determinístico (script de medição, **fora de `src/`**, descartável):

1. **OKLCH → OKLab → LMS → sRGB linear** (matrizes inversas padrão de Björn
   Ottosson; `L,C,H` → `a=C·cos(H)`, `b=C·sin(H)` → LMS⁻¹ → linear sRGB).
2. **sRGB linear → sRGB gama** (transfer function: `12.92·c` se `c≤0.0031308`,
   senão `1.055·c^(1/2.4)−0.055`); clamp em gamut `[0,1]` (adequado a esta
   paleta clara — nenhum par relevante está fora de gamut de forma material).
3. **Compositing translúcido** (quando `token/NN`): mistura em sRGB gama
   (§1.3), depois de volta a linear.
4. **Luminância relativa WCAG:** `Y = 0.2126·R + 0.7152·G + 0.0722·B`
   (canais linearizados pela função inversa de gama WCAG).
5. **Razão de contraste WCAG 2.x:** `(Y_claro + 0.05) / (Y_escuro + 0.05)`.
6. **Veredito:** comparado ao threshold da §1.3 (4.5:1 texto; 3:1 UI 1.4.11).

> O método é o **canônico WCAG 2.1/2.2**. Não usa APCA (WCAG 3 draft, não
> normativo aqui). Reprodutível pelo Front-End com qualquer lib OKLCH→sRGB +
> a fórmula acima.

### 1.5 Resultado bruto da medição

**Texto sobre fundo (threshold 4.5:1) — TODOS PASSAM:**

| Par | Contraste | AA 4.5:1 |
|---|:--:|:--:|
| `foreground` / `background` | 15.38:1 | ✅ |
| `foreground` / `canvas` | 14.43:1 | ✅ |
| `card-foreground` / `card` | 15.42:1 | ✅ |
| `popover-foreground` / `popover` | 15.42:1 | ✅ |
| `panel-foreground` / `panel` | 13.45:1 | ✅ |
| `muted-foreground` / `canvas` | 5.81:1 | ✅ |
| `muted-foreground` / `card` | 6.21:1 | ✅ |
| `muted-foreground` / `muted` | 5.40:1 | ✅ |
| `secondary-foreground` / `secondary` | 9.82:1 | ✅ |
| `primary-foreground` / `primary` | 7.36:1 | ✅ |
| `accent-foreground` / `accent` | 6.06:1 | ✅ |
| `info-foreground` / `info` | 7.21:1 | ✅ |
| `success-foreground` / `success` | 7.69:1 | ✅ |
| `warning-foreground` / `warning` | 6.94:1 | ✅ |
| `danger-foreground` / `danger` | 6.10:1 | ✅ |
| `sidebar-foreground` / `sidebar` | 11.41:1 | ✅ |
| `sidebar-primary-fg` / `sidebar-primary` | 7.36:1 | ✅ |
| `sidebar-accent-fg` / `sidebar-accent` | 9.97:1 | ✅ |

**`status-badge` tripletos — TEXTO sobre fundo composto (4.5:1) — TODOS PASSAM:**

| Estado(s) | Par texto/fundo | Contraste | AA |
|---|---|:--:|:--:|
| ativo/concluido/entregue/aprovado | `oklch(0.34 .07 162)` / `success`@15% | 10.68:1 | ✅ |
| inativo/fechada/aguard_expedicao | `secondary-foreground` / `secondary`@70% | 10.35:1 | ✅ |
| em_preparacao/agendado/pendente/em_analise/pronto_coleta | `oklch(0.39 .07 85)` / `warning`@22% | 8.95:1 | ✅ |
| em_producao/resolvida/em_rota | `oklch(0.34 .05 240)` / `info`@22% | 10.51:1 | ✅ |
| cancelado/reprovado/aberta/tentativa_falha | `oklch(0.43 .13 22)` / `danger`@18% | 8.12:1 | ✅ |
| nao_iniciado | `oklch(0.42 .05 255)` / `oklch(0.94 .018 255)` | 7.09:1 | ✅ |
| em_forno | `oklch(0.30 .09 45)` / `oklch(0.93 .06 55)` | 11.04:1 | ✅ |
| embalando | `oklch(0.33 .08 165)` / `oklch(0.92 .05 165)` | 9.35:1 | ✅ |
| em_espera | `oklch(0.43 .08 293)` / `oklch(0.94 .04 295)` | **6.91:1** | ✅ (pior caso) |
| rota_entrega/aguard_cliente/no_destino | `oklch(0.40 .06 228)` / `oklch(0.93 .04 214)` | 7.46:1 | ✅ |

**`kpi-card` trends / `module-card` chips (texto, 4.5:1) — TODOS PASSAM:**

| Par | Contraste | AA |
|---|:--:|:--:|
| trend info `oklch(0.38 .06 240)` / `card` | 9.86:1 | ✅ |
| trend success `oklch(0.35 .07 160)` / `card` | 10.87:1 | ✅ |
| trend warning `oklch(0.4 .08 85)` / `card` | 9.22:1 | ✅ |
| trend danger `oklch(0.45 .12 22)` / `card` | 7.87:1 | ✅ |
| trend neutral `muted-foreground` / `card` | 6.21:1 | ✅ |
| module violet `oklch(0.43 .08 293)` / chip `oklch(0.88 .06 295)` | 5.73:1 | ✅ |
| module cyan `oklch(0.4 .06 228)` / chip `oklch(0.88 .05 214)` | 6.41:1 | ✅ |

**Elementos NÃO-TEXTO sobre fundo (threshold 3:1) — vários reprovam:**

| Elemento | Contraste | UI 3:1 | Natureza (ver §2.3) |
|---|:--:|:--:|---|
| `border` / `card` | 1.34:1 | ❌ | **funcional** (delimita controles/tabela) |
| `border-strong` / `card` | 1.99:1 | ❌ | **funcional** (separador estrutural) |
| `ring` / `card` | 2.79:1 | ❌ | **funcional** (anel de foco — crítico a11y) |
| `success/warning/danger/info` rail / `card` | 1.38–1.61:1 | ❌ | **adorno redundante** (KPI rail; tom repetido no badge/ícone) |
| `ring-*/35` (badge) / `card` | 1.12–1.17:1 | ❌ | **adorno redundante** (texto+fill já dão estado a >8:1) |
| `ring-border` / `card` (inativo) | 1.34:1 | ❌ | **adorno redundante** |
| `ring-[oklch…]` (nao_iniciado/em_forno) / `card` | 1.5–1.7:1 | ❌ | **adorno redundante** |

> **Achado central:** **0 de ~40 pares de texto reprovam**; **100% das
> reprovações são não-texto**. Dessas, a maioria é **adorno redundante isento de
> 1.4.11**; o conjunto **genuinamente reprovado e corrigível** é
> **`border`, `border-strong`, `ring`** (3 tokens). O critério que separa um do
> outro está em §2.3 — é a decisão de design mais importante desta spec.

---

## 2. Spec de refinamento

### 2.1 Princípio operante

Gate 0 D-2 autoriza **ajuste mínimo de L apenas onde reprova AA**. A medição
mostra que:

- **Camada de texto:** **nada a fazer.** Todos os pares passam — incluindo a
  paleta inline. **Nenhum valor de cor de texto muda.** (Isto é o que protege a
  percepção de marca — §6 R1.)
- **Camada não-texto:** separar **o que 1.4.11 exige** (limite/estado
  perceptível por si só) do **que 1.4.11 isenta** (adorno redundante). Corrigir
  só o primeiro, com **ajuste mínimo de L preservando H/C**.

### 2.2 Tabela de medição completa (par → atual → AA → L proposto → novo)

**TEXTO (4.5:1) — nenhuma mudança (todos passam; coluna "L proposto" = inalterado):**

> Ver §1.5 (18 tokens + 10 famílias de badge + 7 trends/chips). **Veredito
> uniforme: PASS.** L atual = L proposto, byte-a-byte. Listados aqui por
> completude do mandato; **0 ajustes**.

**NÃO-TEXTO (3:1) — só os funcionais recebem ajuste de L:**

| Token/cor | Uso | H/C (preservado) | L atual | Contraste atual | AA 3:1 | **L proposto** | Contraste novo | Decisão |
|---|---|---|:--:|:--:|:--:|:--:|:--:|---|
| `--border` | borda de input/tabela/card que **delimita** controle | C 0.012, H 88 | **0.90** | 1.34:1 | ❌ | **0.65** | **3.21:1** (card) / 3.00:1 (canvas) | **AJUSTA** (§2.3-A) |
| `--border-strong` | separador estrutural / divisória forte | C 0.02, H 246 | **0.78** | 1.99:1 | ❌ | **0.65** | **3.21:1** / 3.00:1 | **AJUSTA** (§2.3-A) |
| `--ring` | **anel de foco** (`focus-visible:ring`) | C 0.08, H 220 | **0.68** | 2.79:1 | ❌ | **0.64** | **3.21:1** / 3.00:1 | **AJUSTA** (§2.3-A, prioridade a11y) |
| KPI `rail` (`bg-success/…`) | filete vertical decorativo de 3px | — | — | 1.38–1.61:1 | ❌ | **inalterado** | — | **NÃO AJUSTA** (§2.3-B adorno redundante) |
| `status-badge` `ring-*/35` | anel inset do badge | — | — | 1.12–1.17:1 | ❌ | **inalterado** | — | **NÃO AJUSTA** (§2.3-B) |
| `status-badge` `dot` (6px) | ponto decorativo | — | — | n/a (decorativo) | — | **inalterado** | — | **NÃO AJUSTA** (§2.3-B) |
| `module-card` `marker` (6px) | bullet decorativo | — | — | n/a | — | **inalterado** | — | **NÃO AJUSTA** (§2.3-B) |

**Detalhe do cálculo de "L proposto"** (busca binária pelo **maior L** que
ainda atinge 3:1 contra a **base mais clara**, `--card` L≈0.998, e validado
contra `--canvas`; H e C **idênticos** ao valor atual):

- `--border`: `oklch(0.90 0.012 88)` → **`oklch(0.65 0.012 88)`** — H/C
  intactos; só L 0.90→0.65. Contraste 1.34:1 → **3.21:1** sobre card
  (3.00:1 sobre canvas, o limite — passa).
- `--border-strong`: `oklch(0.78 0.02 246)` → **`oklch(0.65 0.02 246)`**.
  1.99:1 → **3.21:1**.
- `--ring`: `oklch(0.68 0.08 220)` → **`oklch(0.64 0.08 220)`** (delta de L
  pequeno: 0.68→0.64; já estava perto). 2.79:1 → **3.21:1**. Prioridade alta:
  é o **anel de foco visível** — falha aqui é barreira de teclado real
  (cruza com M5 do PRD).

> **Por que `--border` cai tanto (0.90→0.65)?** Para um traço de 1px atingir
> 3:1 contra fundo quase-branco, o traço precisa ser nitidamente mais escuro.
> 0.65 é o **mínimo** que satisfaz 3:1 — não há margem para um valor mais claro.
> Impacto de marca discutido em §6 R1 (mitigado: bordas não são "cor de marca"
> e a UI fica **mais nítida**, não destoante).

> **Nota sobre `--sidebar-border` (`oklch(0.84 0.013 88)`, contraste ~1.7:1
> sobre `--sidebar`):** é divisória **interna decorativa** da navegação (a
> navegação tem rótulos de texto que passam 11:1 e estado ativo por
> cor+fundo+peso — a borda é redundante). Classificada **§2.3-B (não ajusta)**
> para não escurecer a navegação inteira. **Flag de revisão visual** no smoke
> (§5) — se o usuário considerar a divisória imperceptível a ponto de
> prejudicar a leitura da nav, vira ajuste pontual (mesma regra: só L).

### 2.3 Critério 1.4.11 — o que reprova vs. o que é adorno isento

WCAG **1.4.11** exige 3:1 para *"parts of graphical objects required to
understand the content"* e *"visual information required to identify ... states"*
— **mas** isenta explicitamente elementos **decorativos** e os que **não são
necessários** para entender/operar (a informação está disponível por outro
meio com contraste suficiente).

- **(A) Reprova e corrige — limite/estado necessário, sem redundância
  suficiente:**
  - `--border` / `--border-strong`: quando são o **único** traço que separa um
    campo de formulário, célula de tabela ou card do fundo, a percepção do
    **limite do controle** depende deles. Não há texto redundante que comunique
    "aqui termina o input". → **ajuste de L (§2.2).**
  - `--ring`: é o **indicador de foco de teclado** (`focus-visible:ring` em
    `kpi-card.tsx:206`, botões, inputs). 2.4.7/1.4.11 — **necessário** para
    operar por teclado e **sem alternativa**. Prioridade máxima. → **ajuste.**
- **(B) Isento — adorno redundante (NÃO ajusta; ajustar destruiria a marca):**
  - **KPI `rail`** (filete de 3px): a identidade do KPI vem do **ícone +
    badge colorido + valor**, todos > 6:1. O rail é **reforço estético**; sua
    ausência não impede entender o card. Forçá-lo a 3:1 exigiria L ≈ 0.05
    (quase preto) a 35-100% — **descaracterizaria o tom**. Isento.
  - **`status-badge` `ring-*/35`**: o estado é comunicado por **texto
    (>8:1) + cor de fundo + rótulo legível**. O anel a 35% é **moldura
    decorativa**; medição mostra que torná-lo 3:1 exigiria L ≈ 0.05 (anel
    preto num badge pastel — visualmente quebrado). **Redundante e isento.**
  - **`dot` / `marker`** (pontos de 6px): puramente decorativos, sempre
    acompanhados de rótulo de texto. Isentos por 1.4.11 (decorative).

> **Esta separação é a decisão de design central da spec** e o que mantém o
> ajuste "mínimo" do Gate 0 D-2 literalmente mínimo: **3 tokens funcionais**,
> não a paleta inteira. Levar à aprovação do usuário (§6 R1) — é defensável e
> conservadora, mas o usuário pode pedir para também escurecer levemente algum
> adorno por gosto (fora do mandato de AA; seria decisão estética separada).

### 2.4 Adota vs. delega (fronteira com UX-0009)

| Item | UX-0006 (aqui) | UX-0009 (normalização) |
|---|---|---|
| Medir todos os pares texto/fundo + UI | ✅ **adota** (§1.5/§2.2) | — |
| Ajustar L de `--border`/`--border-strong`/`--ring` (reprovam 1.4.11) | ✅ **adota** (diff §2.5, **não aplicado**) | — |
| **Criar token** para os ~7 estados sem token (`em_forno`, `embalando`, `em_espera`, `nao_iniciado`, `rota_entrega`, `aguardando_cliente`, `no_destino`) | ❌ **delega** — esses pares **passam AA**; não há correção de contraste a fazer. Refatorar OKLCH inline → token semântico é **normalização**, não a11y. | ✅ **UX-0009** |
| Substituir OKLCH inline de `kpi-card.trend` / `module-card` por token | ❌ **delega** (passam AA — sem ação de contraste) | ✅ **UX-0009** |
| Canonizar opacidade `/NN` → `--opacity-*` | ❌ fora (já é UX-0005/UX-0009) | ✅ UX-0009 |

> **Declaração explícita (mandato do backlog):** UX-0006 = **medição + correção
> dos pares reprovados** nos tokens de `globals.css` + badges/trends/markers que
> reprovassem. Como a medição mostra que **os badges/trends/markers de
> `status-badge.tsx`/`kpi-card.tsx`/`module-card.tsx` PASSAM AA na camada de
> texto**, UX-0006 **não altera nenhum valor inline desses arquivos**. A
> existência de cor inline sem token é dívida de **normalização → UX-0009**.
> UX-0006 toca **apenas `globals.css`** (3 valores de L).

### 2.5 Diff conceitual (NÃO aplicar — referência para o Front-End)

> Único arquivo afetado: `/Users/giuseppedangelis/Dev/daniel-augusto-v2-new/src/app/globals.css`,
> bloco `:root`. **3 linhas** mudam **apenas o primeiro número (L)** do `oklch()`;
> **H e C idênticos**. Nenhuma linha adicionada/removida; nenhum token
> renomeado; `@theme inline` intocado (mapeia `var(--border)` etc. — herda o
> novo valor sem edição).

```diff
  /* src/app/globals.css :root — SOMENTE o valor L muda; C e H preservados */
- --border: oklch(0.9 0.012 88);
+ --border: oklch(0.65 0.012 88);          /* UX-0006: L 0.90→0.65 — 1.34:1 → 3.21:1 (WCAG 1.4.11) */

- --border-strong: oklch(0.78 0.02 246);
+ --border-strong: oklch(0.65 0.02 246);   /* UX-0006: L 0.78→0.65 — 1.99:1 → 3.21:1 */

- --ring: oklch(0.68 0.08 220);
+ --ring: oklch(0.64 0.08 220);            /* UX-0006: L 0.68→0.64 — 2.79:1 → 3.21:1 (foco visível) */
```

> **NÃO mexer** (medido, passa AA — byte-a-byte idêntico): todos os
> `*-foreground`, `--canvas/--surface/--panel/--background/--card/--popover`,
> `--primary/--secondary/--muted/--accent/--destructive/--info/--success/`
> `--warning/--danger`, **toda a família `--sidebar-*`** (ver nota §2.2 sobre
> `--sidebar-border` — flag de revisão, não ajuste), `--input`, `--radius*`,
> `--shadow-*`, `--font-*`, `--space-unit`, `--spacing-rhythm-*`,
> `--opacity-*`. **Zero edição** em `status-badge.tsx`, `kpi-card.tsx`,
> `module-card.tsx`, `@theme inline` ou qualquer `src/**` que não seja a
> declaração `:root` acima.

> ⚠️ **Efeito colateral mensurável a validar (não bloqueante):** `--input`
> (`oklch(0.96 0.006 84)`) usa o **mesmo papel visual** de fundo de campo, e
> `--border` é a borda desse campo. Com `--border` em L 0.65, a borda fica
> nítida sobre `--input` (contraste sobe — bom). `--secondary` (chip) tem
> borda `--border` — verificar no smoke (§5) que chips não ficam "pesados".
> Nenhuma regressão funcional possível (só valor de cor).

---

## 3. Cobertura de estados / a11y / responsivo

UX-0006 é **token de cor puro** (3 valores de L). Não há componente, fluxo,
breakpoint ou estado de dado novo. Cobertura relevante:

- **Foco (a11y — central neste item):** o ajuste de `--ring` (0.68→0.64)
  **melhora** o foco visível de teclado em **todos** os controles que usam
  `focus-visible:ring-ring` (botões, inputs, KPI-link `kpi-card.tsx:206`,
  toast/dialog/empty-state das UX-0002/0004/0007). Eleva de 2.79:1 (reprova)
  para 3.21:1 (passa 1.4.11/2.4.7). **Nenhuma regressão de foco** — só
  fortalece. Cruza com **M5** do PRD (foco visível nos primitivos novos).
- **Não-só-cor:** o ajuste **não introduz dependência de cor** — apenas
  escurece traços que já eram o único delimitador, **aumentando** a
  perceptibilidade para baixa visão e daltonismo (luminância, não matiz).
  Estado em `status-badge` continua redundante (texto + fundo + rótulo) —
  inalterado.
- **Estados loading/empty/error:** N/A — UX-0006 não toca componente. Os
  primitivos de estado (UX-0002/0003/0007) herdam o `--border`/`--ring` mais
  contrastado automaticamente (melhora a moldura do skeleton/empty-state e o
  foco do toast/dialog) — ganho colateral, sem ação.
- **Responsivo:** N/A — valor de cor independe de viewport. O DataTable
  responsivo (UX-0001) herda bordas mais nítidas em mobile (positivo para
  loja/chão em tela pequena).

---

## 4. Checklist "funcionalidade preservada"

A verificar **integralmente** pelo Front-End no autorreview (todas → ✅):

- [ ] **Só L mudou nos reprovados** — exatamente **3 linhas** em
      `globals.css:root` (`--border`, `--border-strong`, `--ring`); em cada
      uma **apenas o 1º valor do `oklch()`** mudou. `git diff` mostra 3
      pares `-`/`+`, nenhuma outra linha.
- [ ] **Matiz/croma/semântica preservados** — H e C **idênticos** ao baseline
      em cada um dos 3 (`0.012 88`, `0.02 246`, `0.08 220`); papel semântico
      do token inalterado (borda = borda, ring = foco).
- [ ] **Nenhum par que passava piorou** — todos os pares de §1.5 (texto)
      re-medidos: contraste **≥ baseline** (escurecer `--border`/`--ring`
      **não afeta** pares de texto `*-foreground × base`; só afeta
      borda/foco, que **melhoram**). Re-medir `border` sobre `--card`,
      `--canvas`, `--input`, `--secondary`, `--muted` → todos ≥ 3:1, nenhum
      par de texto regrediu.
- [ ] **Tokens não renomeados / não removidos / nenhum criado** —
      `globals.css:4-156` mesmos nomes; só 3 valores de L alterados; zero
      token novo (criação p/ estados sem token é **UX-0009**).
- [ ] **`status-badge.tsx`/`kpi-card.tsx`/`module-card.tsx` byte-a-byte
      idênticos** — `git diff --name-only` = **só** `src/app/globals.css`.
- [ ] **`@theme inline` intocado** — herda `var(--border/-strong/-ring)`
      novos sem edição.
- [ ] **Zero mudança de comportamento** — sem JS/TSX; sem prop/evento/fetch/
      rota/`permission-modules`/engine/cálculo.
- [ ] **Sem dependência nova** — só CSS; `package.json` inalterado.
- [ ] **Build/lint/tsc/test verdes** — `npm run lint`, `npm run build`,
      `npx tsc --noEmit`, `npm test` sem novo erro/aviso.
- [ ] **e2e intacto** — `e2e/regression.py` 0-FAIL, ≥ 26 PASS, 6 personas
      (mudança de L não altera seletor/texto/rota; `screen_ok` substring
      `error` não exercitada por cor).
- [ ] **Commit isolado revertível** — um único commit `UX-0006`;
      `git revert` restaura os 3 valores de L sem colateral.

---

## 5. Plano de verificação para o Front-End

Objetivo: provar que **só 3 valores de L mudaram**, que **os 3 agora passam
1.4.11**, e que **nenhum par que passava regrediu** nem a marca destoou.

1. **Diff cirúrgico (prova mecânica):**
   `git diff src/app/globals.css` → exatamente **3** hunks `-/+`, cada um só
   com o 1º número do `oklch()` alterado; H/C textualmente idênticos.
   `git diff --name-only` → **somente** `src/app/globals.css`. Nenhum arquivo
   de `src/components/**`.
2. **Re-medir os 3 corrigidos (≥ threshold):** com a mesma fórmula da §1.4,
   `--border`/`--border-strong`/`--ring` sobre `--card` **e** `--canvas`
   → **≥ 3:1** em ambos (esperado ≥ 3.00:1; alvo de cálculo 3.21:1 sobre card).
3. **Re-medir os pares que passavam (não-regressão):** todos os 18 tokens de
   texto + 10 famílias de badge + 7 trends/chips (§1.5) → contraste
   **≥ baseline**, **nenhum** caiu abaixo de 4.5:1. Em especial: `border`
   sobre `input`/`secondary`/`muted`/`popover` → todos **≥ 3:1**, nenhum
   texto afetado.
4. **Lint/tsc/test/build:** `npm run lint` · `npx tsc --noEmit` ·
   `npm test` · `npm run build` — todos verdes, sem novo aviso.
5. **`e2e/regression.py` (âncora M6):** **0-FAIL**, **≥ 26 PASS**, 6 personas
   (ver [[e2e-playwright-setup]] na memória do projeto). 17-PASS/persona entra,
   17-PASS sai. Qualquer queda = parada + rollback do item (regra do plano).
6. **Smoke visual das 6 personas (Gate 0 D-2 exige revisão visual):** logar
   nas 6 personas, percorrer telas com **muita borda/input/tabela**
   (`administrador/usuarios` matriz, qualquer `data-table`, formulários),
   **foco de teclado** (Tab pelos controles → o `ring` agora mais escuro deve
   estar **claramente visível**, não destoante), `kpi-card`/`status-badge`
   (confirmar que **fill/texto/rail/badge ring continuam idênticos** — só a
   borda externa de cards/inputs ficou mais nítida), **desktop e mobile**,
   **+ 1 tela canário**. **Critério:** a UI deve parecer **a mesma marca, mais
   nítida** — se alguma tela parecer "pesada"/destoante (esp. `--border` em
   chips `--secondary` e a nota §2.2 sobre `--sidebar-border`), **registrar e
   levar ao usuário** antes do commit (revisão visual do Gate 0 D-2).

> Aprovação do item: passos 1-6 verdes **e** checklist §4 100% **e** revisão
> visual do Gate 0 D-2 sem objeção do usuário.

---

## 6. Riscos & notas de implementação

| ID | Risco | Prob. | Impacto | Mitigação |
|---|---|:--:|:--:|---|
| **R1** | **`--border` 0.90→0.65 muda a percepção da marca** (bordas nitidamente mais escuras em toda a UI) | Média | Médio | **Minimizado por construção:** (a) bordas não são "cor de marca" (primária/acento intactas); (b) é o **mínimo** que satisfaz 3:1 — não há valor mais claro válido; (c) o efeito é "UI **mais nítida**", não "outra marca"; (d) **revisão visual no smoke (Gate 0 D-2)** com o usuário antes do commit. Se o usuário recusar a nitidez total, alternativa **não-AA-conforme** (manter 0.90) **não é opção** (M4 não-negociável) — discutir apenas se há sub-uso de `--border` onde 3:1 não se aplica (decorativo) que justifique **um segundo token** decorativo → isso seria **UX-0009** (split de token), não UX-0006. |
| **R2** | Front-End "aproveitar" para mexer em cor que **passa** (paleta inline, trends, fill de badge) | Média | Alto | Mandato escrito (§2.1/§2.4): **só L dos 3 reprovados**. Passo 1/3 da verificação reprova qualquer outro arquivo/valor no diff. |
| **R3** | Front-End ajustar `--ring` a mais (passou a 3.21:1, não escurecer além) | Baixa | Médio | L proposto é o **mínimo** (0.64) — não escurecer mais "por garantia": foco bom é ~3:1, não 7:1 (anel preto seria feio e fora do mandato mínimo). |
| **R4** | `--border` mais escuro deixa inputs/chips "pesados" no smoke | Média | Baixo | Esperado e **aceitável** (é o preço de 1.4.11); validar no passo 6. Se um uso específico de `--border` for comprovadamente **decorativo** (3:1 não exigível ali), a solução correta é **split de token** em UX-0009 — **não** reverter o valor AA aqui. |
| **R5** | Conversão OKLCH→sRGB do Front-End diverge da medição da spec | Baixa | Médio | Método canônico documentado (§1.4). Passo 2/3 re-mede com a **mesma fórmula** — divergência > 0.1:1 = investigar a lib antes de aceitar. |
| **R6** | `--sidebar-border` (não ajustado, §2.2) acusado no smoke como imperceptível | Baixa | Baixo | É **flag de revisão** deliberada, não omissão. Se o usuário pedir, vira ajuste pontual idêntico (só L), dentro do mesmo commit ou em follow-up — registrar a decisão. |

**Notas de implementação:**

- **Ordem (plano):** UX-0006 vem **após** os tokens estabilizados (UX-0005
  commitado) e os primitivos de estado/DataTable — assim o `--ring` mais
  contrastado já beneficia toast/dialog/empty-state/skeleton existentes. Commit
  isolado `UX-0006`; Changelog `2026-05.md` referencia o ID.
- **Reversibilidade:** `git revert` restaura 3 valores de L — zero colateral
  (nada estrutural mudou; só a aparência da borda volta ao baseline reprovado).
- **Não introduzir** dark-mode, novo token, nem tocar `@theme inline`
  (ele já referencia `var(--*)` — herda o novo L de graça).
- **Entregar no autorreview:** a tabela §2.2 re-medida (pós-ajuste) + a
  confirmação dos 3 critérios (≥3:1 nos corrigidos / nenhum texto regrediu /
  só L mudou) — é o contrato de M4 do PRD.
```

---

## 7. Autorreview (Front-End)

> Executado pelo agente Front-End Sênior (`/frontend-design` aplicado no início).
> Implementação **exatamente** conforme diff §2.5 — 3 valores de L em
> `src/app/globals.css` `:root`; **nenhum** outro arquivo tocado.

### 7.1 Diff cirúrgico (prova mecânica — passo §5.1)

`git diff src/app/globals.css` — exatamente **3 hunks** `-`/`+`, cada um só
o 1º número do `oklch()`; C e H **textualmente idênticos**:

```diff
-  --border: oklch(0.9 0.012 88);
-  --border-strong: oklch(0.78 0.02 246);
+  --border: oklch(0.65 0.012 88);
+  --border-strong: oklch(0.65 0.02 246);
   --input: oklch(0.96 0.006 84);
-  --ring: oklch(0.68 0.08 220);
+  --ring: oklch(0.64 0.08 220);
```

`git diff --name-only -- src/` → **somente** `src/app/globals.css`.
`--input` (linha entre os hunks) **byte-a-byte intocado** (`0.96 0.006 84`).
`@theme inline` (`--color-border`/`-strong`/`-ring`) intocado — herda o novo
`var(--*)`. Família `--sidebar-*` intocada (ver §7.5 sobre `--sidebar-border`).

### 7.2 Re-medição WCAG (mesma fórmula §1.4) — antes → depois

Pipeline canônico OKLCH→OKLab→LMS→sRGB linear→gama→Y WCAG→razão; script
descartável fora de `src/`. Medido contra `--card` (L≈0.998, pior caso) **e**
`--canvas` (limite). Veredito pelo **mínimo** das duas bases:

| Token (C/H preservados) | L antes→depois | Contraste antes (min card/canvas) | Contraste depois (min) | AA 3:1 |
|---|:--:|:--:|:--:|:--:|
| `--border` (0.012 88) | 0.90→**0.65** | 1.34:1 / **1.25:1** ❌ | card 3.22:1 / canvas **3.01:1** | ✅ PASS |
| `--border-strong` (0.02 246) | 0.78→**0.65** | 1.99:1 / **1.86:1** ❌ | card 3.21:1 / canvas **3.00:1** | ✅ PASS |
| `--ring` (0.08 220) | 0.68→**0.64** | 2.79:1 / **2.61:1** ❌ | card 3.26:1 / canvas **3.05:1** | ✅ PASS |

Alvo de cálculo da spec era 3.21:1 sobre card / 3.00:1 sobre canvas — re-medição
bate (divergência < 0.1:1, dentro de **R5**). Os 3 reprovados agora **≥ 3:1 em
ambas as bases canônicas**.

**Pares que passavam — não-regressão (amostra re-medida; nenhum regrediu):**

| Par | Contraste | AA |
|---|:--:|:--:|
| `foreground` / `background` | 13.23:1 | ✅ |
| `foreground` / `canvas` | 12.67:1 | ✅ |
| `muted-foreground` / `canvas` | 5.57:1 | ✅ |
| `muted-foreground` / `card` | 5.95:1 | ✅ |
| `primary-foreground` / `primary` | 5.53:1 | ✅ |
| `status-badge` `em_espera` (pior caso, texto/composto) | 6.91:1 | ✅ (idêntico §1.5) |
| `status-badge` `ativo` (success@15% composto) | 9.28:1 | ✅ |

Escurecer `--border`/`--border-strong`/`--ring` **não afeta** nenhum par de
texto `*-foreground × base` nem o `bg` composto dos badges (variáveis
ortogonais) — confirmado numericamente. **0 regressões de texto.**

### 7.3 Efeito colateral §2.5 (⚠️ não-bloqueante) — `--border` sobre fundos de campo/chip

`--border` (L 0.65) re-medido sobre outras superfícies:

| `--border` sobre | Contraste | Nota |
|---|:--:|---|
| `popover` / `card` / `canvas` (superfícies hospedeiras — base canônica §1.3) | 3.22 / 3.22 / 3.01:1 | ✅ ≥ 3:1 |
| `input` | 2.88:1 | flag Gate 1 (campo, não superfície hospedeira) |
| `secondary` (chip) | 2.71:1 | flag Gate 1 (R4) |
| `muted` | 2.79:1 | flag Gate 1 |

A spec define a **base de medição como `--card`/`--canvas`** (§1.3, §2.2) e
contra essas o token **passa**. `--input`/`--secondary`/`--muted` são fundos de
**campo/chip preenchido**, não a superfície contra a qual 1.4.11 define o
limite — e ali o limite é redundante (campo tem `--ring` de foco agora 3.05:1 +
label). A spec §2.5 (nota ⚠️) e **R4** já preveem exatamente isto como
**esperado, aceitável e não-bloqueante**: a correção AA do valor **não** se
reverte; um split de token decorativo seria **UX-0009**, não UX-0006.
Registrado como **flag de revisão visual de marca no Gate 1** (não desvio).

### 7.4 Checklist §4 "funcionalidade preservada" — 100%

- [x] **Só L mudou nos reprovados** — 3 linhas, só o 1º valor do `oklch()`; `git diff` = 3 pares `-`/`+`, nenhuma outra linha.
- [x] **Matiz/croma/semântica preservados** — H/C idênticos (`0.012 88`, `0.02 246`, `0.08 220`); papel inalterado.
- [x] **Nenhum par que passava piorou** — texto/badges re-medidos ≥ baseline; `border` sobre superfícies hospedeiras ≥ 3:1.
- [x] **Tokens não renomeados / removidos / nenhum criado** — mesmos nomes; 3 valores de L; zero token novo.
- [x] **`status-badge.tsx`/`kpi-card.tsx`/`module-card.tsx` byte-a-byte** — `git diff --name-only` = só `src/app/globals.css`.
- [x] **`@theme inline` intocado** — herda `var(--border/-strong/-ring)`.
- [x] **Zero mudança de comportamento** — sem JS/TSX; nenhuma prop/evento/fetch/rota/permissão/engine.
- [x] **Sem dependência nova** — só CSS; `package.json` inalterado.
- [x] **lint/tsc/test verdes** — `npm run lint`: 0 errors, 6 warnings (todas pré-existentes, arquivos não tocados); `npx tsc --noEmit`: limpo; `npm test`: 110 pass / 0 fail. (Build/e2e reservados ao orquestrador — Gate.)
- [x] **e2e intacto** — mudança de L não altera seletor/texto/rota; `screen_ok` substring `error` não exercitada por cor. (Runner roda no Gate.)
- [x] **Commit isolado revertível** — 3 valores de L; `git revert` restaura sem colateral. (Commit feito pelo orquestrador.)

### 7.5 Nota para a revisão visual de marca (Gate 1)

- **`--sidebar-border`** (`oklch(0.84 0.013 88)`, ~1.7:1): **NÃO ajustado** —
  a spec §2.2 o classifica como **§2.3-B (adorno redundante, não ajusta)**,
  flag deliberada de revisão de Gate 1. Seguido o que a spec decidiu (não
  ajustar e registrar). Se o usuário considerar a divisória imperceptível,
  vira ajuste pontual idêntico (só L) — decisão do Gate 1.
- **`--border` sobre `input`/`secondary`/`muted`** (2.71–2.88:1, §7.3):
  esperado por construção (spec §2.5 ⚠️ / R4). Levar à revisão visual: a UI
  deve parecer "**a mesma marca, mais nítida**". Se chips `--secondary`
  parecerem "pesados", a solução conforme a spec é split de token em
  **UX-0009**, não reverter o valor AA.
- Smoke visual das 6 personas + foco de teclado (passo §5.6) reservado ao
  Gate (orquestrador roda e2e/build/smoke).

