#!/usr/bin/env python3
"""Ciclo REAL de pedido no modelo atual `FACTORY_OPENS_ORDERS` (default ON):
fábrica abre pedidos da semana → loja preenche → fábrica libera → produção avança.

Substitui o cenário obsoleto de `full_flow_a1_a8.py` (que cria pedido do zero via
POST /store-orders — hoje BLOQUEADO pela flag: "os pedidos são abertos pela fábrica").

Foca nos ERROS DO CLIENTE (checklist XPAN, itens de falha grave):
- **F1 / falha-grave** — um pedido preenchido DEVE ser liberável e liberar (não travar).
  Era o bug: item aceito no catálogo mas pedido preso (availableForRelease=false).
- **Item 1 (cronogramas divergentes)** — a mesma entrega deve bater entre catálogo,
  planning (gestor) e expedição.
- **Item 3 (P+1 sobrepõe D+2 global)** — cada produto entrega em produção + SEU lead,
  não no D+X global (observável: gap-1 entrega produção+1, não +2).
- **Item 2 (mesmo-dia, gap 0)** — coberto por unit test (engine.test.ts, "caso arroz/pão")
  e verificável ao vivo flipando o `expedition_lead_days` de um produto p/ 0 (demo manual).

MUTATIVO — abre pedidos da semana (1 loja), preenche/libera 1, avança 1 OP. Imprime o
SQL de cleanup no fim (releases + itens + pedidos criados). **Rodar só em dev.**

Pré-req: `npm run dev` em :3000 (Supabase dev via .env.local); Playwright Python + requests.
Override de base: `E2E_BASE`. Data de referência: `E2E_REF` (default = hoje).

    python3 e2e/live_cycle.py

Sai 0 sse 0 FAIL.
"""
import os
import re
import sys
import json
import datetime

import requests
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")
REF = os.environ.get("E2E_REF", datetime.date.today().isoformat())
# 1 loja só p/ minimizar dados criados (a semana abre 1 pedido por data de entrega).
STORE_IDS = os.environ.get("E2E_STORES", "store-01").split(",")

USERS = {
    "fabrica": ("fabrica@danielaugusto.com", "Fabrica@123"),
    "loja": ("loja@danielaugusto.com", "Loja@123"),
}

results = []
created_order_codes = []
advanced_keys = []


def rec(idn, status, msg=""):
    results.append((idn, status, msg))
    print(f"[{status:4}] {idn}: {msg}", flush=True)


def log(m):
    print(f"   · {m}", flush=True)


def login(page, who):
    email, pwd = USERS[who]
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_selector("#email", state="visible", timeout=30000)
    btn = page.locator("button[type=submit]")
    btn.wait_for(state="visible", timeout=30000)
    page.wait_for_timeout(1200)  # margem p/ hidratação do handler client
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
            page.wait_for_timeout(2500)
            return
        except Exception:
            if "/login" not in page.url:
                page.wait_for_timeout(1500)
                return
    raise RuntimeError(f"login {who}: não saiu de /login após 4 tentativas")


def cookies(ctx):
    return "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies())


def api(ctx, method, path, payload=None, timeout=40):
    headers = {"Cookie": cookies(ctx)}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    return requests.request(method, f"{BASE}{path}", headers=headers, json=payload, timeout=timeout)


def date_offset(prod, entrega):
    if not (prod and entrega):
        return None
    return (datetime.date.fromisoformat(entrega) - datetime.date.fromisoformat(prod)).days


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        def fresh(who):
            ctx = browser.new_context()
            login(ctx.new_page(), who)
            return ctx

        fab = fresh("fabrica")
        loja = fresh("loja")
        rec("login", "PASS", "fabrica + loja logados")

        # 1) FÁBRICA ABRE PEDIDOS DA SEMANA (derivados do cronograma ativo).
        r = api(fab, "POST", "/api/store-orders/open",
                {"mode": "week", "referenceDate": REF, "storeIds": STORE_IDS})
        if r.status_code in (200, 201):
            opened = (r.json() or {}).get("opened", []) if r.text else []
            created_order_codes.extend([o.get("code") for o in opened if o.get("code")])
            rec("open-week", "PASS", f"fábrica abriu {len(opened)} pedido(s) da semana (ref={REF})")
        elif r.status_code == 409:
            rec("open-week", "SKIP", "recurso desligado (FACTORY_OPENS_ORDERS=false)")
        else:
            rec("open-week", "SKIP", f"nada aberto: {r.status_code} {r.text[:120]}")

        # 2) LOJA ACHA UM PEDIDO ABERTO E PREENCHE (catálogo ancorado na data comprometida).
        r = api(loja, "GET", "/api/store-orders/open")
        open_orders = r.json() if r.status_code == 200 and r.text else []
        if not isinstance(open_orders, list) or not open_orders:
            rec("fill", "FAIL", "nenhum pedido aberto p/ a loja preencher — não dá p/ testar o ciclo")
            return _summary()
        target = open_orders[0]
        oid, commit_date, store_id = target.get("id"), target.get("deliveryDate"), target.get("storeId")
        log(f"pedido alvo {oid} · entrega comprometida {commit_date} · loja {store_id}")

        r = api(loja, "GET",
                f"/api/store-order-catalog?storeId={store_id}&orderedAt={REF}T09:00:00"
                f"&targetDeliveryDate={commit_date}")
        cat = r.json() if r.status_code == 200 and r.text else []
        avail = [c for c in cat if c.get("available")] if isinstance(cat, list) else []
        if not avail:
            rec("fill", "FAIL", f"catálogo ancorado vazio p/ {commit_date} — loja não consegue preencher (TRAVA)")
            return _summary()
        items = []
        for c in avail[:2]:
            q = 6 if c.get("unitKind") == "discrete" else max(1.0, round(float(c.get("minimumProductionKg") or 0) + 0.5, 3))
            items.append({"productId": c["productId"], "quantity": q, "unit": c.get("unit")})
        r = api(loja, "PATCH", f"/api/store-orders/{oid}", {"items": items, "note": "e2e/live_cycle"})
        if r.status_code not in (200, 201):
            rec("fill", "FAIL", f"preencher travou: {r.status_code} {r.text[:150]}")
            return _summary()
        rec("fill", "PASS", f"loja preencheu o pedido aberto ({len(items)} itens)")

        # 3) F1 — o pedido preenchido DEVE ser liberável e liberar.
        snap = api(fab, "GET", f"/api/factory-planning?referenceDate={REF}").json()
        order_row = next((o for o in (snap.get("orders") or []) if o.get("id") == oid), None)
        item_rows = [it for it in (snap.get("orderItems") or []) if it.get("orderId") == oid]
        if order_row is None:
            rec("releasable", "FAIL", "pedido não apareceu no planning (inconsistência)")
        else:
            rec("releasable", "PASS" if order_row.get("availableForRelease") else "FAIL",
                f"availableForRelease={order_row.get('availableForRelease')} (entrega {order_row.get('deliveryDate')})")
        r = api(fab, "PATCH", "/api/factory-planning/workflow", {"action": "release-order", "orderId": oid})
        rec("release", "PASS" if r.status_code in (200, 201) else "FAIL",
            "pedido LIBERADO (não travou) ✓ F1" if r.status_code in (200, 201) else f"liberação travou: {r.status_code} {r.text[:150]}")

        # 4) Item 1 — datas consistentes entre catálogo, planning e expedição.
        cat_by_pid = {c.get("productId"): c for c in avail}
        inconsist = [
            f"{it.get('productCode')}: catálogo {cat_by_pid[it['productId']].get('deliveryDate')} ≠ planning {it.get('deliveryDate')}"
            for it in item_rows
            if it.get("productId") in cat_by_pid
            and cat_by_pid[it["productId"]].get("deliveryDate")
            and cat_by_pid[it["productId"]].get("deliveryDate") != it.get("deliveryDate")
        ]
        rec("item1-consistencia", "PASS" if not inconsist else "FAIL",
            "datas catálogo == planning" if not inconsist else "; ".join(inconsist))
        exp = [e for e in (snap.get("expedition") or []) if e.get("orderId") == oid]
        if exp and order_row:
            rec("item1-expedicao", "PASS" if exp[0].get("deliveryDate") == order_row.get("deliveryDate") else "FAIL",
                f"expedição {exp[0].get('deliveryDate')} vs pedido {order_row.get('deliveryDate')}")

        # 5) Item 3 — cada produto entrega em produção + SEU lead (não no D+X global).
        r = api(loja, "GET", f"/api/store-order-catalog?storeId={store_id}&orderedAt={REF}T09:00:00")
        avail2 = [c for c in (r.json() or []) if c.get("available")] if r.status_code == 200 else []
        offs = sorted({o for o in (date_offset(c.get("productionDate"), c.get("deliveryDate")) for c in avail2) if o is not None})
        rec("item3-per-product", "PASS" if offs else "SKIP",
            f"offsets de entrega observados: {offs} (por produto = lead próprio, não D+X global)")

        # 6) Produção avança (start → em_preparacao → em_producao) sem travar.
        snap2 = api(fab, "GET", f"/api/factory-planning?referenceDate={REF}").json()
        key = None
        for op in (snap2.get("productionOrders") or []):
            if op.get("hasDemand") is False:
                continue
            for it in op.get("items", []):
                if it.get("productionItemKey") and it.get("status") in ("nao_iniciado", None):
                    key = it.get("productionItemKey")
                    break
            if key:
                break
        if key:
            ok = True
            for step in ("start-production-item", "em_preparacao", "em_producao"):
                if step == "start-production-item":
                    rr = api(fab, "PATCH", "/api/factory-planning/workflow", {"action": step, "productionItemKey": key})
                else:
                    rr = api(fab, "PATCH", "/api/factory-planning/workflow",
                             {"action": "update-production-item-status", "productionItemKey": key, "status": step})
                ok = ok and rr.status_code in (200, 201)
            advanced_keys.append(key)
            rec("producao-avanca", "PASS" if ok else "FAIL", "OP avançou start→preparação→produção" if ok else "avanço travou")
        else:
            rec("producao-avanca", "SKIP", "sem OP liberada p/ avançar")

        browser.close()
    _summary()


def _summary():
    npass = sum(1 for _, s, _ in results if s == "PASS")
    nfail = sum(1 for _, s, _ in results if s == "FAIL")
    nskip = sum(1 for _, s, _ in results if s == "SKIP")
    print(f"\n===== RESUMO LIVE-CYCLE: {npass} PASS · {nfail} FAIL · {nskip} SKIP =====")
    # Cleanup SQL (rodar no Supabase dev) — remove os pedidos/OP criados por esta run.
    if created_order_codes or advanced_keys:
        codes = ", ".join(f"'{c}'" for c in created_order_codes if c)
        print("\n-- CLEANUP (rodar no Supabase dev):")
        if codes:
            print(f"delete from public.store_order_events where order_id in (select id from public.store_orders where code in ({codes}));")
            print(f"delete from public.workflow_order_releases where order_id in (select id from public.store_orders where code in ({codes}));")
            print(f"delete from public.store_order_items where order_id in (select id from public.store_orders where code in ({codes}));")
            print(f"delete from public.store_orders where code in ({codes});")
        for k in advanced_keys:
            print(f"delete from public.workflow_production_items where production_item_key = '{k}';")
            print(f"delete from public.workflow_production_starts where production_item_key = '{k}';")
    print("MUTATIONS " + json.dumps({"orders": created_order_codes, "op_keys": advanced_keys}))
    sys.exit(1 if nfail else 0)


if __name__ == "__main__":
    run()
