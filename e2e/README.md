# e2e/ — Não-regressão (Iniciativa UX)

Âncora de não-regressão da [[Iniciativa UX]] (métrica **M6** do `Docs/12 - Iniciativa UX/UX PRD.md`):
versiona o runner E2E que antes vivia em `/tmp` (resolução do **D-0** no Gate 0).

## O que cobre

- **Login real das 6 personas** (master, admin, gestor-dados, gestor-fábrica, chão, loja) + landing sem erro de app.
- **Smoke das 6 telas-piloto** da Onda 2 (`loja/pedidos`, `gestor-fabrica/pedidos`, `gestor-fabrica/ordens-producao`, `gestor-fabrica` dashboard, `gestor-fabrica/sublinhas-producao`, `administrador/usuarios`): a tela carrega sem erro de aplicação.
- **Asserts AJ das Ondas 1-3** (AJ-0001/0002/0003/0005/0006/0012/0013/0016/0017/0020): marcadores que **não podem regredir** durante o polimento de UX.

Não destrutivo (não cria pedidos). `SKIP` = data-dependent (sem dado no momento) — **não é FAIL**.

## Pré-requisitos

- `npm run dev` rodando em `http://localhost:3000` (Supabase **dev** real via `.env.local`).
- Playwright Python + chromium instalado; `requests` (já disponível no ambiente).
- Credenciais demo em texto puro: `src/lib/demo-credentials.ts` (todas funcionam no Supabase dev).

## Como rodar

```bash
npm run dev            # terminal 1 (porta 3000)
python3 e2e/regression.py   # terminal 2
```

Saída termina com `===== RESUMO: N PASS · M FAIL · K SKIP =====`. **Exit 0 sse 0 FAIL.**

## Critério do gate (Onda 1 / Onda 2)

**0 FAIL** e contagem de PASS **≥ baseline**. Qualquer FAIL = parada e rollback do item (regra do plano de orquestração).

**Baseline (2026-05-19, pré-Onda 1):** `26 PASS · 0 FAIL · 1 SKIP` (SKIP = AJ-0003 data-dependent). Todo gate de onda deve manter `0 FAIL` e `PASS ≥ 26`.

## Lições de flakiness (encodadas no script — não remover)

1. **Contexto novo por persona** (cookies limpos): senão `/login` redireciona o já-logado e o `#email` some.
2. **Esperar o form hidratar** antes de submeter (botão visível + ~1.2s) e **re-submeter em loop** (até 4x) enquanto continuar em `/login` — clique antes da hidratação não dispara o handler. Era a causa-raiz da flakiness.
3. Dashboards pesados (gestor-fábrica) compilam a frio no 1º hit autenticado → `wait_for_url`/timeouts generosos (60s+).
4. **Não** depender de `networkidle` — dashboards fazem polling, nunca ficam idle.
5. Asserções por **locator com auto-wait** (`get_by_text(...).wait_for`), nunca `inner_text("body")` único em DOM pesado (timeout/falso-negativo).

## `live_cycle.py` — ciclo real (modelo `FACTORY_OPENS_ORDERS`)

Ciclo ponta-a-ponta do modelo ATUAL (flag default ON): **fábrica abre pedidos da semana
→ loja preenche → fábrica libera → produção avança**. Substitui o cenário obsoleto de
`full_flow_a1_a8.py` (que criava pedido do zero via `POST /store-orders` — hoje bloqueado
pela flag). Valida os erros do cliente do checklist XPAN:

- **F1 / falha-grave** — pedido preenchido deve ser liberável e liberar (não travar).
- **Item 1** — mesma entrega bate entre catálogo, planning e expedição.
- **Item 3** — cada produto entrega em produção + SEU lead, não no D+X global.
- **Item 2** (mesmo-dia, gap 0) — coberto por unit test (`engine.test.ts`); ao vivo,
  flipar `expedition_lead_days` de um produto p/ 0 mostra entrega = produção.

**Mutativo** (abre pedidos da semana de 1 loja, preenche/libera 1, avança 1 OP). Imprime o
**SQL de cleanup** no fim. Última run: `9 PASS · 0 FAIL · 0 SKIP`. Rodar só em dev.

```bash
python3 e2e/live_cycle.py    # E2E_STORES/E2E_REF/E2E_BASE p/ override
```

## Notas

- `npm run supabase:auth:bootstrap` é desnecessário (credenciais demo já funcionam) e bloqueado pelo harness.
- AJ-0011 (produção→expedição) não é cobrível por E2E de UI — validação manual.
- Playwright Python não tem wheels no python3.14 do sistema → usar venv dedicado (`python3 -m venv`), `pip install playwright requests`, `python -m playwright install chromium`.
- Histórico/contexto: ver memória do projeto `e2e-playwright-setup`.
