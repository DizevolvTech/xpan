# Auditoria Visível — Sistema Inteiro

> Olhada direta no código (não abstrata) das telas críticas do app. Motivo: cliente reclamou de **"muita informação na mesma tela"** (Dashboard Executivo) e **"usabilidade toda confusa"** (modal de pedidos). Pedido do usuário: "olhe o sistema INTEIRO".
>
> Esta auditoria é **diferente** de `UX Audit — Sistema.md` da Onda 0 (que era abstrata, focada em fundação). Aqui é **density real, por tela, com ações concretas**.

---

## TL;DR — o diagnóstico em uma frase

O app não tem um problema de componente; tem um problema de **decisão de o que mostrar**. Cada tela tenta exibir tudo de uma vez: 4-6 KPIs, 1-2 gráficos, 1 tabela, +N cards de módulo que **duplicam a sidebar**, +painéis explicativos, +banners. A sidebar já lista 22 módulos. O dashboard exibe os mesmos 22 módulos como cards. O usuário pede "fazer um pedido"; o modal dá um curso sobre como o sistema funciona antes do produto aparecer. **A causa de "poluído" não é estética — é hierarquia ausente.**

---

## Padrões universais de poluição (atacam várias telas de uma vez)

### P1 — Module cards duplicam a sidebar em TODOS os 6 dashboards
- `administrador/page.tsx` linha 808-833: seção "Acesso por Capacidade" com 22 ModuleCards agrupados.
- `gestor-fabrica/page.tsx:559-568`: 4 ModuleCards.
- `loja/page.tsx:208-217`: ModuleCards.
- `gestor-dados/page.tsx:180-189`: ModuleCards.
- `chao-fabrica/page.tsx:111-120`: ModuleCards.
- `administrador-master/page.tsx:77-104`: ModuleCards.
- **Sidebar (`permission-modules.ts`) já tem todos os módulos**, com ícones, agrupados, sempre visível.
- **Ação:** remover ModuleCards de TODOS os dashboards (1 mudança por arquivo, ~6 arquivos). Substituir, se necessário, por **1 linha de 3-4 atalhos rápidos** (Ações primárias do papel — ex.: gestor-fábrica → "Liberar pedidos", "Auditoria do dia", "Expedição"). Sidebar continua para navegação completa. **Impacto: corta ~40% do conteúdo visual de cada dashboard.**

### P2 — KPIs demais (4-6 por dashboard) competindo
- administrador: 6 KPIs (`xl:grid-cols-6`).
- gestor-fabrica: 5 KPIs.
- loja: 5 KPIs.
- chao-fabrica: 5 KPIs.
- admin-master: 6 KPIs.
- gestor-dados: 4 KPIs.
- **Olho humano compara bem 3, no máximo 4**. Acima disso vira manchete uniforme.
- **Ação:** por dashboard, escolher **3 KPIs primários** (os que importam para a decisão DESSE papel) + uma linha de stats secundárias **menor e em texto** (ex.: "Carga 978,9 Kg · 0 prontos p/ expedição · 0 em rota"). Esse padrão reduz peso visual sem perder dado.

### P3 — Filtro/escopo/settings dentro do dashboard
- `gestor-fabrica/page.tsx:331-369`: **editor de operational settings** (cutoff time + lead days) dentro do dashboard. Quem entra pra ver operação não vai configurar; quem vai configurar não entra todo dia. Polui sem propósito.
- `OperationalDateScopeCard` aparece com **descrição longa** no topo de admin/page.tsx:520-529.
- **Ação:** mover settings editor para `/administrador` ou um modal "Configurações operacionais" acessível por ícone (engrenagem). Escopo de data fica como **barra fina** no topo, sem card cheio.

### P4 — Cards dentro de cards dentro de cards
- admin Composição Fabril (`administrador/page.tsx:645-735`): donut + lista de 4 status (cada um com sua mini-barra de progresso e mini-card) + 2 sub-cards "Pronto/Em campo" + N alertas, **tudo aninhado dentro do Card pai**.
- **Ação:** escolher UM elemento principal (donut OU lista, não os dois); secundários viram texto, não cards.

### P5 — Banners/explicações empilhados antes do conteúdo
- Modal Novo Pedido (loja/pedidos/page.tsx:803-937): banner de erro (sem loja), banner de duplicata, painel com **7 campos de metadado read-only**, banner cutoff, banner ajuste de janela, **OperationalSequenceCard explicativo** — tudo ANTES do produto aparecer.
- **Ação:** comprimir os 7 campos read-only em **1 linha de header**: `Pedido para [Loja ▾] · entrega 21/05 · venda 22/05 · prazo 18h`. Banners viram chip pequeno OU desaparecem se OK. `OperationalSequenceCard` fora do modal (ou só atrás de "ⓘ Como funciona").

### P6 — Sidebar com 22 módulos sempre visíveis
- A sidebar admin geral mostra **22 módulos visíveis** agrupados em 4 capacidades (Administrador / Gestor de Dados / Gestor de Fábrica / Chão / Loja). Para um único usuário "Administrador Geral" isso é muito.
- **Não tocar nav/permission-modules** (fora do escopo Gate 0), MAS: o usuário comum tem 4-6 módulos. A poluição percebida vem do papel "Administrador Geral" que vê tudo. Ação possível dentro do escopo: visualmente colapsar grupos de capacidade na sidebar (acordeão, colapsado por padrão exceto o ativo) — **estrutura intacta, ruído visual menor**. Pendente decisão.

---

## Telas críticas — análise direta

### 🎯 Dashboard Executivo (`/administrador`, `src/app/administrador/page.tsx`, 853 linhas)

**O que tem hoje, na ordem de aparição:**
1. Header (título + breadcrumb + badge "Governança" + descrição longa).
2. `OperationalDateScopeCard` — card grande de escopo temporal com descrição.
3. **6 KPI cards** (Pedidos Totais, Liberados, OPs em Progresso, Carga Produção, Prontos p/ Expedição, Entregas em Campo).
4. **Tendência de Carga** — gráfico de barras 7 dias + 2 mini-cards de legenda redundantes.
5. **Composição Fabril e Entrega** — donut + 4 linhas de status com mini-barra cada + 2 sub-cards "Pronto/Em campo" + N alertas operacionais.
6. **Carga por Categoria** — tabela com 5 colunas, paginada (6 por página).
7. **Acesso por Capacidade** — 22 ModuleCards em vários grupos.
8. **Delegação e segurança** — card com CTA "Abrir gestão de usuários".

**Diagnóstico:** isso é a tela inteira de admin **concatenada**. Cliente vê 6 manchetes numéricas, 2 gráficos competindo, 1 tabela, 22 cards de nav e 1 CTA redundante na primeira rolagem. Não há hierarquia: tudo grita.

**Ações concretas (ordem de impacto):**
- **Cortar a seção "Acesso por Capacidade" inteira** (linhas 792-833). Substituir por nada ou por 1 linha de 3 atalhos primários ("Usuários e Permissões", "Ocorrências da operação", "Configurações"). [-22 cards, maior impacto visual]
- **Cortar "Delegação e segurança"** (linhas 835-849). É só um link para `/administrador/usuarios` que já está na sidebar.
- **Reduzir 6 KPIs → 3 primários** (escolher: Pedidos Totais, OPs em Progresso, Entregas em Campo). Os outros viram linha de stats menor: `Liberados: N · Carga: 978,9 Kg · Prontos p/ expedição: N`.
- **Composição Fabril**: escolher donut OU lista, não os dois. Eliminar os 2 sub-cards "Pronto p/ expedição / Em campo" (informação duplicada com KPIs do topo).
- **Tendência de Carga**: remover os 2 mini-cards de legenda (linhas 626-641) — barras já são color-coded e têm tooltip.
- **OperationalDateScopeCard**: encolher para uma barra fina (sem card cheio + descrição longa).
- **Settings editor**: já não está aqui — bom.

**Resultado esperado:** dashboard cabe em 1 viewport, hierarquia clara: 3 KPIs grandes → 1 gráfico principal (Tendência) → tabela Categoria → fim. Cliente para de ver "muita informação".

### 🎯 Modal Novo Pedido (`/loja/pedidos`, `src/app/loja/pedidos/page.tsx`, dialog em :783-1166)

**O que tem hoje, dentro do modal:**
1. DialogHeader: "Pedido Diário" + "Faça seu pedido de produtos".
2. Banner se não há loja vinculada.
3. Banner se já existe pedido duplicado.
4. **Painel com 7 campos `disabled` em grid 6-colunas**: Loja (única editável) / Pedido lançado em / Base operacional / Recebimento previsto / Início das vendas / Horário Limite Global / Janela de Recebimento.
5. Banner "cutoff aplicado" se houve.
6. Banner "ajuste de janela" se houve.
7. **OperationalSequenceCard** — card explicativo de como pedido→entrega→venda funciona.
8. Busca + filtro de categoria + ações (linha 940).
9. **Tabela de produtos com `min-w-[1120px]`** — 5 colunas metadado + 7 colunas dia (provavelmente) + Total.
10. DialogFooter com botões.

**Diagnóstico:** o usuário tem **uma intenção** ("fazer pedido"), e o modal abre **dando um curso sobre o sistema** com 7 datas computadas, 2-3 banners contextuais e um cartão explicativo, antes de mostrar o produto. Isso É a "usabilidade toda confusa" do cliente.

**Ações concretas (ordem de impacto):**
- **Comprimir os 7 campos disabled em uma linha de header curta**: `Pedido para [Loja ▾] · entrega 21/05 · venda 22/05 (D+3) · prazo 18:00`. Cada item com tooltip "ⓘ" se precisar mais detalhe (lead-days, janela). Em vez de 7 inputs `disabled`, é 1 linha legível. [-6 fields, -1 painel inteiro]
- **Banners**: cutoff/ajuste viram **chip pequeno discreto** na linha de header se aplicável. Se não aplicável, sumem. Banner duplicado já chama atenção sozinho (vermelho) — mantém, é importante.
- **OperationalSequenceCard fora do modal** (linhas 929-936). Mover para um botão "ⓘ Como funciona" no header do modal. Quem é novo abre; quem usa todo dia não vê. [-1 explainer card]
- **Tabela**: reduzir colunas metadado. Hoje provavelmente Código + Produto + Categoria + Un. + Total + 7 dias = 12+ colunas, forçando scroll-x. Manter Produto + Un. + 7 dias + Total. Categoria vira **filtro** (já existe no topo). Código sai do default (vira tooltip ou coluna opcional). [-2 colunas, ganha respiro horizontal]
- **DialogContent size="full"**: questionar se precisa full-screen. Um modal de pedido NÃO precisa cobrir tudo — `size="3xl"` ou similar daria a impressão de "tarefa focada", não "app dentro de app".

**Resultado esperado:** abrir o modal mostra IMEDIATAMENTE o catálogo de produtos com os 7 dias. Header em 1 linha. Cliente fala "ah, é só fazer pedido mesmo".

### Lista de Pedidos (`/loja/pedidos` página, mesmo arquivo, fora do modal)

**O que tem hoje:** Cabeçalho enxuto (já refinado por mim na sessão de hoje) + 5 KPIs + DataTable.

**Diagnóstico:** com o de-box atual, está OK. 5 KPIs ainda é 1 a mais que ideal, mas próximo do limite aceitável.

**Ação leve:** dos 5 KPIs (Total, Agendado, Em Produção, Entregas, Ocorrências), Total é redundante com a tabela. Cortar Total → 4 KPIs. Ou agrupar todos em uma linha-stats menor e dar protagonismo à tabela.

### Outros dashboards (gestor-fabrica, loja home, gestor-dados, chao-fabrica, admin-master)

Todos sofrem da **mesma receita**: PageLayout + OperationalDateScopeCard + N KPIs + N ModuleCards. Aplicar P1+P2:
- **gestor-fabrica/page.tsx** (583 linhas): cortar ModuleCards (linhas 559-573), reduzir 5 KPIs → 3, **mover o settings editor (l.331-369) para fora do dashboard** (modal de Configurações Operacionais, acessível por ícone). Isso é o maior offensor depois do admin.
- **loja/page.tsx** (232 linhas): cortar ModuleCards (l.208-217), 5 KPIs → 3. Cliente da loja só quer ver "quantos pedidos abertos meus" + "alguma ocorrência?".
- **gestor-dados/page.tsx** (204 linhas): cortar ModuleCards, 4 KPIs → 3.
- **chao-fabrica/page.tsx** (135 linhas — já o mais enxuto): cortar ModuleCards, 5 KPIs → 3.
- **administrador-master/page.tsx** (169 linhas): cortar ModuleCards de cada Card, 6 KPIs → 3.

### Telas operacionais densas (tamanho indica complexidade)

| Tela | LOC | Problema previsível |
|---|---:|---|
| `administrador/usuarios/page.tsx` | 1591 | Matriz de permissões `min-w-[1500px]`; cliente que ENTRA aqui é admin — ok ser denso. Mas hierarquia + filtros + colunas internas precisam de polimento. |
| `gestor-fabrica/sublinhas-producao` | 1456 | Grid drag-drop. Cliente vê isso? Provavelmente não diariamente. Postergar. |
| `gestor-fabrica/pedidos` | 682 | Tabela operacional. Verificar se tem KPIs/filtros/banners empilhados também. |
| `gestor-fabrica/ordens-producao` | 650 | Idem. |
| `gestor-fabrica/expedicao` | 451 | Menor. |

**Não auditei essas linha-a-linha agora** — se o cliente reclamar de alguma específica, eu olho. Padrões P1-P6 provavelmente aparecem todos.

---

## Sequência recomendada (ataque por impacto visível ao cliente)

1. **🥇 Cortar ModuleCards de todos os 6 dashboards** (P1) — mudança simples, máximo "ar" novo no app. ~30 min, 6 arquivos, sem mudar regra. Cliente vê o app "respirar" imediatamente.
2. **🥈 Dashboard Executivo: kit completo** (KPIs 6→3 + cortar Composição duplicada + barra de escopo fina + remover Delegação card). 1 tela, ataque profundo. Cliente vê o efeito "muita informação" sumir na primeira tela.
3. **🥉 Modal Novo Pedido: header 1-linha + tirar OperationalSequenceCard + reduzir colunas da tabela**. Resolve "usabilidade confusa" no fluxo mais usado da loja.
4. **gestor-fabrica/page.tsx**: tirar settings editor (mover p/ modal) + KPIs 5→3.
5. **Outros 4 dashboards**: aplicar mesma régua (KPIs 5→3, sem ModuleCards).
6. **Sidebar (opcional)**: grupos colapsados por padrão, só o do papel ativo expandido. Se o usuário pedir, faço; senão pula.

Cada item acima é um commit isolado, revertível, com validação visual **antes** de commitar (lição da sessão).

---

## O que NÃO entra aqui (deliberado)

- Não mexer em regra de negócio, fluxo, dado, permissão, engine, rota.
- AJ-0009 continua FORA.
- Telas de impressão (`/impressao/*`) FORA — densidade lá é proposital.
- Settings/matrix internas só polidas se o cliente reclamar — não preventivo.

---

## Honestidade sobre a Onda 1

A Onda 1 (fundação) entregou plumbing técnico real (toast, skeleton, tabela responsiva no mobile, botão loading, opacity-fix de raiz, de-box). **Nada disso ataca "poluído"**, porque poluído é decisão de informação, não plumbing. Cliente está certo: pra ele, mudou pouco. Esta auditoria endereça **o problema real**. As entregas da Onda 1 ficam por baixo (continuam úteis quando o usuário dispara as ações), mas o trabalho que o cliente vai notar é o que esta auditoria propõe.
