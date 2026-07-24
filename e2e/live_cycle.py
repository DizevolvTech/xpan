#!/usr/bin/env python3
"""Ciclo REAL de pedido no modelo LOTE (`FACTORY_OPENS_ORDERS` default ON):
fábrica abre um LOTE (janela de datas × lojas) → loja MONTA um pedido num slot →
fábrica libera → produção avança.

Modelo LOTE: a fábrica NÃO cria mais pedidos vazios. Abre 1 `order_batches` com os
slots (loja × data). A loja lista os lotes (GET /open), escolhe uma data ainda sem
pedido e CRIA o pedido (POST /store-orders com `deliveryDate` = data do slot). O gate
server-side em createStoreOrder recusa criar fora de um slot coberto por lote aberto.

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

        # 1) FÁBRICA ABRE UM LOTE (slots loja × data derivados do cronograma ativo).
        r = api(fab, "POST", "/api/store-orders/open",
                {"mode": "week", "referenceDate": REF, "storeIds": STORE_IDS})
        if r.status_code in (200, 201):
            body = r.json() if r.text else {}
            slots = body.get("slots", []) or []
            rec("open-lote", "PASS",
                f"fábrica abriu 1 lote com {len(slots)} slot(s) (batch={body.get('batchId')}, ref={REF})")
        elif r.status_code == 409:
            rec("open-lote", "SKIP", "recurso desligado (FACTORY_OPENS_ORDERS=false)")
            return _summary()
        else:
            rec("open-lote", "FAIL", f"lote não abriu: {r.status_code} {r.text[:150]}")
            return _summary()

        # 2) LOJA LISTA OS LOTES ABERTOS, ESCOLHE UM SLOT E CRIA O PEDIDO.
        r = api(loja, "GET", "/api/store-orders/open")
        batches = r.json() if r.status_code == 200 and r.text else []
        loja_slots = [s for b in (batches or []) for s in (b.get("slots") or [])] if isinstance(batches, list) else []
        if not loja_slots:
            rec("create", "FAIL", "loja não vê nenhum slot de lote aberto — não dá p/ testar o ciclo")
            return _summary()
        # Escolhe o 1º slot cuja data ainda NÃO tem pedido da loja (evita duplicidade).
        existing = api(loja, "GET", "/api/store-orders")
        existing_rows = existing.json() if existing.status_code == 200 and existing.text else []
        ordered_keys = {
            f"{o.get('storeId')}|{o.get('deliveryDateKey')}"
            for o in (existing_rows or [])
            if o.get("status") != "cancelado"
        }
        target = next(
            (s for s in loja_slots if f"{s.get('storeId')}|{s.get('deliveryDate')}" not in ordered_keys),
            None,
        )
        if target is None:
            rec("create", "SKIP", "todos os slots do lote já têm pedido — nada a criar")
            return _summary()
        store_id, commit_date = target.get("storeId"), target.get("deliveryDate")
        log(f"slot alvo · loja {store_id} · entrega {commit_date}")

        # Catálogo ancorado na data do slot — a loja vê os produtos entregáveis nessa data.
        r = api(loja, "GET",
                f"/api/store-order-catalog?storeId={store_id}&orderedAt={REF}T09:00:00"
                f"&targetDeliveryDate={commit_date}")
        cat = r.json() if r.status_code == 200 and r.text else []
        avail = [c for c in cat if c.get("available")] if isinstance(cat, list) else []
        if not avail:
            rec("create", "FAIL", f"catálogo ancorado vazio p/ {commit_date} — loja não consegue montar (TRAVA)")
            return _summary()
        items = []
        for c in avail[:2]:
            q = 6 if c.get("unitKind") == "discrete" else max(1.0, round(float(c.get("minimumProductionKg") or 0) + 0.5, 3))
            items.append({"productId": c["productId"], "quantity": q, "unit": c.get("unit")})
        r = api(loja, "POST", "/api/store-orders",
                {"storeId": store_id, "deliveryDate": commit_date, "items": items, "note": "e2e/live_cycle"})
        if r.status_code not in (200, 201):
            rec("create", "FAIL", f"criar no slot travou: {r.status_code} {r.text[:150]}")
            return _summary()
        created = r.json() if r.text else {}
        # createStoreOrder devolve { orderId (=legacy_id), code } — o MESMO id que o
        # planning usa (id: legacy_id ?? id) e que resolveOrderRow aceita.
        oid = created.get("orderId") or created.get("id")
        if created.get("code"):
            created_order_codes.append(created.get("code"))
        rec("create", "PASS", f"loja criou o pedido no slot ({len(items)} itens, code={created.get('code')})")

        # 2b) GATE — criar FORA de um slot coberto pelo lote deve ser RECUSADO (400).
        bad_date = (datetime.date.fromisoformat(commit_date) + datetime.timedelta(days=180)).isoformat()
        rbad = api(loja, "POST", "/api/store-orders",
                   {"storeId": store_id, "deliveryDate": bad_date, "items": items, "note": "e2e/gate"})
        rec("gate-slot", "PASS" if rbad.status_code == 400 else "FAIL",
            f"criar fora do lote recusado (400)" if rbad.status_code == 400
            else f"gate FUROU: status {rbad.status_code} p/ data fora do lote {bad_date}")

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
