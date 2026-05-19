# UX-0008 — Unificar label "Setores"→"Categorias" (só texto de tela)

> **Spec de refinamento** (Onda 1 — Fundação). Produzida pelo agente Refinador
> (`/ux-ui-refiner` como **motor de análise**, modo spec-only). Companheira de
> [[Backlog UX (RICE)]] (item l.38 e l.112-117), [[UX PRD]] (critérios
> "Terminologia / IA-na-tela", §6; **Gate 0 D-1** §9.2/§10; métricas **M6**/**M8**),
> [[UX Audit — Sistema]] (achado
> [[UX Audit — Sistema#F-6 — Terminologia "Setores" vs "Categorias" inconsistente · 🟡 · Terminologia|F-6]]),
> [[Dívida Técnica#D26]] (renomear slug/rota — **fora**, delegado). Convenção:
> [[12 - Iniciativa UX/README|README]]. Espelha o rigor das specs commitadas
> [[UX-0007 — empty-state|UX-0007]] e [[UX-0006 — contraste-wcag-aa|UX-0006]].
> Não consome nem é consumida por nenhum primitivo das demais specs (item de
> terminologia isolado — paralelizável, conforme [[Backlog UX (RICE)]] seq. §5).

## Mandato (não-negociável)

- **Decisão do Gate 0 D-1 já tomada — NÃO reabrir.** Termo canônico de tela =
  **"Categorias"** ([[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)|UX PRD §10, D-1]]:
  *"'Categorias' (label de tela). Slug/rota `setores` permanece — dívida técnica
  [[Dívida Técnica#D26]]"*). Esta spec **assume "Categorias" como alvo** e não
  discute alternativas. Singular = **"Categoria"**, plural = **"Categorias"**,
  caixa preservada conforme o sítio (título vs corpo vs breadcrumb).
- **Refina o existente, nunca remove função/dado.** Esta spec **não altera
  comportamento, regra de negócio, dado, fetch, navegação,
  `permission-modules` (lógica/estrutura), slug, rota, `href`, param dinâmico,
  tipo TS, nome de variável/função, chave de objeto, campo de DB nem comentário**.
  O único universo tocável é a **string renderizada ao usuário** ("texto
  visível"). Tudo o mais é **estrutural** e fica **fora** (D26).
- **Achado da resolução (crítico — leia §1.3):** a varredura completa de
  `Setor*`/`setor*` em `src/app/**` + `src/components/**` mostra **zero string
  visível com "Setor"** remanescente. **A UI já diz "Categorias"** em 100% dos
  sítios renderizados — inclusive `permission-modules.ts:257`
  (`label: "Categorias"`, que `sidebar.tsx:210,218` consome **só como display**).
  UX-0008 é, na prática, um item de **verificação + blindagem** da terminologia
  já unificada, **não** uma campanha de substituição. A spec o trata como tal
  (substituições = ∅; o trabalho real é **provar** a unificação e **delegar**
  corretamente o resíduo estrutural a D26).
- **Reuso-primeiro / sem novo primitivo.** Item de terminologia: não cria nem
  toca componente. Não há decisão de design system aqui.
- **Implementação é etapa separada.** Este documento é a **especificação**. Quem
  executa (mesmo que o resultado seja "nenhuma edição de `src/` + 1 nota em D26")
  é o agente Front-End Sênior numa etapa posterior, **após aprovação explícita
  do usuário**. Esta spec **não toca `src/`**.
- **Não regredir o `e2e/regression.py`.** O runner (análise completa em §1.5)
  **não asserta** nenhum texto contendo "Setor" nem "Categoria"; **não navega**
  para `/gestor-dados/setores`. O assert sensível a texto é `AJ-0020-list`
  (`Ingrediente puro|Produto MPI|Misturado`, l.229) — **não** depende de
  "Setor"/"Categoria". `screen_ok` reprova só se o **`<title>`** contiver
  `error` ou o body trouxer `Application error`/`Unhandled Runtime`. Como o
  escopo efetivo é ∅-de-código, o risco de regressão E2E é **estruturalmente
  nulo**; mesmo assim a spec lista o impacto assert-a-assert em §1.5/§5.

---

## 1. Diagnóstico do estado atual

### 1.1 Síntese (motor `/ux-ui-refiner`)

A skill `/ux-ui-refiner` foi aplicada como **motor de análise** (Fase 1 —
auditoria do sistema existente; Fase 2 — diagnóstico; Fase 3 — plano contra o
sistema existente; **nenhuma edição** — modo spec-only). Categoria **Terminologia
/ IA-na-tela**, achado **F-6**.

Achado central (skill, Fase 2 — *UX → "system-to-real-world match: the URL/label
the user and support speak must be one vocabulary"*; Nielsen #2): a auditoria F-6
(2026-05-19) reportou label "Setores" vs "Categorias" inconsistente. **A
re-varredura linha-a-linha desta spec mostra que a inconsistência de *texto
visível* já não existe**: todo sítio renderizado diz "Categoria/Categorias". O
que **permanece** é a divergência **rota/slug `setores` ↔ label `Categorias`** —
exatamente o que o Gate 0 D-1 classificou como **dívida técnica
[[Dívida Técnica#D26]]** (estrutural, **fora** desta iniciativa). Logo, pela
regra da skill (Fase 3 — *"don't impose; the result should feel like it always
belonged"*), **não há substituição de texto a fazer**: impor uma troca seria
mexer em estrutura. O entregável de UX-0008 é **prova de unificação + fronteira
limpa com D26**, não um diff de strings.

### 1.2 Escala da varredura (cobertura da prova)

| Universo do grep | Padrão | Ocorrências brutas | Após filtrar identificadores |
|---|---|---:|---:|
| `src/app/**` + `src/components/**` | `/setor/i` | **71** | — |
| idem, menos setters React (`set[A-Z]`, `setOrder*`, `setEditingSetor`) e `setorRows`/`filteredSetores` | `/setor/i` | — | **0 texto visível** |
| `src/app` + `src/components` + `src/lib` | slug/rota/key/var/tipo/fn `setor*` | — | **16 estruturais** |
| qualquer sítio | string visível contendo "Setor" | regex JSX/label/title/placeholder/breadcrumb/aria | **0** |
| qualquer sítio | frase visível "por setor / do setor / os setores / Setor de…" | regex de frase | **0** |

> As 71 ocorrências brutas são quase todas **ruído de setter React**
> (`setOrdersPage`, `setOrderNote`, `setOrderProducts`, `setOrderId`,
> `setEditingSetor`) — o token "setor" aparece dentro de `set` + `Order`/`Editing`.
> Nenhuma é texto. O sinal real são as **16 ocorrências estruturais** (§1.4) e o
> conjunto vazio de **texto visível** (§1.3).

### 1.3 Texto visível ("a" = renderizado ao usuário) — **conjunto vazio**

Varredura de JSX text / `title=` / `label:` / `description=` / breadcrumb /
`placeholder` / `aria-*` / `sr-only` / toast / `alert(` em `src/app/**` +
`src/components/**`, classe **(a) = visível**:

| # | Sítio (arquivo:linha) | String visível | Termo hoje | Ação |
|---|---|---|---|---|
| a1 | `src/app/gestor-dados/setores/page.tsx:169` | `title="Gestão de Categorias"` | **Categorias** | nenhuma — já canônico |
| a2 | `…/setores/page.tsx:170` | `description="…as categorias macro da operação…"` | **categorias** | nenhuma |
| a3 | `…/setores/page.tsx:174` | breadcrumb `{ label: "Categorias" }` | **Categorias** | nenhuma |
| a4 | `…/setores/page.tsx:178` | KPI `value={`${activeCount} categorias`}` | **categorias** | nenhuma |
| a5 | `…/setores/page.tsx:189` | `<CardTitle>Lista de Categorias</CardTitle>` | **Categorias** | nenhuma |
| a6 | `…/setores/page.tsx:192` | botão `Nova Categoria` | **Categoria** | nenhuma |
| a7 | `…/setores/page.tsx:214` | `emptyMessage` "Carregando categorias…" / "Nenhuma categoria encontrada" | **categoria(s)** | nenhuma |
| a8 | `…/setores/page.tsx:233` | `DialogTitle` "Editar Categoria"/"Cadastrar Nova Categoria" | **Categoria** | nenhuma |
| a9 | `…/setores/page.tsx:243,247,132,155,161` | "alterações pendentes nesta categoria", "Nome completo da categoria *", erros "…da categoria"/"salvar categoria" | **categoria** | nenhuma |
| a10 | `src/app/gestor-dados/setores/[sectorId]/page.tsx:25,26,30,37,44,56,57,61,69,163` | título/descr./breadcrumb/CTA "Voltar para categorias"/"Carregando categoria"/"Categoria não encontrada"/"Esta categoria ainda não possui linhas…" | **Categoria(s)** | nenhuma |
| a11 | `src/app/gestor-dados/page.tsx:85,90,143` | card `title: "Categorias"`, `subtitle: "${n} categorias"`, hero subtitle "Categorias, linhas…" | **Categorias** | nenhuma |
| a12 | `src/app/administrador/page.tsx:91,93,114,740,749,743` | card "Categorias", descrições "categorias produtivas", "OPs por categoria", `<CardTitle>Carga por Categoria…`, `<th>Categoria</th>`, `label="categorias"` | **Categoria(s)** | nenhuma |
| a13 | `src/lib/permission-modules.ts:257` | `label: "Categorias"` — consumido por `sidebar.tsx:210` (`title={item.label}`) e `:218` (`<span>{item.label}</span>`) **como display** | **Categorias** | nenhuma (já canônico **e** já display-only — ver §1.6) |

**Total (a) visível = 13 sítios, todos já "Categoria(s)". Substituições
necessárias = 0.**

### 1.4 Estrutural ("b" = NÃO trocar — slug/rota/key/identificador) — **fica fora (D26)**

| # | Sítio (arquivo:linha) | Token | Por que é (b) — NÃO trocar |
|---|---|---|---|
| b1 | `src/lib/permission-modules.ts:256` | `id: "gestor-dados.setores"` | **chave de permissão** — consumida por rotas/guards; trocar quebra autorização. D26. |
| b2 | `src/lib/permission-modules.ts:258` | `route: "/gestor-dados/setores"` | **rota** de navegação/sidebar. D26. |
| b3 | `src/app/api/master-data/categories/route.ts:13` | `permission: "gestor-dados.setores"` | **chave de permissão de API** (igual a b1). D26. |
| b4 | `src/app/api/master-data/categories/[categoryId]/route.ts:19` | `permission: "gestor-dados.setores"` | idem b3. D26. |
| b5 | `src/app/administrador/page.tsx:90` | `href: "/gestor-dados/setores"` | **href** de navegação. D26. |
| b6 | `src/app/gestor-dados/page.tsx:87` | `href: "/gestor-dados/setores"` | idem b5. D26. |
| b7 | `…/setores/page.tsx:105,212` | `router.push(`/gestor-dados/setores/${item.id}`)` | **navegação programática** por rota. D26. |
| b8 | `src/app/gestor-dados/setores/[sectorId]/page.tsx:30,35,61,67` | `href="/gestor-dados/setores"` (dentro de breadcrumb `{label:"Categorias", href:…}`) | o **`href`** é (b); o `label` ao lado já é "Categorias" (a, ok). Trocar só o href = quebrar nav. D26. |
| b9 | diretório `src/app/gestor-dados/setores/` + `[sectorId]/` | **segmento de rota** + param dinâmico `sectorId` (`useParams<{sectorId}>`, l.17-18) | renomear pasta/param = mudança de rota + de contrato de `useParams`. D26. |
| b10 | `…/setores/page.tsx:34` | `type SetorRow = …` | **tipo TS** (identificador). Fora. |
| b11 | `…/setores/page.tsx:52` / `[sectorId]/page.tsx:16` | `function SetoresPage()` / `function SetorDetailsPage()` | **nome de componente/função**. Fora. |
| b12 | `…/setores/page.tsx:57,68,77,79,84,87,96,…` | `editingSetor`, `setEditingSetor`, `setorRows`, `filteredSetores`, `(item: SetorRow)` | **nomes de variável/parâmetro/estado**. Fora. |
| b13 | `…/setores/**`, `gestor-dados/page.tsx:90` | campos de dado `sector`, `sectorId`, `sectors`, `sectorName`, `sectorSummary`, `getLinesBySectorFromData` | **campos/funções de domínio (DB/data-layer em inglês)**. Fora — proibido por guard-rail (`src/lib/**`). |
| b14 | `src/lib/factory-workflow-logic.test.ts:50`; `src/lib/operational-date-scope.test.ts:110,190,219` | fixtures `sectorName: "Setor A"` | **dado de teste** (não renderizado ao usuário). Fora — não é UI; alterar mexeria em `src/lib/**`. |
| b15 | `src/app/api/master-data/categories/**` | nome de pasta de API `categories` | **rota de API** — já em inglês/"categories"; não é "setor" nem texto. Fora (estrutural, e nem é o conflito). |
| b16 | comentários/JSDoc | (nenhum "Setor" em comentário encontrado) | — (registrado para completude da classificação) |

**Total (b) estrutural = 16 famílias de ocorrência, todas preservadas. Decisão:
delega a [[Dívida Técnica#D26]].**

### 1.5 `permission-modules.ts` — `label` vs `slug`/`key` (a análise pedida)

O arquivo define, para o módulo (l.255-265):

- `id: "gestor-dados.setores"` (l.256) → **chave** (b1). Usada como
  `permission` em APIs (b3/b4) e como identidade de módulo nos guards.
- `route: "/gestor-dados/setores"` (l.258) → **rota** (b2).
- `label: "Categorias"` (l.257) → **rótulo de display**.

**O `label` é puramente exibição?** Sim — confirmado por leitura de
`sidebar.tsx`: o consumo é `title={item.label}` (l.210, tooltip) e
`<span>{item.label}</span>` (l.218, texto do item). A **chave de navegação** é
`id`/`route`, **nunca** `label`. Não há nenhum sítio que use `label` como
seletor, key de objeto, slug ou condição lógica (grep `\.label\b` em
`src/components`+`src/lib`: só usos de render —
[[UX-0007 — empty-state|empty-state.tsx:108]], `data-table.tsx`,
`status-badge.tsx`, `sidebar.tsx`, `role-profile-route.tsx` `homeLabel/roleLabel`,
todos display). **Conclusão:** o caso "label que é também chave/slug" — o **risco
nº 1** antecipado pelo prompt — **não se materializa aqui**: `label` é display
puro **e** já vale "Categorias". Não há ação nem risco. A solução mínima
(trocar só onde renderiza) seria a correta *se* houvesse divergência — mas não
há. Registrado para o Front-End **não** "consertar" o que já está certo.

### 1.6 `e2e/regression.py` — o runner asserta "Setor"/"Categoria"? (análise por assert)

Leitura integral do runner (6 personas + smoke piloto + asserts AJ). **Nenhum
assert depende da palavra "Setor" ou "Categoria"**, e o runner **não navega**
para `/gestor-dados/setores`. Impacto por assert sensível a texto:

| Assert / função | O que casa | Depende de "Setor"/"Categoria"? | Impacto UX-0008 |
|---|---|---|---|
| `AJ-0020-list` (l.229) | regex `Ingrediente puro\|Produto MPI\|Misturado` em `/gestor-dados/ingredientes` | **Não** | Nenhum |
| `screen_ok` (l.94-102) | `<title>` contém `error` **ou** body tem `Application error`/`Unhandled Runtime` | **Não** (não casa "setor") | Nenhum — escopo é ∅-de-código |
| `AJ-0001/0002/0013/0016` (Kanban/KPI/OPs/grade) | textos "Acompanhamento", "Agendadas", colunas, datas | **Não** | Nenhum |
| `AJ-0003/0012/0017` (chão/expedição/entregas) | "Lead expedição", "Revisões pendentes", `status=em_rota` | **Não** | Nenhum |
| `AJ-0005/0006` (loja diálogo) | toggle "Ocultar indisponíveis", "mínimo produtivo" | **Não** | Nenhum |
| `login-*` / `landing-*` (6 personas) | `<title>` sem `error` na landing | **Não** | Nenhum |
| `gestor-dados` smoke (l.233) | `screen_ok("/gestor-dados/produtos")` | **Não** — vai a `produtos`, **não** a `setores` | Nenhum |

**Veredito:** zero assert do E2E acoplado à terminologia desta spec; suíte
permanece 0-FAIL ≥26 por construção (não há mudança de código no escopo aprovado).

---

## 2. Spec de refinamento

### 2.1 Princípio operante

UX-0008 = **só a unificação de terminologia de tela "Setores"→"Categorias"**.
Como a varredura (§1.3) prova que **a unificação visível já está 100%
concluída** ("Categorias" em todos os 13 sítios renderizados), a "spec de
substituição" tem **conjunto de mudanças vazio**. O valor do item passa a ser:
(1) **certificar** a unificação com prova mecânica reproduzível (§5); (2)
**blindar** contra regressão futura (qualquer PR que reintroduza "Setor" visível
falha o gate §5); (3) **delegar formalmente** o resíduo estrutural a
[[Dívida Técnica#D26]] com a fronteira escrita (§2.4).

### 2.2 Lista exata de substituições só-texto (a) — singular/plural/caixa

**Nenhuma.** Os 13 sítios (a) de §1.3 já estão no termo canônico, com
singular/plural/caixa corretos:

- **Plural "Categorias"** (caixa título): a1, a3, a5, a11, a12, a13 — ok.
- **Singular "Categoria"** (caixa título): a6, a8 ("Nova Categoria", "Editar
  Categoria") — ok.
- **Minúsculo no corpo** "categoria(s)": a2, a4, a7, a9, a10, a12 (descrições,
  KPIs, mensagens, breadcrumb label, `<th>`) — ok.

Regra (caso um futuro PR introduza texto novo neste módulo): título/heading →
**"Categoria"/"Categorias"** capitalizado; corpo/descrição/mensagem →
**minúsculo** "categoria(s)"; nunca usar "Setor(es)" em string renderizada.

### 2.3 O que é (b) e por que fica fora

Tudo de §1.4 (b1–b16). Resumo da fronteira: **slug `setores`, rota
`/gestor-dados/setores`, `href`, `id`/`permission` `gestor-dados.setores`, param
`[sectorId]`, tipo `SetorRow`, funções `SetoresPage`/`SetorDetailsPage`, vars
`editingSetor`/`setorRows`/`filteredSetores`, campos de domínio `sector*`,
fixtures de teste `"Setor A"`** — todos **estruturais**. Renomeá-los exige:
mover diretório de rota, alterar contrato de `useParams`, reescrever chave de
permissão em guards + 2 rotas de API, refatorar tipos/vars e tocar `src/lib/**`
(proibido pelo guard-rail [[12 - Iniciativa UX/README|README]]). É exatamente o
escopo de [[Dívida Técnica#D26]]. **UX-0008 declara: DELEGA — não adota.**

### 2.4 Adota vs. delega (fronteira com D26)

| Eixo | UX-0008 (esta spec) | [[Dívida Técnica#D26]] (fora) |
|---|---|---|
| Texto visível "Setores"→"Categorias" | **Adota** — e constata: já 100% feito (Δ=0) | — |
| `label` em `permission-modules` | **Adota** a verificação — já "Categorias", display-only | — |
| slug/rota/`href`/param `[sectorId]` | — | **Delega** (estrutural) |
| `id`/`permission` `gestor-dados.setores` | — | **Delega** (chave) |
| tipo/função/var/campo `Setor*`/`sector*` | — | **Delega** (identificador/dados) |
| fixtures de teste `"Setor A"` | — | **Delega** (não é UI; `src/lib/**`) |

### 2.5 Diff conceitual (NÃO aplicar — referência para o Front-End)

**Diff de código = ∅** (vazio). Não há linha de `src/` a alterar — a
terminologia de tela já está unificada. O "entregável de implementação" do
Front-End para este item é, portanto:

1. **Rodar a prova §5** e anexar a saída (grep com 0 hits de "Setor" visível;
   grep mostrando slug/rota/key `setores` **intactos**).
2. **Registrar 1 nota** em [[Dívida Técnica#D26]] (vault, **não** `src/`)
   referenciando que UX-0008 confirmou: label de tela = "Categorias" (resolvido
   pré-existente); slug/rota/key `setores` seguem como dívida estrutural — com o
   inventário §1.4 como checklist de renome futuro.
3. **Atualizar status** no [[Backlog UX (RICE)]] (`Concluído` + data) e entrada
   no [[10 - Changelog Vivo/2026-05|Changelog do mês]] anotando explicitamente
   "escopo efetivo: verificação — terminologia já unificada na origem;
   0 mudança de `src/`; D26 mantida".
4. **Commit `UX-0008`** revertível (M8): contém **só** docs (spec + nota D26 +
   backlog/changelog). `git revert` não tem colateral de código por construção.

> Conceitualmente, se o Front-End encontrar **qualquer** "Setor" visível que
> esta spec não previu (não deve — varredura foi exaustiva), a regra é: aplicar
> §2.2 (trocar **só** a string, preservando singular/plural/caixa) e **não**
> tocar nenhum (b). Caso contrário, diff = ∅.

---

## 3. Cobertura de estados / a11y / responsivo

**N/A na maioria — explicitado** (item de terminologia, sem mudança de
estrutura/estilo):

- **Estados (loading/empty/error):** N/A — não há novo estado. As mensagens de
  loading/empty do módulo (`"Carregando categorias…"`, `"Nenhuma categoria
  encontrada"`, a7) **já** usam "categoria" e ficam **intactas**.
- **A11y:** N/A funcional. **Verificação negativa obrigatória:** confirmar que
  nenhum `aria-label`, `title`, `sr-only`, `alt` ou `<label htmlFor>` técnico
  contém "Setor" cuja troca pudesse quebrar associação acessível. Resultado da
  varredura §1.3: **nenhum `aria-*`/`sr-only` com "Setor"** — nada a fazer, nada
  a quebrar. Foco/teclado/contraste: não tocados (herdam a fundação
  [[UX-0006 — contraste-wcag-aa|UX-0006]] / [[UX-0001 — datatable-responsivo|UX-0001]]).
- **Responsivo:** N/A — zero mudança de layout/breakpoint/markup.

---

## 4. Checklist "funcionalidade preservada"

> O Front-End marca 100% no autorreview. Para UX-0008 a maioria é verificada por
> **ausência de diff de código**.

- [ ] **Nenhum slug alterado** — diretório `src/app/gestor-dados/setores/` e
      `[sectorId]/` intactos (`find` em §5 prova).
- [ ] **Nenhuma rota/`href` alterada** — `route: "/gestor-dados/setores"`,
      todos os `href`/`router.push` para `/gestor-dados/setores` byte-idênticos.
- [ ] **Nenhuma chave `permission-modules` alterada** —
      `id: "gestor-dados.setores"` (l.256) e os 2 `permission:` de API intactos.
- [ ] **`label: "Categorias"` (l.257) inalterado** — já canônico; **não**
      "corrigir" para "Setores" nem mexer (display-only confirmado §1.5).
- [ ] **Nenhum param dinâmico renomeado** — `useParams<{ sectorId }>` intacto.
- [ ] **Nenhum tipo/função/variável/campo renomeado** — `SetorRow`,
      `SetoresPage`, `SetorDetailsPage`, `editingSetor`, `setorRows`,
      `filteredSetores`, `sector*` byte-idênticos.
- [ ] **Navegação intacta** — sidebar/landing/breadcrumb levam ao mesmo destino;
      smoke 6 personas sem erro de app.
- [ ] **Só texto** — se houve qualquer edição, é exclusivamente string visível
      "Setores"→"Categorias" (não deve haver nenhuma — Δ esperado = ∅).
- [ ] **E2E asserts intactos** — `AJ-0020-list` e todos os `rec(...)` não
      dependem de "Setor"/"Categoria" (§1.6); runner não vai a `/setores`.
- [ ] **Commit isolado revertível (M8)** — `UX-0008` só com docs; `git revert`
      sem colateral de código.
- [ ] **D26 mantida e referenciada** — nota adicionada delegando o resíduo
      estrutural; nada de slug/key migrado nesta onda.

---

## 5. Plano de verificação para o Front-End

> Comandos a partir da raiz do repo. Cada passo gera **prova anexável** ao
> autorreview (espelha o rigor de [[UX-0006 — contraste-wcag-aa|UX-0006 §5]]).

### 5.1 Prova de unificação (zero "Setor" visível remanescente nos sítios "a")

```bash
# Deve retornar VAZIO: nenhuma string visível com "Setor" em app/components
grep -rniE 'setor' src/app src/components \
  | grep -viE 'set[A-Z]|setor[Rr]ows|filteredSetores|editingSetor|SetorRow|SetoresPage|SetorDetailsPage' \
  | grep -iE '"[^"]*setor|>[^<]*setor[^<]*<|title=|label:|placeholder|aria-label|sr-only'
# Esperado: (vazio)
```

### 5.2 Prova de preservação estrutural (slug/rota/key intactos)

```bash
# slug/rota/param ainda existem (NÃO podem sumir/mudar)
find src/app/gestor-dados/setores -type d            # → .../setores e .../[sectorId]
grep -n 'gestor-dados.setores\|/gestor-dados/setores' src/lib/permission-modules.ts
grep -rn '"gestor-dados.setores"' src/app/api/master-data/categories
grep -n 'label: "Categorias"' src/lib/permission-modules.ts   # → l.257 intacto
git diff --stat -- src/                               # → SEM arquivos de src/ (Δ código = ∅)
```

### 5.3 Gates padrão da onda

- `npm run lint` · `npm run build` · `npx tsc --noEmit` · `npm test` → verdes
  (triviais — sem mudança de código).
- `python e2e/regression.py` → **0 FAIL, ≥26 PASS** (baseline inalterada;
  §1.6 prova não-acoplamento).
- **Smoke 6 personas**, foco **gestor-dados** e **administrador**: abrir
  `/gestor-dados/setores`, `/gestor-dados/setores/<id>`, `/gestor-dados` (home)
  e `/administrador` (home) — confirmar que **toda** ocorrência visível diz
  "Categoria(s)", navegação e breadcrumb levam ao destino certo, sem erro de app.

### 5.4 Critério de aceite do item

UX-0008 = **Concluído** quando: §5.1 vazio **e** §5.2 mostra slug/rota/key/label
intactos **e** `git diff src/` vazio **e** §5.3 verde **e** nota D26 registrada.
(Item de verificação: o "sucesso" é a prova, não um diff.)

---

## 6. Riscos & notas de implementação

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| **Front-End "consertar" o que já está certo** — trocar `label:"Categorias"` por "Setores" achando que deve casar o slug | Média | Alto | §1.5/§2.2/checklist §4 explicitam: label é display puro **e já canônico** — **não tocar**. D-1 fechado. |
| **Trocar um (b) por engano** — renomear var/tipo/`href`/slug "achando que é texto" | Média | Alto | Inventário §1.4 com classificação b1–b16 + §5.2 prova de preservação; guard-rail proíbe `src/lib/**` e nav. |
| **Label-que-é-também-chave** (risco nº 1 do prompt) | — | — | **Não se materializa**: §1.5 prova `label` ≠ chave (chave = `id`/`route`); display-only via `sidebar.tsx:210/218`. Risco fechado. |
| **Premissa F-6 estava parcialmente obsoleta** — audit (2026-05-19) supôs "Setores" ainda visível; já não está | Alta | Baixo | Spec re-verifica na origem; escopo recalibrado para verificação+blindagem; backlog/changelog devem registrar "Δ código = ∅" para não confundir auditoria futura. |
| **Regressão E2E por terminologia** | Baixa→Nula | Alto | §1.6: nenhum assert acoplado; runner não visita `/setores`; escopo ∅-de-código → regressão estruturalmente impossível. |
| **Escopo escorrega para D26** (renomear slug "de brinde") | Média | Alto | Fronteira escrita §2.3/§2.4: UX-0008 **delega**, não adota; renome estrutural = nova entrada/PR sob [[Dívida Técnica#D26]], fora da Onda 1. |

**Notas:**
- Este é o item de **menor esforço e menor risco** da Onda 1 (RICE E0.3) — e o
  diagnóstico confirma: o trabalho de produto já foi feito na origem; resta
  **certificar e proteger**. Não inflar o escopo.
- A entrada [[Dívida Técnica#D26]] deve herdar o **inventário §1.4** como
  checklist pronto de renome futuro (slug→`categorias`), se/quando priorizada
  fora desta iniciativa.

→ Continua em [[Backlog UX (RICE)]] · [[UX PRD]] · [[UX Audit — Sistema]] ·
[[Dívida Técnica#D26]].
