# 12 - Iniciativa UX

> Iniciativa estruturada de melhoria de UX/UI do sistema, orquestrada em 3 agentes
> (PM/UX → Refinador → Front-End Sênior) em ondas com gates de aprovação.
>
> Diferente de [[Backlog de Ajustes]] (demandas operacionais vindas de call/bug) e de
> [[Dívida Técnica]] (estrutural/arquitetural), esta trilha é uma **varredura proativa
> de qualidade de experiência** — sem mudar regra de negócio.

## Índice

- `UX Audit — Sistema.md` — inventário de problemas por tela + persona (gerado na Onda 0)
- `Persona-Impact Matrix.md` — grade problema × 6 personas com severidade
- `Backlog UX (RICE).md` — lista única `UX-####`, priorizada (RICE/ICE), mapeada a caminhos + onda
- `UX PRD.md` — metas, métricas de sucesso, não-objetivos, decisões em aberto
- `specs/` — uma spec de refinamento por item/tela (`UX-#### — <tela-ou-primitivo>.md`)

## Convenção

Cada item tem ID `UX-####` com sequência crescente. O ID nunca é reaproveitado.
Namespace separado do operacional `AJ-####`; cross-link só quando houver sobreposição
(ex.: `loja/pedidos` ↔ AJ-0009 — fora desta iniciativa).

| Campo | Valor |
|---|---|
| ID | `UX-####` |
| Onda | 0 (auditoria) · 1 (fundação) · 2 (piloto) · 3 (restante, condicional) |
| Severidade | 🔴 crítico · 🟡 importante · 🟢 polimento |
| Categoria | Visual · Estado · Responsivo · A11y · IA-na-tela · Terminologia · Token |
| Status | A-fazer · Em-andamento · Concluído · Adiado |
| RICE | Reach · Impact · Confidence · Effort (score) |
| Área afetada | wikilinks + caminho absoluto do(s) arquivo(s) |

## Decisões de escopo (confirmadas)

- **Abrangência:** piloto primeiro (Onda 0 + 1 + 2), reavalia antes da Onda 3.
- **AJ-0009 (modelo de pedido da loja):** FORA — só polimento de apresentação em `loja/pedidos`.
- **IA:** visual + reorganização **dentro** da tela + unificação de terminologia. **Não** mexe em navegação nem em `permission-modules`.
- **Dark mode:** FORA desta iniciativa.

## Guard-rails (todo agente, toda onda)

- Sem mudança funcional / de regra (nada em `src/lib/factory-planning/**`, `src/lib/supabase-data/**`, lógica de `permission-modules.ts`, engine).
- Reuso antes de criar: checar os 18 shared + 18 shadcn antes de propor primitivo novo.
- Modo read-only-tenant respeitado (afordância desabilitada, não removida).
- Acessibilidade WCAG AA.
- Um `UX-####` por commit; mensagem + Changelog referenciam o ID.

## Fluxo recomendado

1. **Onda 0** — `product-pm-ux-strategist` gera audit + matriz + Backlog RICE + PRD. **Gate 0:** aprovação do backlog/PRD.
2. **Por item** — `ui-refiner-regenerator` produz `specs/UX-#### — ….md` → aprovação → `frontend-design-senior` implementa + autorreview → verificação → commit isolado.
3. Ao executar: atualizar status no `Backlog UX (RICE).md` **e** registrar no [[10 - Changelog Vivo/2026-05|Changelog do mês]] (template em `Docs/10 - Changelog Vivo/Template — Entrada de Changelog.md`).
4. Ao concluir item: `Concluído` + `Concluído em` data; manter no backlog para histórico.
5. **Gates por onda:** `npm run lint`, `npm run build`, `npx tsc --noEmit`, `npm test`, Playwright 17-PASS por persona, smoke visual por persona.

## Status atual (2026-05-19)

- **Onda 0:** concluída — auditoria entregue pelo agente PM. Artefatos gerados:
  [[UX Audit — Sistema]], [[Persona-Impact Matrix]], [[Backlog UX (RICE)]], [[UX PRD]].
  16 itens `UX-0001`…`UX-0016` (10 FUNDAÇÃO Onda 1, 6 tela Onda 2).
- **Gate 0:** ✅ aprovado (2026-05-19). Decisões D-0…D-6 resolvidas — ver
  [[UX PRD#10. Resolução do Gate 0 (2026-05-19 — aprovado pelo usuário)]].
  D-1 → "Categorias"; D-2 → ajuste mínimo OKLCH autorizado.
- **D-0 (pré-requisito):** runner E2E versionado em `e2e/regression.py` + `e2e/README.md`
  (6 personas + smoke piloto + asserts AJ). Baseline 0-FAIL antes de iniciar a Onda 1.
- **Próximo:** Onda 1 — fundação, ordem `UX-0005 → UX-0002/0003/0004/0007 → UX-0001 →
  UX-0006 → UX-0008 → UX-0009 → UX-0010`. Loop: Refinador spec → aprovação → Front-End.
- Plano de orquestração: `~/.claude/plans/fa-a-um-planejamento-para-silly-ember.md`.
