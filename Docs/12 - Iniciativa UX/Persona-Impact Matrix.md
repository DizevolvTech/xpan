# Persona-Impact Matrix

> Grade problema × 6 personas. Severidade por persona: 🔴 crítico · 🟡 importante ·
> 🟢 polimento · ➖ não afeta. Onda 0, 2026-05-19. Companion de [[UX Audit — Sistema]].

## Densidade por persona (lente de leitura da matriz)

| Persona | Contexto de uso | Lente de densidade | Impacto-chave |
|---|---|---|---|
| [[Loja]] | Celular/tablet no balcão, sob pressa, varejo | **Touch / mobile-first.** Hit target ≥44px, zero scroll horizontal, feedback imediato | Tabela responsiva + toast = make-or-break |
| [[Chão de Fábrica]] | Tablet/celular no piso de produção, mãos ocupadas | **Touch, glanceable.** Estado claro à distância, alvos grandes | Skeleton + status legível |
| [[Gestor de Fábrica]] | Desktop, sessões longas, decisão operacional | **Densa, desktop.** Muita informação por tela é desejável | Estados de carregamento + a11y DnD |
| [[Gestor de Dados]] | Desktop, cadastro/edição em lote | **Densa, formulários.** Feedback de salvar é crítico | Toast de salvar |
| [[Administrador]] | Desktop, governança, esporádico | **Densa, matriz.** Tolera complexidade, precisa de clareza | Matriz responsiva + token |
| [[Administrador Master]] | Desktop, modo read-only-tenant, auditoria | **Densa, read-only.** Afordância desabilitada, não removida | Consistência visual cross-tenant |

> Regra de ouro: **loja e chão = touch-first** (penalize scroll horizontal e alvos
> pequenos com 🔴); **gestor/admin/master = densa** (densidade não é defeito; falta de
> feedback e inconsistência sim).

---

## Matriz — Problemas FUNDAÇÃO (Onda 1, transversais)

| Problema (item) | Loja | Chão | G.Fábrica | G.Dados | Admin | A.Master | Densidade nota |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| F-1 Sem toast/feedback (`UX-0002`) | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | Loja/chão: sem confirmação re-submetem (duplicidade). Gestor: libera ordem crítica às cegas |
| F-2 Sem skeleton / CLS (`UX-0003`) | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🟡 | Touch sente o pulo de layout mais; dashboards densos toleram melhor mas confundem |
| F-3 DataTable não-responsivo (`UX-0001`) | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🟡 | Loja no balcão = inutilizável. Desktop tolera scroll-x, mas matriz admin sofre |
| F-4 Tokens/opacidade ad-hoc (`UX-0005`) | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | Uniforme: consistência visual afeta todos igualmente |
| F-5 Contraste WCAG não auditado (`UX-0006`) | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🟡 | Loja/chão em ambiente com luz variável (balcão/piso) = legibilidade crítica |
| F-5 Botão enviando (`UX-0004`) | 🔴 | 🟡 | 🟡 | 🟡 | 🟡 | ➖ | Loja: duplo-clique = pedido duplicado ([[Dívida Técnica#D03]]). Master não escreve |
| F-5 Empty state (`UX-0007`) | 🟡 | 🟡 | 🟡 | 🟢 | 🟢 | 🟢 | "Nenhum pedido" sem orientação trava a loja iniciante |
| F-6 Setores/Categorias (`UX-0008`) | ➖ | ➖ | ➖ | 🟡 | 🟢 | ➖ | Só quem navega catálogo (gestor-dados) e quem governa (admin) |
| F-7 Normalização shared/layout (`UX-0009`) | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | Polimento uniforme; `profile-page` cobre 6 perfis de uma vez |
| F-8 Densidade por persona (`UX-0010`) | 🟡 | 🟡 | ➖ | ➖ | ➖ | ➖ | Ganho só para touch (loja/chão); densa permanece densa no desktop |

---

## Matriz — Problemas por tela (piloto Onda 2)

| Tela (item) | Loja | Chão | G.Fábrica | G.Dados | Admin | A.Master | Nota |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `loja/pedidos` (`UX-0011`) | 🔴 | ➖ | ➖ | ➖ | ➖ | 🟢 | Tela mais usada da loja; touch-first; AJ-0009 fora. Master só vê (read-only) |
| `gestor-fabrica/ordens-producao` (`UX-0012`) | ➖ | 🟡 | 🔴 | ➖ | ➖ | 🟢 | Chão visualiza; gestor opera. 8+ colunas, mobile ruim |
| `gestor-fabrica/pedidos` (`UX-0013`) | ➖ | ➖ | 🔴 | ➖ | ➖ | 🟢 | `window.confirm` em cancelar/liberar (ação crítica sem feedback) |
| `gestor-fabrica/page.tsx` (`UX-0014`) | ➖ | ➖ | 🟡 | ➖ | ➖ | 🟢 | KPIs "..." sem skeleton; dashboard denso |
| `gestor-fabrica/sublinhas-producao` (`UX-0015`) | ➖ | ➖ | 🔴 | ➖ | ➖ | 🟢 | **DnD só mouse — barreira total p/ teclado.** WCAG 2.1.1 |
| `administrador/usuarios` (`UX-0016`) | ➖ | ➖ | ➖ | ➖ | 🔴 | 🟡 | `min-w-[1500px]` (pior scroll-x). Master audita em read-only |

---

## Leitura executiva da matriz

- **Loja é a persona de maior risco UX.** 4 itens 🔴 na fundação (F-1, F-2, F-3, F-5
  contraste/botão) + a tela mais usada do sistema (`loja/pedidos`). É a persona com
  contexto mais hostil (celular, balcão, pressa) e a única onde uma falha de feedback
  vira **dado errado** (pedido duplicado — [[Dívida Técnica#D03]]). Priorizar a cascata
  da fundação resolve a maior parte do risco dela antes de tocar a tela.
- **Chão de Fábrica espelha a loja** (touch, glanceable) mas com menos itens de escrita
  → 🔴 em F-1/F-2/F-3, 🟡 no resto.
- **Gestor de Fábrica** carrega o maior número de telas-piloto críticas (4 de 6) — é o
  validador natural do piloto no Gate 2.
- **Administrador Master** é majoritariamente 🟢: read-only, não escreve, herda só a
  consistência visual. A afordância desabilitada (não removida) já está correta no
  `DataTable` — **não regredir**.
- **Gestor de Dados / Administrador**: densidade é aceitável; o que dói é falta de
  feedback (toast) e a matriz de permissão não-responsiva.

→ Priorização quantificada em [[Backlog UX (RICE)]]. Metas em [[UX PRD]].
