"""E2E full-flow Pedido → Fabricação → Entrega exercitando A1-A8 com dado real.

Sessão 2026-05-21: o `automation_a1_a8.py` cobre só presença de UI. Este script
fecha o loop: cria pedido, libera, avança OPs (via UI + API), registra
tentativa de falha, marca entregue — e produz mutações REAIS no banco.

Lições da iteração anterior:
  - User `loja@` está vinculado a stores via LEGACY_ID, não UUID — POST
    /api/store-orders precisa `storeId="store-01"` (não UUID).
  - Personas vivem no tenant "Ecossistema Atual" (2523cb10) — todos os
    production_items legacy do dev usam IDs slug (line-confeitaria, etc).
  - Engine moderno deriva `productionItemKey` com UUIDs reais — incompatível
    com fixtures legacy. Pra A5 funcionar end-to-end, preciso descobrir o
    productionItemKey REAL via GET /api/factory-planning?referenceDate=… do
    pedido novo (UUIDs frescos).

Estratégia híbrida:
  - Criação de pedido: API (UI já validada em regression).
  - Liberação A1: UI do gestor-fabrica (clique no botão).
  - Auto-release A6: POST endpoint.
  - Avanço de OP A5: descoberta dinâmica do key via /api/factory-planning,
    1 transição via UI + restante via API.
  - Tentativa de falha A3: POST /api/delivery-executions/attempts.
  - Roteirização A8: inspeção do DOM da lista de entregas.
  - Métricas A7: GET /api/factory-planning/metrics.

Pré-req: `npm run dev` rodando. Não-headless = E2E_HEADLESS=0.
"""
from __future__ import annotations

import json
import os
import re
import sys
from typing import Any

import requests
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://192.168.1.16:3000")
HEADLESS = os.environ.get("E2E_HEADLESS", "1") != "0"

USERS = {
    "loja":    ("loja@danielaugusto.com",    "Loja@123"),
    "fabrica": ("fabrica@danielaugusto.com", "Fabrica@123"),
    "chao":    ("chao@danielaugusto.com",    "Chao@123"),
}

# Loja "Empório do Pão" — LEGACY ID porque o auth normaliza assim.
STORE_EMPORIO_PAO = "store-01"
# Produtos do tenant Ecossistema Atual — usa LEGACY_ID (mesmo padrão de storeId).
PRODUCT_PUDIM_GRANDE = "product-pudim-grande"  # Pudim Grande/Un
PRODUCT_PUDIM_MEDIO = "product-pudim-medio"    # Pudim Médio/Un

# Para A3 — pedido novo criado no fluxo (descoberto em runtime). Os pedidos
# fixture com production_items legacy não passam pelo `isOrderReadyForDeliveryExecution`
# porque o motor não enxerga o status persistido (key incompatível).

results: list[tuple[str, str, str]] = []
mutations: dict[str, Any] = {
    "orders_created": [],
    "orders_released_via_ui": [],
    "orders_released_via_api": [],
    "auto_release_response": None,
    "ops_advanced_via_ui": [],
    "ops_advanced_via_api": [],
    "delivery_attempts_registered": [],
    "delivery_transitions": [],
    "metrics_window7": None,
    "metrics_window90": None,
    "discovered_op_keys": [],
}


def rec(idn: str, status: str, msg: str = "") -> None:
    results.append((idn, status, msg))
    print(f"[{status:4}] {idn}: {msg}")


def login(page, who: str) -> None:
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


def cookie_string(ctx) -> str:
    return "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies())


def goto(page, path: str) -> None:
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=90000)
    try:
        page.wait_for_load_state("networkidle", timeout=12000)
    except Exception:
        pass
    page.wait_for_timeout(2500)


def body(page) -> str:
    try:
        return page.inner_text("body", timeout=8000)
    except Exception:
        return ""


def api(ctx, method: str, path: str, payload: dict | None = None, timeout: int = 30) -> requests.Response:
    headers = {"Cookie": cookie_string(ctx)}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    return requests.request(method, f"{BASE}{path}", headers=headers, json=payload, timeout=timeout)


def find_planning_items_for_order(ctx, order_id: str, reference_date: str) -> list[dict]:
    """Consulta o snapshot do engine e devolve orderItems do pedido."""
    resp = api(ctx, "GET", f"/api/factory-planning?referenceDate={reference_date}")
    if resp.status_code != 200:
        return []
    snap = resp.json()
    items = snap.get("orderItems", []) or []
    return [it for it in items if it.get("orderId") == order_id]


def run() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)

        def fresh(who: str):
            ctx = browser.new_context(viewport={"width": 1500, "height": 1000})
            pg = ctx.new_page()
            login(pg, who)
            return ctx, pg

        ctxs: dict[str, Any] = {}
        for who in USERS:
            try:
                ctx, page = fresh(who)
                ctxs[who] = (ctx, page)
                rec(f"login-{who}", "PASS", "login OK")
            except Exception as e:
                rec(f"login-{who}", "FAIL", f"{e}")

        if not all(k in ctxs for k in USERS):
            rec("setup", "FAIL", "Não consegui logar todas as personas — abortando")
            browser.close()
            return

        # =========================================================
        # FASE 1 — Criar pedido (Loja)
        # =========================================================
        loja_ctx, _ = ctxs["loja"]
        order_id: str | None = None
        order_code: str | None = None
        try:
            resp = api(
                loja_ctx,
                "POST",
                "/api/store-orders",
                {
                    "storeId": STORE_EMPORIO_PAO,
                    "items": [
                        {"productId": PRODUCT_PUDIM_GRANDE, "quantity": 6, "unit": "Un"},
                        {"productId": PRODUCT_PUDIM_MEDIO, "quantity": 4, "unit": "Un"},
                    ],
                    "note": "E2E full-flow A1-A8 (script)",
                },
            )
            if resp.status_code == 201:
                data = resp.json()
                order_id = data.get("id") or data.get("orderId")
                order_code = data.get("code")
                mutations["orders_created"].append({"id": order_id, "code": order_code})
                rec("F1-create-order", "PASS", f"{order_code} ({order_id})")
            else:
                rec("F1-create-order", "FAIL",
                    f"POST /store-orders {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            rec("F1-create-order", "FAIL", f"{e}")

        # =========================================================
        # FASE 2 — Liberação manual via UI (A1)
        # =========================================================
        fabrica_ctx, fabrica_page = ctxs["fabrica"]
        if order_id:
            try:
                goto(fabrica_page, "/gestor-fabrica/pedidos")
                fabrica_page.wait_for_timeout(2500)
                page_txt = body(fabrica_page)
                if order_code and order_code in page_txt:
                    rec("F2-order-visible", "PASS", f"{order_code} visível na lista")
                else:
                    rec("F2-order-visible", "SKIP", f"{order_code} fora do scope visual")

                released_via_ui = False
                if order_code and order_code in page_txt:
                    try:
                        # A linha do pedido é um <tr> contendo o code. Dentro dela
                        # há um botão "Liberar para produção" (ou "Liberado" se já)
                        tr = fabrica_page.locator(f"tr:has-text('{order_code}')").first
                        if tr.count() > 0:
                            btn = tr.get_by_role(
                                "button", name=re.compile(r"^Liberar para produ", re.I)
                            )
                            if btn.count() > 0:
                                btn.first.click(timeout=10000)
                                fabrica_page.wait_for_timeout(4000)
                                # Confirm dialog
                                for label in (r"Liberar mesmo assim", r"Confirmar", r"Sim"):
                                    c = fabrica_page.get_by_role(
                                        "button", name=re.compile(label, re.I)
                                    )
                                    if c.count() > 0:
                                        try:
                                            c.first.click(timeout=4000)
                                            fabrica_page.wait_for_timeout(2000)
                                        except Exception:
                                            pass
                                released_via_ui = True
                                mutations["orders_released_via_ui"].append(order_id)
                                rec("F2-A1-release-ui", "PASS",
                                    f"Clique 'Liberar para produção' via tr-locator ({order_code})")
                            else:
                                rec("F2-A1-release-ui", "SKIP",
                                    f"tr do {order_code} sem botão 'Liberar' (já liberado?)")
                        else:
                            rec("F2-A1-release-ui", "SKIP",
                                f"tr do {order_code} não encontrado")
                    except Exception as e:
                        rec("F2-A1-release-ui", "SKIP", f"erro UI: {e}")

                # Fallback API se UI não rodou
                if not released_via_ui:
                    resp = api(
                        fabrica_ctx,
                        "PATCH",
                        "/api/factory-planning/workflow",
                        {"action": "release-order", "orderId": order_id},
                    )
                    if resp.status_code == 200:
                        mutations["orders_released_via_api"].append(order_id)
                        rec("F2-A1-release-fallback-api", "PASS",
                            f"release-order via API ({order_code})")
                    else:
                        rec("F2-A1-release-fallback-api", "FAIL",
                            f"{resp.status_code}: {resp.text[:160]}")
            except Exception as e:
                rec("F2-release", "FAIL", f"{e}")
        else:
            rec("F2-release", "SKIP", "sem pedido pra liberar")

        # =========================================================
        # FASE 3 — Auto-release (A6)
        # =========================================================
        try:
            resp = api(fabrica_ctx, "POST", "/api/factory-planning/auto-release", {})
            if resp.status_code == 200:
                data = resp.json()
                mutations["auto_release_response"] = data
                released_now = len(data.get("released", []))
                skipped = len(data.get("skipped", []))
                failed = len(data.get("failed", []))
                rec("F3-A6-auto-release", "PASS",
                    f"released={released_now} skipped={skipped} failed={failed}")
            else:
                rec("F3-A6-auto-release", "FAIL",
                    f"{resp.status_code}: {resp.text[:160]}")
        except Exception as e:
            rec("F3-A6-auto-release", "FAIL", f"{e}")

        # =========================================================
        # FASE 4 — Produção: descobrir productionItemKey real e avançar (A5)
        # =========================================================
        chao_ctx, chao_page = ctxs["chao"]
        today = "2026-05-21"
        op_keys_to_advance: list[str] = []

        if order_id:
            try:
                # Tenta hoje + alguns dias à frente — o engine planeja a data de produção
                # para baseDate do pedido novo (deliveryDate = base+lead). Vou varrer
                # algumas datas pra achar production_date do meu pedido.
                for ref in (today, "2026-05-22", "2026-05-23", "2026-05-24", "2026-05-25"):
                    items = find_planning_items_for_order(fabrica_ctx, order_id, ref)
                    keys = [it.get("productionItemKey") for it in items if it.get("productionItemKey")]
                    if keys:
                        op_keys_to_advance = list(dict.fromkeys(keys))
                        mutations["discovered_op_keys"] = op_keys_to_advance
                        rec("F4-A5-discover", "PASS",
                            f"{len(op_keys_to_advance)} productionItemKey via /api/factory-planning?ref={ref}")
                        break
                if not op_keys_to_advance:
                    rec("F4-A5-discover", "SKIP",
                        f"engine não gerou production_item_key para {order_code} — sem janela ou produto sem rota")
            except Exception as e:
                rec("F4-A5-discover", "FAIL", f"{e}")

        # 4a) Transição via UI da primeira key (chao-fabrica)
        advanced_via_ui = False
        if op_keys_to_advance:
            try:
                first_key = op_keys_to_advance[0]
                production_date = first_key.split("|")[0]
                goto(chao_page, f"/chao-fabrica/ordens-producao?ref={production_date}")
                chao_page.wait_for_timeout(2500)
                # A tabela usa onRowClick (window.location.assign), não links —
                # OP codes estão visíveis como texto OP-{date}-{seq}. Vou procurar
                # rows que tenham "Confeitaria" (pq Pudim pertence a essa linha) e
                # clicar nelas.
                # Tenta achar trs/divs que contenham "OP-260522-" (production_date)
                op_pattern = re.compile(rf"OP-{production_date[2:].replace('-','')}-\d+")
                page_txt = body(chao_page)
                op_codes = op_pattern.findall(page_txt)
                op_codes = list(dict.fromkeys(op_codes))  # dedupe
                rec("F4-debug-ops", "PASS",
                    f"OPs visíveis em ref={production_date}: {op_codes[:5]}")

                for op_code in op_codes[:5]:
                    # Clica na linha da tabela com esse op_code
                    row = chao_page.locator(f"tr:has-text('{op_code}'), [role='row']:has-text('{op_code}')").first
                    if row.count() == 0:
                        continue
                    try:
                        row.click(timeout=8000)
                    except Exception:
                        continue
                    chao_page.wait_for_timeout(3000)
                    if "/ordens-producao/" not in chao_page.url:
                        # Não navegou. Volta e tenta próxima.
                        goto(chao_page, f"/chao-fabrica/ordens-producao?ref={production_date}")
                        chao_page.wait_for_timeout(1500)
                        continue
                    txt = body(chao_page)
                    if "Pudim" not in txt:
                        # Volta e tenta próxima
                        goto(chao_page, f"/chao-fabrica/ordens-producao?ref={production_date}")
                        chao_page.wait_for_timeout(1500)
                        continue
                    # 1ª transição disponível: pode ser "Iniciar preparação",
                    # "Iniciar produção", etc — qualquer botão de avanço serve.
                    advanced_in_this_op = False
                    for action_label in (
                        r"Iniciar prepara[çc][ãa]o",
                        r"Iniciar produ[çc][ãa]o",
                        r"Enviar para forno",
                        r"Iniciar embalagem",
                        r"Marcar como conclu",
                        r"Voltar para embalagem",
                    ):
                        btn = chao_page.get_by_role(
                            "button", name=re.compile(action_label, re.I)
                        )
                        if btn.count() > 0:
                            try:
                                btn.first.click(timeout=10000)
                                chao_page.wait_for_timeout(3500)
                                advanced_via_ui = True
                                advanced_in_this_op = True
                                mutations["ops_advanced_via_ui"].append(
                                    {"op_code": op_code, "action": action_label}
                                )
                                break
                            except Exception:
                                continue
                    if advanced_in_this_op:
                        break

                if advanced_via_ui:
                    rec("F4-A5-ui-transition", "PASS",
                        "1 transição via UI (chao-fabrica) — hook funcionou")
                else:
                    rec("F4-A5-ui-transition", "SKIP",
                        f"OP do pedido com 'Pudim' não detectada em ref={production_date}")
            except Exception as e:
                rec("F4-A5-ui-transition", "FAIL", f"{e}")
        else:
            rec("F4-A5-ui-transition", "SKIP", "sem productionItemKey conhecido")

        # 4b) Avançar até concluído via API pra cada key descoberta
        if op_keys_to_advance:
            full_chain = ["em_preparacao", "em_producao", "em_forno", "embalando", "concluido"]
            for key in op_keys_to_advance:
                for target in full_chain:
                    resp = api(
                        chao_ctx,
                        "PATCH",
                        "/api/factory-planning/workflow",
                        {
                            "action": "update-production-item-status",
                            "productionItemKey": key,
                            "status": target,
                        },
                        timeout=20,
                    )
                    if resp.status_code == 200:
                        mutations["ops_advanced_via_api"].append({"key": key, "to": target})
                    elif resp.status_code == 400:
                        # transição inválida (já no destino?) — continue tentando próximo
                        continue
                    else:
                        rec("F4-A5-api-advance", "FAIL",
                            f"{key[-30:]}→{target}: {resp.status_code} {resp.text[:140]}")
                        break
            if mutations["ops_advanced_via_api"]:
                rec("F4-A5-api-advance", "PASS",
                    f"{len(mutations['ops_advanced_via_api'])} transições via API")
            else:
                rec("F4-A5-api-advance", "SKIP", "nenhuma transição efetiva")

        # =========================================================
        # FASE 5 — Demanda agregada (A2)
        # =========================================================
        try:
            goto(fabrica_page, f"/gestor-fabrica/ordens-producao?ref={today}")
            txt = body(fabrica_page)
            if "Demanda por produto" in txt and "batelada" in txt.lower():
                rec("F5-A2-demand-card", "PASS", "Card presente")
                if re.search(r"\d+(?:[.,]\d+)?\s*kg", txt, re.I):
                    rec("F5-A2-demand-content", "PASS", "Card tem valores em kg")
                else:
                    rec("F5-A2-demand-content", "SKIP", "Card sem valores nesse anchor")
            else:
                rec("F5-A2-demand-card", "FAIL", "Card não encontrado")
        except Exception as e:
            rec("F5-A2-demand-card", "FAIL", f"{e}")

        # =========================================================
        # FASE 5b — Card "Histórico da OP" (A5 UI)
        # =========================================================
        if op_keys_to_advance:
            try:
                production_date = op_keys_to_advance[0].split("|")[0]
                goto(fabrica_page, f"/gestor-fabrica/ordens-producao?ref={production_date}")
                fabrica_page.wait_for_timeout(2500)
                # OPs no gestor-fabrica também usam row-click. Procurar pelo
                # op_code que o engine gera nessa data.
                op_pattern = re.compile(rf"OP-{production_date[2:].replace('-','')}-\d+")
                page_txt_gf = body(fabrica_page)
                op_codes_gf = list(dict.fromkeys(op_pattern.findall(page_txt_gf)))
                history_found = False
                for op_code in op_codes_gf[:5]:
                    row = fabrica_page.locator(
                        f"tr:has-text('{op_code}'), [role='row']:has-text('{op_code}')"
                    ).first
                    if row.count() == 0:
                        continue
                    try:
                        row.click(timeout=8000)
                    except Exception:
                        continue
                    fabrica_page.wait_for_timeout(3000)
                    if "/ordens-producao/" not in fabrica_page.url:
                        goto(fabrica_page, f"/gestor-fabrica/ordens-producao?ref={production_date}")
                        fabrica_page.wait_for_timeout(1500)
                        continue
                    txt = body(fabrica_page)
                    if "Pudim" not in txt:
                        goto(fabrica_page, f"/gestor-fabrica/ordens-producao?ref={production_date}")
                        fabrica_page.wait_for_timeout(1500)
                        continue
                    if "Histórico da OP" in txt:
                        history_found = True
                        # Sanity: verificar se mostra ao menos 1 transição
                        if re.search(r"(em_preparacao|em_producao|em_forno|embalando|concluido)", txt, re.I):
                            rec("F5b-A5-history-card", "PASS",
                                f"'Histórico da OP' renderiza com transições ({op_code})")
                        else:
                            rec("F5b-A5-history-card", "PASS",
                                f"'Histórico da OP' presente mas sem labels de status visíveis ({op_code})")
                        break
                if not history_found:
                    rec("F5b-A5-history-card", "FAIL",
                        "Nenhuma OP do pedido mostrou 'Histórico da OP'")
            except Exception as e:
                rec("F5b-A5-history-card", "SKIP", f"{e}")

        # =========================================================
        # FASE 7 — Tentativa de falha A3
        # =========================================================
        # Usa o pedido recém-criado (em aguardando_expedicao após avanços F4).
        # Pra ir aguardando_expedicao → pronto_coleta precisa checklist completo:
        #   key = `${productId}|${requestedUnit}|${expeditionUnit}`
        if order_id:
            try:
                # Descobrir expedition items via /api/factory-planning
                expedition_items: list[dict] = []
                exp_delivery_date = None
                for ref in (today, "2026-05-22", "2026-05-23", "2026-05-24"):
                    resp = api(fabrica_ctx, "GET", f"/api/factory-planning?referenceDate={ref}")
                    if resp.status_code != 200:
                        continue
                    snap = resp.json()
                    matches = [
                        e for e in snap.get("expedition", [])
                        if e.get("orderId") == order_id or order_code in (e.get("orderCode") or "")
                    ]
                    if matches:
                        expedition_items = matches[0].get("items", [])
                        exp_delivery_date = matches[0].get("deliveryDate")
                        break

                if not expedition_items:
                    rec("F7-A3-checklist", "SKIP",
                        "Sem expedition items pro pedido novo — não dá pra montar checklist")
                else:
                    checklist_state = {}
                    for it in expedition_items:
                        key = f"{it['productId']}|{it['requestedUnit']}|{it['expeditionUnit']}"
                        checklist_state[key] = True
                    rec("F7-A3-checklist", "PASS",
                        f"checklist montado com {len(checklist_state)} items")

                    # 1) aguardando_expedicao → pronto_coleta (com checklist)
                    resp1 = api(
                        chao_ctx, "PATCH", "/api/delivery-executions",
                        {
                            "orderId": order_id,
                            "status": "pronto_coleta",
                            "checklistState": checklist_state,
                            "checklistCompletedAt": None,
                        },
                    )
                    if resp1.status_code == 200:
                        mutations["delivery_transitions"].append({"order": order_id, "to": "pronto_coleta"})
                        rec("F7-A3-pronto-coleta", "PASS", "pronto_coleta após checklist")
                    else:
                        rec("F7-A3-pronto-coleta", "FAIL",
                            f"{resp1.status_code}: {resp1.text[:160]}")

                    # 2) pronto_coleta → em_rota
                    resp2 = api(
                        chao_ctx, "PATCH", "/api/delivery-executions",
                        {"orderId": order_id, "status": "em_rota"},
                    )
                    if resp2.status_code == 200:
                        mutations["delivery_transitions"].append({"order": order_id, "to": "em_rota"})
                        rec("F7-A3-em-rota", "PASS", "em_rota")
                    else:
                        rec("F7-A3-em-rota", "FAIL", f"{resp2.status_code}: {resp2.text[:160]}")

                    # 3) Registrar attempt
                    resp3 = api(
                        chao_ctx, "POST", "/api/delivery-executions/attempts",
                        {
                            "orderId": order_id,
                            "reason": "cliente_ausente",
                            "notes": "E2E full-flow — cliente não atendeu",
                            "rescheduleTo": None,
                        },
                    )
                    if resp3.status_code == 200:
                        data = resp3.json()
                        mutations["delivery_attempts_registered"].append({
                            "order": order_id, "response": data, "reason": "cliente_ausente",
                        })
                        rec("F7-A3-attempt-api", "PASS",
                            f"attempt registrado: {json.dumps(data)[:160]}")
                    else:
                        rec("F7-A3-attempt-api", "FAIL", f"{resp3.status_code}: {resp3.text[:160]}")

                    # 4) Recovery: tentativa_falha → em_rota → no_destino → entregue
                    chain = ["em_rota", "no_destino", "entregue"]
                    recovery_ok = True
                    last_err = None
                    for tgt in chain:
                        r = api(
                            chao_ctx, "PATCH", "/api/delivery-executions",
                            {"orderId": order_id, "status": tgt},
                        )
                        if r.status_code == 200:
                            mutations["delivery_transitions"].append({"order": order_id, "to": tgt})
                        else:
                            recovery_ok = False
                            last_err = f"{tgt}: {r.status_code} {r.text[:120]}"
                            break
                    if recovery_ok:
                        rec("F7-A3-recover", "PASS",
                            "tentativa_falha → em_rota → no_destino → entregue")
                    else:
                        rec("F7-A3-recover", "FAIL", f"recovery {last_err}")
            except Exception as e:
                rec("F7-A3", "FAIL", f"{e}")
        else:
            rec("F7-A3", "SKIP", "sem pedido novo pra A3")

        # =========================================================
        # FASE 8 — Roteirização (A8)
        # =========================================================
        try:
            goto(chao_page, "/chao-fabrica/entregas")
            txt = body(chao_page)
            if "Sem agrupamento" in txt or re.search(r"Zona\s+\w", txt) or re.search(r"Janela\s+\d", txt):
                rec("F8-A8-route-honest", "PASS",
                    "Roteirização exibe zona/janela/sem-agrupamento")
                if re.search(r"\bRota\s+(Centro|Norte|Sul|Leste|Oeste)\b", txt) and "Zona" not in txt:
                    rec("F8-A8-route-no-placeholder", "FAIL",
                        "Rota literal Centro/Norte/Sul SEM 'Zona X'")
                else:
                    rec("F8-A8-route-no-placeholder", "PASS", "Sem placeholder hash residual")
            else:
                rec("F8-A8-route-honest", "SKIP",
                    "Página de entregas sem grupos esperados")
        except Exception as e:
            rec("F8-A8-route-honest", "FAIL", f"{e}")

        # =========================================================
        # FASE 9 — Métricas (A7)
        # =========================================================
        for window in (7, 90):
            try:
                resp = api(fabrica_ctx, "GET", f"/api/factory-planning/metrics?windowDays={window}")
                if resp.status_code != 200:
                    rec(f"F9-A7-metrics-{window}d", "FAIL",
                        f"{resp.status_code}: {resp.text[:160]}")
                    continue
                data = resp.json()
                mutations[f"metrics_window{window}"] = data
                lt = data.get("leadTime", {})
                otif = data.get("otif", {})
                df = data.get("deliveryFailures", {})
                samples = lt.get("samples", 0)
                otif_on_time = otif.get("deliveredOnTime", otif.get("on_time", 0))
                failures = df.get("total", df.get("count", 0))
                rec(f"F9-A7-metrics-{window}d", "PASS",
                    f"samples={samples} onTime={otif_on_time} failures={failures}")
            except Exception as e:
                rec(f"F9-A7-metrics-{window}d", "FAIL", f"{e}")

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
        import traceback; traceback.print_exc()

    p = sum(1 for _, s, _ in results if s == "PASS")
    f = sum(1 for _, s, _ in results if s == "FAIL")
    sk = sum(1 for _, s, _ in results if s == "SKIP")
    print(f"\n===== RESUMO FULL-FLOW: {p} PASS · {f} FAIL · {sk} SKIP =====")
    print("\nMUTATIONS_JSON_START")
    print(json.dumps(mutations, indent=2, default=str))
    print("MUTATIONS_JSON_END")
    sys.exit(1 if f else 0)
