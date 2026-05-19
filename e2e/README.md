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

## Notas

- `npm run supabase:auth:bootstrap` é desnecessário (credenciais demo já funcionam) e bloqueado pelo harness.
- AJ-0011 (produção→expedição) não é cobrível por E2E de UI — validação manual.
- Histórico/contexto: ver memória do projeto `e2e-playwright-setup`.
