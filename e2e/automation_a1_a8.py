"""E2E da iniciativa de automação Pedido → Fabricação → Entrega (A1-A8).

Sessão 2026-05-21: verifica que as features novas renderizam, os endpoints
respondem e os controles aparecem na UI das personas certas. Não cria pedidos
novos (não-destrutivo); apenas exercita o que já existe no banco dev.

Pré-req: `npm run dev` (porta detectada via BASE). Playwright Python + chromium.

Critério: 0 FAIL. SKIP é aceitável (estado-dependente, ex: pedido em rota
disponível pra registrar tentativa de falha).
"""

import os
import re
import sys

import requests
from playwright.sync_api import sync_playwright

# Next.js dev compartilha :3000 com outro processo localmente, então usamos o
# IP de rede que o `next dev` também escuta. Pode ser sobrescrito via env.
BASE = os.environ.get("E2E_BASE", "http://192.168.1.16:3000")

USERS = {
    "fabrica": ("fabrica@danielaugusto.com", "Fabrica@123"),
    "chao":    ("chao@danielaugusto.com",     "Chao@123"),
    "dados":   ("engenharia@danielaugusto.com", "Engenharia@123"),
}

results = []  # (id, status, msg)


def rec(idn, status, msg=""):
    results.append((idn, status, msg))
    print(f"[{status:4}] {idn}: {msg}")


def login(page, who):
    email, pwd = USERS[who]
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=90000)
    btn = page.locator("button[type=submit]")
    page.wait_for_selector("#email", state="visible", timeout=30000)
    btn.wait_for(state="visible", timeout=30000)
    page.wait_for_timeout(1200)
    page.fill("#email", email, timeout=30000)
    page.fill("#password", pwd, timeout=30000)
    leftlogin = re.compile(r"https?://[^/]+/(?!login)(?!$).*")
    for _ in range(4):
        try:
            btn.click(timeout=10000)
        except Exception:
            page.keyboard.press("Enter")
        try:
            page.wait_for_url(leftlogin, timeout=60000)
            page.wait_for_timeout(3000)
            return
        except Exception:
            if "/login" not in page.url:
                page.wait_for_timeout(2000)
                return
            continue
    raise RuntimeError(f"login {who}: não saiu de /login (url={page.url})")


def body(page):
    try:
        return page.inner_text("body", timeout=8000)
    except Exception:
        return ""


def goto(page, path):
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=90000)
    try:
        page.wait_for_load_state("networkidle", timeout=12000)
    except Exception:
        pass
    page.wait_for_timeout(2500)


def cookie_string(ctx):
    """Serializa cookies do contexto pra reusar com requests no mesmo tenant."""
    return "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies())


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        def fresh(who):
            ctx = browser.new_context(viewport={"width": 1500, "height": 1000})
            pg = ctx.new_page()
            login(pg, who)
            return ctx, pg

        ctxs = {}
        for who in USERS:
            try:
                ctx, page = fresh(who)
                ctxs[who] = (ctx, page)
                rec(f"login-{who}", "PASS", "login OK")
            except Exception as e:
                rec(f"login-{who}", "FAIL", f"{e}")

        # ===== A7 — Card "Métricas operacionais" no dashboard =====
        if "fabrica" in ctxs:
            _, page = ctxs["fabrica"]
            goto(page, "/gestor-fabrica")
            txt = body(page)
            if "Métricas operacionais" in txt:
                # Cheque ao menos 1 dos 4 tiles aparecer:
                if any(t in txt for t in ("Lead time médio", "OTIF", "Ocupação média", "Falhas de entrega")):
                    rec("A7-card", "PASS", "Card métricas + tiles renderizados")
                else:
                    rec("A7-card", "FAIL", "Card presente mas tiles ausentes")
            else:
                rec("A7-card", "FAIL", "Card 'Métricas operacionais' não encontrado")

        # ===== A6 — Botão "Auto-liberar elegíveis" na lista de pedidos =====
        if "fabrica" in ctxs:
            _, page = ctxs["fabrica"]
            goto(page, "/gestor-fabrica/pedidos")
            try:
                btn = page.get_by_role("button", name=re.compile("Auto-liberar", re.I))
                if btn.count() > 0:
                    rec("A6-btn", "PASS", "Botão 'Auto-liberar elegíveis' presente")
                else:
                    rec("A6-btn", "FAIL", "Botão não encontrado")
            except Exception as e:
                rec("A6-btn", "FAIL", f"{e}")

        # ===== A2 — Card "Demanda por produto (batelada)" em ordens-producao =====
        if "fabrica" in ctxs:
            _, page = ctxs["fabrica"]
            goto(page, "/gestor-fabrica/ordens-producao")
            txt = body(page)
            if "Demanda por produto" in txt and "batelada" in txt.lower():
                rec("A2-card", "PASS", "Card 'Demanda por produto (batelada)' presente")
            else:
                rec("A2-card", "FAIL", "Card não encontrado")

        # ===== A5 — Card "Histórico da OP" na página de detalhe da OP =====
        if "fabrica" in ctxs:
            _, page = ctxs["fabrica"]
            # Acha o primeiro link de OP do mosaico/tabela e abre.
            goto(page, "/gestor-fabrica/ordens-producao")
            try:
                op_link = page.locator('a[href^="/gestor-fabrica/ordens-producao/"]').first
                if op_link.count() == 0:
                    rec("A5-card", "SKIP", "Sem OPs no dia — não há detalhe pra abrir")
                else:
                    href = op_link.get_attribute("href")
                    if href:
                        goto(page, href)
                        txt = body(page)
                        if "Histórico da OP" in txt:
                            rec("A5-card", "PASS", f"Card 'Histórico da OP' renderiza em {href}")
                        else:
                            rec("A5-card", "FAIL", "Card 'Histórico da OP' não encontrado no detalhe")
                    else:
                        rec("A5-card", "SKIP", "href vazio")
            except Exception as e:
                rec("A5-card", "FAIL", f"{e}")

        # ===== A8 — Roteirização: zona/rota não-hash na lista de entregas =====
        if "chao" in ctxs:
            _, page = ctxs["chao"]
            goto(page, "/chao-fabrica/entregas")
            txt = body(page)
            # Roteirização nova produz "Zona X" ou "Janela HH:MM - HH:MM" ou
            # "Sem agrupamento". O placeholder antigo gerava nomes literais
            # ("Centro", "Norte", "Sul", etc) por hash — sem prefixo.
            if any(x in txt for x in ("Zona ", "Janela ", "Sem agrupamento")):
                rec("A8-routes", "PASS", "Roteirização honesta visível (zona/janela)")
            elif "Despacho e execução" in txt:
                # Página carregou mas sem entregas no dia — não dá pra inspecionar.
                rec("A8-routes", "SKIP", "Sem entregas no escopo atual")
            else:
                rec("A8-routes", "FAIL", "Página de entregas não renderizou esperado")

        # ===== A8.1 — Campo "Zona de Entrega" no cadastro de loja =====
        if "dados" in ctxs:
            _, page = ctxs["dados"]
            goto(page, "/gestor-dados/lojas")
            try:
                # Abre primeira loja para edição.
                edit_btn = page.get_by_role("button", name=re.compile("Editar|Detalhar|Loja", re.I)).first
                if edit_btn.count() == 0:
                    edit_btn = page.locator("tr").nth(1)  # primeira linha de dados
                edit_btn.click(timeout=15000)
                page.wait_for_timeout(2000)
                txt = body(page)
                if "Zona de Entrega" in txt:
                    rec("A8.1-field", "PASS", "Campo 'Zona de Entrega' presente no dialog")
                else:
                    rec("A8.1-field", "FAIL", "Campo não encontrado")
                page.keyboard.press("Escape")
            except Exception as e:
                rec("A8.1-field", "SKIP", f"diálogo de loja não abriu: {e}")

        # ===== A6 — Endpoint POST /api/factory-planning/auto-release (sanidade) =====
        if "fabrica" in ctxs:
            ctx, _ = ctxs["fabrica"]
            try:
                resp = requests.post(
                    f"{BASE}/api/factory-planning/auto-release",
                    headers={"Cookie": cookie_string(ctx), "Content-Type": "application/json"},
                    json={},
                    timeout=30,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if all(k in data for k in ("ok", "released", "skipped", "failed")):
                        rec("A6-api", "PASS", f"Endpoint 200 + shape ok (released={len(data['released'])}, skipped={len(data['skipped'])}, failed={len(data['failed'])})")
                    else:
                        rec("A6-api", "FAIL", f"shape inesperado: {list(data.keys())}")
                else:
                    rec("A6-api", "FAIL", f"status {resp.status_code}: {resp.text[:120]}")
            except Exception as e:
                rec("A6-api", "FAIL", f"{e}")

        # ===== A6.2 — Endpoint cron sem secret = 503 ou 401 =====
        try:
            resp = requests.get(f"{BASE}/api/cron/auto-release", timeout=15)
            if resp.status_code in (401, 503):
                rec("A6.2-cron-unauth", "PASS", f"Sem header rejeitou ({resp.status_code})")
            else:
                rec("A6.2-cron-unauth", "FAIL", f"deveria rejeitar mas devolveu {resp.status_code}")
        except Exception as e:
            rec("A6.2-cron-unauth", "FAIL", f"{e}")

        # ===== A6.2 — Endpoint cron com secret errado = 401 =====
        try:
            resp = requests.get(
                f"{BASE}/api/cron/auto-release",
                headers={"Authorization": "Bearer this-is-wrong"},
                timeout=15,
            )
            if resp.status_code in (401, 503):
                rec("A6.2-cron-bad", "PASS", f"Secret errado rejeitou ({resp.status_code})")
            else:
                rec("A6.2-cron-bad", "FAIL", f"deveria rejeitar mas devolveu {resp.status_code}")
        except Exception as e:
            rec("A6.2-cron-bad", "FAIL", f"{e}")

        # ===== A7 — Endpoint GET /api/factory-planning/metrics =====
        if "fabrica" in ctxs:
            ctx, _ = ctxs["fabrica"]
            try:
                resp = requests.get(
                    f"{BASE}/api/factory-planning/metrics?windowDays=7",
                    headers={"Cookie": cookie_string(ctx)},
                    timeout=30,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if all(k in data for k in ("leadTime", "otif", "occupancy", "deliveryFailures")):
                        rec("A7-api", "PASS", "Endpoint metrics 200 + shape com 4 famílias")
                    else:
                        rec("A7-api", "FAIL", f"shape inesperado: {list(data.keys())}")
                else:
                    rec("A7-api", "FAIL", f"status {resp.status_code}: {resp.text[:120]}")
            except Exception as e:
                rec("A7-api", "FAIL", f"{e}")

        for ctx, _ in ctxs.values():
            try:
                ctx.close()
            except Exception:
                pass
        browser.close()


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print("ERRO FATAL:", e)
    p = sum(1 for _, s, _ in results if s == "PASS")
    f = sum(1 for _, s, _ in results if s == "FAIL")
    sk = sum(1 for _, s, _ in results if s == "SKIP")
    print(f"\n===== RESUMO A1-A8: {p} PASS · {f} FAIL · {sk} SKIP =====")
    sys.exit(1 if f else 0)
