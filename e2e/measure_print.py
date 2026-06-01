"""Mede a altura renderizada (emulação de mídia print) das 4 páginas de impressão
e tira screenshots. Usado para quantificar economia de papel antes/depois.

Descobre IDs reais via API (logado como fabrica) e visita cada rota /impressao/*.
Reporta scrollHeight em px → estimativa de folhas A4 (~1080px úteis por folha com 6mm).

Uso:
  LABEL=after E2E_BASE=http://localhost:3000 python3 e2e/measure_print.py
"""
from __future__ import annotations

import os
import re

import requests
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3000")
LABEL = os.environ.get("LABEL", "run")
REF = os.environ.get("REF", "2026-06-02")
FABRICA = ("fabrica@danielaugusto.com", "Fabrica@123")
# px úteis por folha A4 a 96dpi (297mm) menos 12mm de margem vertical ≈ 1078px
PAGE_PX = 1078


def login(page) -> None:
    email, pwd = FABRICA
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
    raise RuntimeError("login falhou")


def cookies(ctx) -> str:
    return "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies())


def measure(page, ctx, route: str, name: str):
    page.goto(f"{BASE}{route}", wait_until="domcontentloaded", timeout=90000)
    page.emulate_media(media="print")
    page.wait_for_timeout(3500)
    doc = page.locator(".print-doc > div").first
    err = "Application error" in (page.content() or "")
    try:
        box = doc.bounding_box()
        height = round(box["height"]) if box else -1
    except Exception:
        height = -1
    shot = f"/tmp/print_{name}_{LABEL}.png"
    page.screenshot(path=shot, full_page=True)
    pages = (height + PAGE_PX - 1) // PAGE_PX if height > 0 else "?"
    print(f"[{name}] route={route} height={height}px ≈ {pages} folha(s) "
          f"{'ERR!' if err else 'ok'} → {shot}")
    return height


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 794, "height": 1123})  # A4 px @96dpi
        page = ctx.new_page()
        login(page)

        h = {"Cookie": cookies(ctx)}
        plan = requests.get(f"{BASE}/api/factory-planning?referenceDate={REF}", headers=h, timeout=30).json()
        ops = plan.get("productionOrders", []) or []
        exps = plan.get("expedition", []) or []
        orders = requests.get(f"{BASE}/api/store-orders", headers=h, timeout=30).json()

        op_id = ops[0]["id"] if ops else None
        exp_id = exps[0]["id"] if exps else None
        order_id = orders[0]["id"] if isinstance(orders, list) and orders else None
        print(f"[INFO] op_id={op_id} exp_id={exp_id} order_id={order_id} (ref={REF})")

        if op_id:
            measure(page, ctx, f"/impressao/pre-pesagem/{op_id}?ref={REF}", "prepesagem")
            measure(page, ctx, f"/impressao/producao/{op_id}?ref={REF}", "producao")
        if order_id:
            measure(page, ctx, f"/impressao/pedido-loja/{order_id}?ref={REF}", "pedidoloja")
        if exp_id:
            measure(page, ctx, f"/impressao/expedicao/{exp_id}?ref={REF}", "expedicao")

        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
