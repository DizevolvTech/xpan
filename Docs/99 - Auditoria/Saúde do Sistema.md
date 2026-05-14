# Saúde do Sistema

> Semáforo de uma página. Atualizar ao final de cada leva grande de ajustes.

**Última atualização:** 2026-05-13 (consolidação inicial via 4 agentes de mapeamento)

| Área | Status | Comentário |
|---|---|---|
| Arquitetura | 🟢 | Next.js 16 + Supabase, padrão consistente, defesa em camadas correta |
| Multi-tenant (RLS) | 🟡 | 2 tabelas com RLS sem filtro de role (D01); `list_profile_labels` leak (D02) |
| Motor de cronograma | 🟡 | Lead days e drift recém-modelados; 8 itens críticos abertos (D03-D10, D13-D16) |
| Permissões (4×24) | 🟢 | Modelo claro, defesa em camadas funciona; ressalva: docs falam em 27, código tem 24 (D29) |
| Pedido da Loja | 🔴 | Duplicidade sem unique (D03); lote mínimo só no front (D09) |
| Produção (drop antes/depois forno) | 🟡 | Implementado, mas `breakPercent` ignorado pelo motor (D10), código OP volátil (D11) |
| Expedição/Entrega | 🟡 | Checklist depende de unit estável (D15); status com cache (D16) |
| Ocorrências | 🟡 | Funcional; SLA implícito |
| Onboarding tenant | 🟡 | Funciona; falta checklist documentado |
| Testes automatizados | 🔴 | Ausentes (D06) |
| CI/CD | 🔴 | Ausente (D28) |
| Observabilidade | 🔴 | Sem logs estruturados (D23) |
| Audit trail | 🟢 | `_events` em pedidos/ocorrências; `product_changelog` (mas pobre — D20) |
| Impressões | 🟡 | Fora de `appAreaPath` (D17) |

**Legenda:** 🟢 ok · 🟡 atenção · 🔴 risco

## Números reais (2026-05-13)

- **6 personas** (`administrador-master` adicionada tarde via `20260322105000`)
- **24 módulos** declarados em `permission-modules.ts` (a doc histórica fala em 27)
- **28 tabelas** em 6 domínios
- **18 ENUMs** (com `break_stage` carregando 2 valores deprecated impossíveis de dropar)
- **29 migrations** versionadas, +1 drift retroativo
- **~50 policies RLS** distintas
- **8 funções** no schema `public`
- **46 `page.tsx`** no App Router
- **~10 grupos de API** em `src/app/api/*`

## Áreas mais tocadas em maio 2026

```
ajustes ux maio 2026 (3 commits) — UI / hint reutilizável / aba produto
ajustes maio 2026             — cronograma, lead days, drift, loading
```

Ver [[10 - Changelog Vivo/2026-05|Changelog 2026-05]].

## Próximas decisões em aberto

- [ ] **Testes** para o motor (D06) — começa hoje?
- [ ] **Unique constraint** anti-duplicidade de pedido (D03)
- [ ] **Fix `list_profile_labels`** com filtro de tenant (D02)
- [ ] **RLS sem role** em `production_line_types` e `product_changelog` (D01)
- [ ] **Persistir `aguardando_expedicao`** ao invés de derivar (D05)

Ver [[Dívida Técnica]] (29 itens consolidados).

## Decisões boas a celebrar

- **Snapshots** em pedidos/itens (`product_code_snapshot`, `sales_to_kg_factor_snapshot`, etc.) — imune a mudanças posteriores em produtos/lojas.
- **`expedition_lead_days_snapshot`** em `store_orders` — pedido carrega o lead day do momento da criação.
- **`business_code_sequences` trancada** com `using(false)` + função `definer` — padrão correto de defesa.
- **Audit trail imutável** por falta proposital de DELETE policies em `store_orders` e ocorrências.
- **`anyOfPermissions`** clarifica cross-persona (7 endpoints) ao invés de copiar lógica.
- **Defesa em camadas** para `administrador-master` em `read-only-tenant` (3 pontos de verificação).
