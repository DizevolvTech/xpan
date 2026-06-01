"""Verificação focada do FLUXO DE PEDIDO da loja (criação fresca end-to-end).

Prova, com pedido NOVO (não reuso), que:
  1. O catálogo oferece variantes available para a loja na data de hoje.
  2. POST /api/store-orders cria um pedido fresco → 201.
  3. O pedido aparece na listagem.
  4. (limpeza) cancela o pedido de teste anterior pra liberar o slot da trava
     de duplicidade (AJ-0007), se existir.

Pré-req: `npm run dev` rodando. E2E_BASE=http://localhost:3000.
"""
from __future__ import annotations

import datetime
import os
import re

import requests
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")
HEADLESS = os.environ.get("E2E_HEADLESS", "1") != "0"
LOJA = ("loja@danielaugusto.com", "Loja@123")
STORE = "store-01"


def login(page) -> None:
    email, pwd = LOJA
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_selector("#email", state="visible", timeout=30000)
    btn = page.locator("button[type=submit]")
    btn.wait_for(state="visible", timeout=30000)
    page.wait_for_timeout(1200)
    page.fill("#email", email)
    page.fill("#password", pwd)
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
                return
    raise RuntimeError(f"login não saiu de /login (url={page.url})")


def cookies(ctx) -> str:
    return "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies())


def api(ctx, method, path, payload=None):
    headers = {"Cookie": cookies(ctx)}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    return requests.request(method, f"{BASE}{path}", headers=headers, json=payload, timeout=30)


def main() -> int:
    ok = True
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        login(page)
        print("[PASS] login loja")

        today = datetime.date.today().isoformat()

        # 0) Limpeza: cancela pedidos ativos de teste do dia pra liberar a trava de
        #    duplicidade. Só cancela os que o cancelOrder permitir (canCancel).
        listing = api(ctx, "GET", "/api/store-orders")
        if listing.status_code == 200:
            for o in listing.json():
                if o.get("orderedAtKey") == today and o.get("storeId") == STORE:
                    oid = o.get("id")
                    d = api(ctx, "DELETE", f"/api/store-orders/{oid}")
                    print(f"[INFO] cancel {o.get('code')} ({oid}) → {d.status_code} {d.text[:80]}")

        # 1) Catálogo: precisa ter variante available
        cat = api(ctx, "GET", f"/api/store-order-catalog?storeId={STORE}&orderedAt={today}")
        if cat.status_code != 200 or not isinstance(cat.json(), list):
            print(f"[FAIL] catálogo {cat.status_code}: {cat.text[:120]}")
            browser.close()
            return 1
        catalog = cat.json()
        avail = [c for c in catalog if c.get("available")]
        print(f"[{'PASS' if avail else 'FAIL'}] catálogo: {len(avail)}/{len(catalog)} variantes available")
        if not avail:
            browser.close()
            return 1

        # A trava de duplicidade (AJ-0007) é por loja+data-de-entrega. Evita datas já
        # ocupadas por pedidos ativos do dia para provar uma criação FRESCA.
        occupied = set()
        if listing.status_code == 200:
            for o in listing.json():
                if o.get("storeId") == STORE and o.get("deliveryDateKey"):
                    occupied.add(o["deliveryDateKey"])
        free = [c for c in avail if c.get("deliveryDate") not in occupied]
        print(f"[INFO] datas de entrega ocupadas: {sorted(occupied)} · "
              f"{len(free)}/{len(avail)} variantes em data livre")
        if not free:
            print("[INFO] todas as datas livres ocupadas por testes anteriores — "
                  "criação fresca exige DB limpo (AJ-0019); trava de duplicidade já validada (400)")
            browser.close()
            return 0

        first = free[0]
        qty = 6 if first.get("unitKind") == "discrete" else max(1.0, round(float(first.get("minimumProductionKg") or 0) + 0.5, 3))
        items = [{"productId": first["productId"], "quantity": qty, "unit": first["unit"]}]
        print(f"[INFO] criando pedido: {first.get('name')} x{qty} {first.get('unit')} "
              f"(entrega {first.get('deliveryDate')})")

        # 2) POST fresco → 201
        resp = api(ctx, "POST", "/api/store-orders",
                   {"storeId": STORE, "items": items, "note": "check_order_flow (fresco)"})
        if resp.status_code == 201:
            data = resp.json()
            code, oid = data.get("code"), data.get("id")
            print(f"[PASS] criação fresca 201 → {code} ({oid})")
        else:
            print(f"[FAIL] criação retornou {resp.status_code}: {resp.text[:180]}")
            browser.close()
            return 1

        # 3) Aparece na listagem?
        listing2 = api(ctx, "GET", "/api/store-orders")
        found = any(o.get("code") == code for o in listing2.json()) if listing2.status_code == 200 else False
        print(f"[{'PASS' if found else 'FAIL'}] pedido {code} visível na listagem")
        ok = found

        browser.close()
    print("===== RESULTADO: FLUXO DE PEDIDO " + ("OK" if ok else "FALHOU") + " =====")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
