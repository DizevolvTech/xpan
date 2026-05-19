# UX PRD — Iniciativa de Qualidade de Experiência

> Onda 0, 2026-05-19. Acompanha [[UX Audit — Sistema]], [[Persona-Impact Matrix]],
> [[Backlog UX (RICE)]]. Aprovação no **Gate 0** libera a Onda 1.

## 1. Problema / Oportunidade

O Xpan / Daniel Augusto v2 é **funcionalmente sólido** (ver [[Saúde do Sistema]]) mas
sua UX é **reativa**: problemas viram ajuste pontual em call (Ondas AJ 1–3). A dívida de
experiência é **transversal** — vive nos primitivos compartilhados, não nas telas:

- **Sem feedback de produto:** 17 `window.alert/confirm` nativos em 6 telas; zero toast.
- **Sem estados de carregamento:** 26 telas com "Carregando..." textual; zero skeleton; CLS.
- **Tabelas inutilizáveis no mobile:** `DataTable` força scroll horizontal (até 1500px).
- **Tokens ad-hoc:** opacidades/cores fora dos tokens; contraste WCAG nunca auditado.

**Problema, na voz dos usuários (inferido das jornadas + dívida, a validar no Gate 0):**
- Loja: *"Cliquei em confirmar, não apareceu nada, cliquei de novo — agora tem pedido
  duplicado"* (cruza com [[Dívida Técnica#D03]]).
- Loja/chão: *"No celular do balcão a tabela some pro lado, não consigo ver o pedido."*
- Gestor: *"Liberei a ordem e não sei se foi — não muda nada na tela."*

**Por que agora (trigger):** as Ondas AJ 1–3 fecharam os bugs operacionais; a próxima
alavanca de qualidade não é mais bug, é **a camada de experiência transversal**. Corrigir
nos primitivos cascateia para ~45 telas de uma vez — fazer tela-a-tela antes seria
retrabalho. Janela aberta: backlog AJ estável, suíte E2E 17-PASS como rede de segurança.

**Oportunidade:** com ~10 itens de fundação, elevar a qualidade percebida e a
acessibilidade de **todo** o sistema sem tocar uma única regra de negócio.

## 2. Objetivos

1. **Feedback universal:** toda ação que escreve confirma sucesso/erro de forma
   consistente e acessível (fim dos `alert/confirm` nativos).
2. **Carregamento percebido:** todo carregamento assíncrono mostra placeholder de forma
   (skeleton), sem layout shift.
3. **Mobile utilizável:** zero scroll horizontal cego em data-tables ≤640px.
4. **Acessibilidade AA:** contraste, foco, teclado e hit-target conformes WCAG 2.1 AA
   nos primitivos e telas-piloto.
5. **Consistência visual:** tokens e espaçamento canônicos, aplicados uniformemente.
6. **Zero regressão funcional:** suíte Playwright 17-PASS por persona entra e sai igual.

## 3. Métricas de sucesso (explícitas e mensuráveis)

| # | Métrica | Alvo | Como medir | Onda que valida |
|---|---|---|---|---|
| M1 | Ações que salvam com feedback de produto | **100%** | Auditoria: zero `window.alert`/`window.confirm` em `src/app/**` (grep) substituídos por toast/dialog | 1 + 2 |
| M2 | Carregamentos assíncronos com skeleton | **100%** nas telas tocadas | Inspeção: nenhum texto "Carregando..." cru nas telas das Ondas 1–2 | 1 + 2 |
| M3 | Scroll horizontal em data-table mobile | **0** em viewport ≤640px | Smoke responsivo nas telas-piloto + DataTable | 1 + 2 |
| M4 | Pares de token texto/fundo em WCAG AA | **100%** ≥ 4.5:1 (texto) / 3:1 (UI) | Medição de contraste OKLCH dos tokens + `status-badge` (`UX-0006`) | 1 |
| M5 | Foco visível + operação por teclado nos primitivos novos e no DnD do piloto | **100%** | Navegação só-teclado em toast/dialog/empty-state + `sublinhas-producao` | 1 + 2 |
| M6 | Regressão na suíte Playwright | **0** (17-PASS → 17-PASS por persona) | CI/runner E2E (ver [[e2e-playwright-setup]] na memória do projeto) | Gate 1 e 2 |
| M7 | Hit-target mínimo no shell para loja/chão | **≥44×44px** | Inspeção do shell em breakpoint mobile (`UX-0010`) | 1 |
| M8 | Itens de fundação com 1 commit isolado revertível | **100%** | `git log` — um `UX-####` por commit, `git revert` restaura sem colateral | 1 + 2 |

> Métrica-âncora de não-regressão: **M6**. Qualquer queda do 17-PASS = parada e rollback
> automáticos do item (regra do plano de orquestração).

## 4. Não-objetivos (escopo fora — confirmado com o usuário)

- **Nenhuma mudança de regra de negócio / funcional.** Proibido editar
  `src/lib/factory-planning/**`, `src/lib/supabase-data/**`, lógica de
  `permission-modules.ts`, engine de cronograma, qualquer cálculo de dado.
- **AJ-0009 (redesenho do modelo de pedido da loja) FORA.** `loja/pedidos` recebe
  **só polimento de apresentação**. O modelo segue no ADR ([[Backlog de Ajustes#AJ-0009]]).
- **Dark mode FORA** desta iniciativa.
- **Navegação e `permission-modules` (estrutura) FORA.** IA permitida **só dentro da
  tela** + unificação de terminologia. Renomear slug/rota `setores` continua em
  [[Dívida Técnica#D26]] (estrutural).
- **Guarda de `/impressao` ([[Dívida Técnica#D17]]) FORA** — é segurança, não UX.
- **Onda 3 não está aprovada** — condicional ao Gate 2.
- **Sem novos primitivos fora da Onda 1** — reuso-primeiro (18 shared + 18 shadcn antes
  de criar; Radix já nas deps).

## 5. Personas-alvo

Todas as 6 ([[Personas — Visão Geral]]). Prioridade de impacto por
[[Persona-Impact Matrix]]: **Loja** (maior risco — touch, balcão, falha vira dado errado)
> Chão > Gestor de Fábrica > Gestor de Dados > Administrador > Administrador Master
(read-only, herda só consistência — afordância desabilitada **não** removida).

## 6. Critérios de aceite por categoria

> Formato Given/When/Then. Aplicáveis a todo item da categoria; o Refinador detalha
> por item na spec; o Front-End marca no autorreview + checklist "funcionalidade
> preservada".

### Estado (toast / skeleton / botão enviando / empty-state)
- **Dado** uma ação que escreve (criar/editar/cancelar/liberar), **quando** concluir,
  **então** um toast de sucesso/erro aparece, é dispensável por teclado e não bloqueia
  a UI; **e** confirmações destrutivas usam dialog acessível, nunca `window.confirm`.
- **Dado** um carregamento assíncrono, **quando** os dados ainda não chegaram,
  **então** um skeleton com a forma do conteúdo é exibido e **não** há layout shift
  quando o dado chega.
- **Dado** um botão de submit, **quando** clicado, **então** fica `disabled` + spinner +
  texto de progresso até resolver — **e** clicar duas vezes não dispara duas ações.
- **Dado** uma lista vazia, **quando** não há dados, **então** o empty-state mostra
  ícone + mensagem orientadora + CTA quando aplicável (respeitando read-only-tenant).

### Responsivo
- **Dado** um data-table em viewport ≤640px, **quando** renderizado, **então** usa
  layout card/empilhado **sem scroll horizontal** e **sem** perder colunas, ações,
  ordenação, paginação ou linha expandida.
- **Dado** a persona loja/chão no shell, **quando** em mobile, **então** alvos
  interativos ≥44×44px.

### A11y
- **Dado** qualquer primitivo novo ou tela-piloto, **quando** navegado só por teclado,
  **então** todo elemento interativo é alcançável, tem foco visível
  (`focus-visible:ring`) e ARIA correto.
- **Dado** o DnD de `sublinhas-producao`, **quando** usado só por teclado, **então** a
  reordenação é possível com o **mesmo resultado** do mouse (engine intocado).
- **Dado** qualquer par texto/fundo de token, **quando** medido, **então** ≥ 4.5:1
  (texto) ou 3:1 (UI), sem alterar a semântica da cor.

### Visual / Token
- **Dado** o `globals.css`, **quando** a escala de espaçamento e os degraus de opacidade
  forem definidos, **então** nenhum componente shared usa opacidade ad-hoc
  (`/15 //18 //22 //30 //45`) nem cor OKLCH fora de token.
- **Dado** dois componentes do mesmo arquétipo, **quando** comparados, **então**
  moldura/raio/padding/ritmo vertical são idênticos.

### Terminologia / IA-na-tela
- **Dado** o módulo `gestor-dados.setores`, **quando** exibido, **então** o label de
  tela é o termo canônico único (decidido no Gate 0); **e** rota/slug **não** mudam.
- **Dado** qualquer reorganização de IA, **quando** aplicada, **então** acontece **dentro
  da tela** — navegação e `permission-modules` intocados.

### Transversal a todas as categorias
- **Dado** qualquer item, **quando** implementado, **então** lint+build+`tsc`+`npm test`
  ficam verdes **e** a suíte Playwright permanece 17-PASS por persona **e** o checklist
  "funcionalidade preservada" está 100% marcado **e** é um commit `UX-####` revertível.

## 7. Plano em fases

| Fase | Conteúdo | Gate |
|---|---|---|
| Onda 0 | Esta auditoria + matriz + backlog + PRD | **Gate 0:** usuário aprova backlog + PRD |
| Onda 1 | 10 itens FUNDAÇÃO (tokens → primitivos → DataTable → contraste → shell) | **Gate 1:** lint/build/tsc/test verde + Playwright 17-PASS + smoke 6 personas |
| Onda 2 | 6 telas-piloto (`UX-0011`…`UX-0016`) | **Gate 2:** revisão do piloto com o usuário |
| Onda 3 | Telas restantes em lotes por arquétipo | **Condicional** ao Gate 2 |

## 8. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Fix do DataTable (`UX-0001`) regride alguma das 15+ telas que o consomem | Média | Alto | Maior alavancagem = maior raio; commit isolado, Playwright + smoke por persona, canário de tela não relacionada |
| `UX-0006` exige mudar L do OKLCH e altera percepção de marca | Média | Médio | Ajustar só onde reprova AA; revisar paleta com o usuário no Gate 0 |
| Polir `loja/pedidos` (`UX-0011`) tenta corrigir o modelo (AJ-0009) sob pressão | Média | Alto | Guard-rail explícito no item + checklist "só apresentação"; Refinador marca fronteira |
| A11y do DnD (`UX-0015`) acaba tocando o engine de prioridade | Baixa | Alto | Spec do Refinador isola afordância de comportamento; teste de igualdade de resultado |
| Suíte Playwright não cobre as 6 personas / runner instável | Média | Alto | **Confirmar no Gate 0** (pré-requisito da Onda 1) — ver [[e2e-playwright-setup]] |
| Escopo de IA escorrega para navegação | Baixa | Médio | Guard-rail: IA só dentro da tela; `permission-modules` proibido |

## 9. Decisões / questões em aberto — resolver no Gate 0

> Bloqueiam ou direcionam a Onda 1. Levar ao usuário.

1. **D-0 (pré-requisito):** A suíte **Playwright 17-PASS** roda contra runner/CI estável
   com cobertura das 6 personas? Sem isso confirmado, a Onda 1 não começa (M6 é a âncora
   de não-regressão). — *Bloqueante.*
2. **D-1 — Termo canônico Setores vs Categorias (`UX-0008`):** o label de tela fica
   **"Categorias"** (atual `label`) ou **"Setores"** (slug/rota)? Recomendação PM:
   **"Categorias"** (já é o label, menor mudança visível; slug fica como dívida técnica).
3. **D-2 — Paleta no contraste (`UX-0006`):** autorizado ajustar a Luminância dos tokens
   OKLCH onde reprovar WCAG AA, mesmo que altere levemente a percepção de cor da marca?
   Recomendação PM: **sim, AA é não-negociável**; mudança mínima, revisada visualmente.
4. **D-3 — `loja/pedidos` (`UX-0011`):** confirma que **só apresentação** é permitido e
   que o bom padrão de submit atual (`page.tsx:1235`) deve ser **preservado/generalizado**
   (não reescrito)? AJ-0009 segue 100% fora.
5. **D-4 — Prioridade do `UX-0015` (a11y DnD):** subir para a Onda 2 cedo (é a única
   barreira de acessibilidade **total** por teclado, mesmo com RICE menor que polimentos)?
   Recomendação PM: **sim** — severidade 🔴 acessibilidade sobrepõe RICE puro aqui.
6. **D-5 — Fronteira de IA:** confirmar que reorganizar IA **dentro** da tela
   (ex.: agrupar filtros, reordenar seções) está liberado nas 6 telas-piloto sem novo
   ciclo de aprovação por tela — desde que navegação/`permission-modules` fiquem intactos.
7. **D-6 — Escopo de medição A11y:** WCAG AA será verificado nas **telas-piloto + todos
   os primitivos** na Onda 1/2; as ~39 telas restantes ficam para a Onda 3 (condicional).
   Confirmar que esse recorte é aceitável para o Gate 0.

## 10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)

Backlog + PRD **aprovados** ("Aprovar e seguir"). Decisões resolvidas:

| ID | Decisão | Resolução |
|---|---|---|
| D-0 | Rede de não-regressão E2E | **Versionar o runner no repo** → `e2e/regression.py` + `e2e/README.md` (6 personas + smoke piloto + asserts AJ). Baseline 0-FAIL antes da Onda 1. |
| D-1 | Termo canônico Setores/Categorias | **"Categorias"** (label de tela). Slug/rota `setores` permanece — dívida técnica [[Dívida Técnica#D26]]. `UX-0008` usa "Categorias". |
| D-2 | Contraste WCAG AA vs marca | **Ajuste mínimo de luminância OKLCH autorizado** onde reprovar AA; revisão visual no fim da Onda 1. `UX-0006`. |
| D-3 | `loja/pedidos` escopo | **Só apresentação** (rec. PM aceita). AJ-0009 100% fora; padrão de submit preservado/generalizado. |
| D-4 | Prioridade `UX-0015` | **Sobe na Onda 2** (rec. PM aceita) — barreira de a11y total por teclado. |
| D-5 | Fronteira de IA | **IA dentro da tela liberada** nas 6 telas-piloto; revisada na aprovação por spec, sem ciclo extra. Nav/`permission-modules` intocados. |
| D-6 | Escopo de medição A11y | **Primitivos + 6 telas-piloto** na Onda 1/2; ~39 restantes na Onda 3 condicional. Aceito. |

→ **Gate 0 fechado.** Pré-requisito antes da Onda 1: baseline E2E verde (D-0).
