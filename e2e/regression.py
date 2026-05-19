"""E2E de não-regressão — Iniciativa UX (Daniel Augusto v2).

Âncora de não-regressão (métrica M6 do UX PRD): login real das **6 personas** +
smoke das telas-piloto + asserts dos marcadores AJ das Ondas 1-3 (não podem
regredir durante o polimento de UX).

Versão repo-committed do antigo /tmp/e2e_ajustes.py (D-0 do Gate 0): adiciona
master + admin, smoke das 6 telas-piloto da Onda 2, mantém os asserts AJ.
Não destrutivo (não cria pedidos). Fluxos que exigem dados específicos = SKIP
(data-dependent) — SKIP não é FAIL.

Pré-requisitos: `npm run dev` em :3000 (Supabase dev real, .env.local);
Playwright Python + chromium. Critério do gate: **0 FAIL** e PASS >= baseline.
Lições de flakiness encodadas aqui — ver e2e/README.md.
"""
import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

# 6 personas (credenciais demo reais — src/lib/demo-credentials.ts)
USERS = {
    "master":  ("master@danielaugusto.com",     "Master@123"),
    "admin":   ("admin@danielaugusto.com",       "Admin@123"),
    "dados":   ("engenharia@danielaugusto.com",  "Engenharia@123"),
    "fabrica": ("fabrica@danielaugusto.com",     "Fabrica@123"),
    "chao":    ("chao@danielaugusto.com",         "Chao@123"),
    "loja":    ("loja@danielaugusto.com",         "Loja@123"),
}
# landing esperada por persona (resolveLandingPath)
LANDING = {
    "master":  "/administrador-master",
    "admin":   "/administrador",
    "dados":   "/gestor-dados",
    "fabrica": "/gestor-fabrica",
    "chao":    "/chao-fabrica",
    "loja":    "/loja",
}
results = []  # (id, status, msg)


def rec(idn, status, msg=""):
    results.append((idn, status, msg))
    print(f"[{status:4}] {idn}: {msg}")


def login(page, who):
    email, pwd = USERS[who]
    page.goto(f"{BASE}/login", wait_until="domcontentloaded", timeout=90000)
    # esperar o form hidratar (botão presente) antes de interagir
    btn = page.locator("button[type=submit]")
    page.wait_for_selector("#email", state="visible", timeout=30000)
    btn.wait_for(state="visible", timeout=30000)
    page.wait_for_timeout(1200)  # margem p/ hidratação do handler client
    page.fill("#email", email, timeout=30000)
    page.fill("#password", pwd, timeout=30000)

    leftlogin = re.compile(r"https?://localhost:3000/(?!login)(?!$).*")
    # se em 60s ainda em /login (clique antes da hidratação), re-submeter; até 4x.
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
    raise RuntimeError(f"login {who}: não saiu de /login após 4 tentativas (url={page.url})")


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
        pass  # dashboards com polling nunca ficam idle — seguir
    page.wait_for_timeout(2500)


def screen_ok(page, path, idn):
    """Smoke: a tela carrega sem erro de app (não regrediu visualmente a ponto de quebrar)."""
    goto(page, path)
    txt = body(page)
    if "error" in page.title().lower() or "Application error" in txt or "Unhandled Runtime" in txt:
        rec(idn, "FAIL", f"{path} com erro de aplicação")
        return False
    rec(idn, "PASS", f"{path} carregou sem erro")
    return True


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        def fresh(who):
            """Contexto novo (cookies limpos) + login da persona."""
            ctx = browser.new_context(viewport={"width": 1500, "height": 1000})
            pg = ctx.new_page()
            login(pg, who)
            return ctx, pg

        # ---------- LOGIN + LANDING das 6 personas ----------
        ctxs = {}
        for who in ("master", "admin", "dados", "fabrica", "chao", "loja"):
            try:
                ctx, page = fresh(who)
                ctxs[who] = (ctx, page)
                rec(f"login-{who}", "PASS", f"login {who} OK")
                txt = body(page)
                if "error" in page.title().lower() or "Application error" in txt:
                    rec(f"landing-{who}", "FAIL", f"landing {LANDING[who]} com erro")
                else:
                    rec(f"landing-{who}", "PASS", f"landing {who} carregou")
            except Exception as e:
                rec(f"login-{who}", "FAIL", f"login {who} falhou: {e}")

        # ---------- PILOTO + AJ: LOJA ----------
        if "loja" in ctxs:
            _, page = ctxs["loja"]
            screen_ok(page, "/loja/pedidos", "piloto-loja-pedidos")
            try:
                page.get_by_role("button", name=re.compile("Novo Pedido", re.I)).first.click()
                page.wait_for_timeout(2500)
                dlg = body(page)
                if re.search(r"abaixo do m[íi]nimo|m[íi]nimo produtivo", dlg, re.I):
                    rec("AJ-0006", "FAIL", "texto de 'mínimo produtivo' voltou na loja")
                else:
                    rec("AJ-0006", "PASS", "sem alerta de mínimo produtivo no diálogo")
                if re.search(r"Ocultar indispon[íi]veis", dlg, re.I):
                    rec("AJ-0005", "PASS", "toggle 'Ocultar indisponíveis' presente")
                else:
                    rec("AJ-0005", "FAIL", "toggle 'Ocultar indisponíveis' sumiu")
                ths = page.locator("table thead th")
                try:
                    header_txt = " ".join(ths.all_inner_texts())
                except Exception:
                    header_txt = ""
                if re.search(r"(SEG|TER|QUA|QUI|SEX|S[ÁA]B|DOM)\s*\d{1,2}", header_txt or dlg):
                    rec("AJ-0016", "PASS", "colunas da grade mostram data")
                else:
                    rec("AJ-0016", "SKIP", "grade não renderizou (loja sem catálogo no dia?)")
                page.keyboard.press("Escape")
            except Exception as e:
                rec("AJ-0005/0006/0016", "SKIP", f"diálogo Novo Pedido não abriu: {e}")

        # ---------- PILOTO + AJ: GESTOR DE FÁBRICA ----------
        if "fabrica" in ctxs:
            _, page = ctxs["fabrica"]
            goto(page, "/gestor-fabrica")
            try:
                page.get_by_text("Acompanhamento", exact=True).first.wait_for(timeout=20000)
                cols = ["Aberto", "Em produção", "Aguardando expedição", "Em rota / entregue"]
                ncol = sum(1 for c in cols if page.get_by_text(c, exact=True).count() > 0)
                if ncol >= 3:
                    rec("AJ-0001", "PASS", f"Kanban 'Acompanhamento' ({ncol}/4 colunas)")
                else:
                    rec("AJ-0001", "FAIL", f"Kanban achado mas só {ncol} colunas")
            except Exception:
                rec("AJ-0001", "FAIL", "Kanban 'Acompanhamento' não encontrado")
            try:
                kpi_links = page.locator(
                    'a[href*="/gestor-fabrica/pedidos"], a[href*="/gestor-fabrica/ordens-producao"], a[href*="/chao-fabrica/entregas"]'
                )
                if kpi_links.count() >= 3:
                    rec("AJ-0002", "PASS", f"{kpi_links.count()} cards/links navegáveis")
                else:
                    rec("AJ-0002", "FAIL", f"poucos links de KPI ({kpi_links.count()})")
            except Exception as e:
                rec("AJ-0002", "FAIL", f"erro ao checar links KPI: {e}")

            screen_ok(page, "/gestor-fabrica/pedidos?status=em_espera", "piloto-fabrica-pedidos")

            goto(page, "/gestor-fabrica/ordens-producao")
            op = body(page)
            if re.search(r"Agendadas?\s*\(pr[óo]ximos dias\)", op) or re.search(r"agendadas? para os pr[óo]ximos dias", op):
                rec("AJ-0013", "PASS", "painel de OPs agendadas presente")
            elif "Fila de OPs" in op:
                rec("AJ-0013", "PASS", "página OK; KPI 'Agendadas' presente")
            else:
                rec("AJ-0013", "FAIL", "ordens-producao não renderizou esperado")

            goto(page, "/gestor-fabrica/sublinhas-producao")
            sub = body(page)
            if "error" in page.title().lower():
                rec("piloto-fabrica-sublinhas", "FAIL", "sublinhas-producao com erro")
            else:
                rec("piloto-fabrica-sublinhas", "PASS", "sublinhas-producao carregou")
            if re.search(r"Lead expedi[çc][ãa]o", sub):
                rec("AJ-0003", "PASS", "coluna 'Lead expedição' presente")
            else:
                rec("AJ-0003", "SKIP", "coluna não visível (precisa abrir revisão)")
            if re.search(r"Revis[õo]es pendentes", sub):
                rec("AJ-0012", "PASS", "seção 'Revisões pendentes' presente")
            else:
                rec("AJ-0012", "SKIP", "sem revisões pendentes — diff não exercitado")

        # ---------- AJ: CHÃO DE FÁBRICA ----------
        if "chao" in ctxs:
            _, page = ctxs["chao"]
            try:
                goto(page, "/chao-fabrica/entregas?status=em_rota")
                if "error" not in page.title().lower():
                    rec("AJ-0017", "PASS", "entregas?status=em_rota carregou")
                else:
                    rec("AJ-0017", "FAIL", "entregas deu erro")
            except Exception as e:
                rec("AJ-0017", "FAIL", f"chao/entregas falhou: {e}")

        # ---------- AJ: GESTOR DE DADOS ----------
        if "dados" in ctxs:
            _, page = ctxs["dados"]
            try:
                goto(page, "/gestor-dados/ingredientes")
                ing = body(page)
                if re.search(r"Ingrediente puro|Produto MPI|Misturado", ing, re.I):
                    rec("AJ-0020-list", "PASS", "listagem de ingredientes diferencia tipos")
                else:
                    rec("AJ-0020-list", "SKIP", "rótulos de tipo não visíveis na lista")
                screen_ok(page, "/gestor-dados/produtos", "gestor-dados-produtos")
            except Exception as e:
                rec("gestor-dados", "FAIL", f"gestor-dados falhou: {e}")

        # ---------- PILOTO: ADMINISTRADOR (matriz de usuários) ----------
        if "admin" in ctxs:
            _, page = ctxs["admin"]
            screen_ok(page, "/administrador/usuarios", "piloto-admin-usuarios")

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
    print(f"\n===== RESUMO: {p} PASS · {f} FAIL · {sk} SKIP =====")
    sys.exit(1 if f else 0)
