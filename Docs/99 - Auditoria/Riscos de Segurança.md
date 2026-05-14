# Riscos de Segurança

> Foco: superfícies onde bug = vazamento entre tenants, escalada de privilégio, ou perda de dados.

**Última revisão:** 2026-05-13 (pré-mapeamento profundo — será refinado por [[RLS Policies]] e [[Autorização de API]])

---

## Categoria 1 — Isolamento entre tenants

### R1.1 — RLS desativada por engano em tabela tenant-scoped
**Vetor:** migration cria tabela com `tenant_id` mas esquece `ENABLE ROW LEVEL SECURITY` e/ou policy.
**Impacto:** master ou role admin vê dados de qualquer tenant.
**Mitigação:** checklist obrigatório em [[Dívida Técnica]] após migration nova.
**Estado:** > ⚠️ A auditar.

### R1.2 — FK cruzando tenants
**Vetor:** `store_order_items.product_id` aponta para `products` de outro tenant.
**Impacto:** pedido de loja A referencia produto de tenant B.
**Mitigação:** trigger ou check constraint validando `tenant_id` em FKs sensíveis.
**Estado:** > ⚠️ A auditar.

### R1.3 — Cookie `da_master_tenant` adulterado
**Vetor:** usuário não-master modifica cookie e tenta acessar outro tenant.
**Impacto:** se cookie não validado contra `user_role`, escalada total.
**Mitigação:** validar que JWT.role = `administrador-master` antes de aplicar override do cookie. Cookie deve ser `HttpOnly` + `Secure` + assinado.
**Estado:** > ⚠️ Confirmar em `middleware.ts` e [[Autenticação e Sessão]].

---

## Categoria 2 — Autorização

### R2.1 — API sem `authorizeApiRequest`
**Vetor:** rota nova em `src/app/api/` não chama o helper.
**Impacto:** qualquer usuário autenticado faz ação fora da sua persona.
**Mitigação:** lint rule ou code review obrigatório. Ver [[Autorização de API]].

### R2.2 — Permissão por módulo verificada apenas no UI
**Vetor:** botão escondido no frontend mas API aceita request.
**Impacto:** usuário "visualizar" consegue "operar" via fetch direto.
**Mitigação:** API valida nível, não só presença do módulo.

### R2.3 — Server Actions sem revalidação de permissão
**Vetor:** Server Action chama mutation direta sem checagem de persona.
**Impacto:** mesmo de R2.1.

---

## Categoria 3 — Dados sensíveis e PII

### R3.1 — Logs vazando dados de cliente
**Vetor:** `console.log` em produção com payload de pedido.
**Impacto:** PII (telefone, endereço de loja) em logs do servidor.
**Mitigação:** revisão de logs antes de release.

### R3.2 — Sem retenção definida para `tenant_support_occurrences`
**Vetor:** ocorrências do SaaS acumulam indefinidamente.
**Impacto:** crescimento de banco; risco LGPD em caso de pedido de exclusão.

---

## Categoria 4 — Integridade de regras de negócio

### R4.1 — Snapshot lacrado modificado por drift
**Vetor:** drift retroativo reescreve `schedule_line_item_snapshots` lacrado.
**Impacto:** auditoria histórica perde valor.
**Mitigação:** flag `locked_at` em snapshot, drift respeita.
**Estado:** > ⚠️ Confirmar implementação.

### R4.2 — Pedido duplicado
**Vetor:** loja envia mesmo pedido duas vezes (clique duplo, race).
**Impacto:** fábrica produz dobrado.
**Mitigação:** unique constraint (`tenant_id`, `store_id`, `target_date`, `product_id`) em `store_order_items`?
**Estado:** > ⚠️ Confirmar em [[Regra — Pedido da Loja]].

### R4.3 — Race em liberação de ordem
**Vetor:** dois gestores liberam mesmo pedido simultaneamente.
**Impacto:** OPs duplicadas.
**Mitigação:** lock pessimista ou unique em (`order_id`).

---

## Categoria 5 — Sessão e auth

### R5.1 — Sessão Supabase sem refresh
**Vetor:** token expira e usuário perde estado mid-form.
**Impacto:** perda de pedido em edição.
**Mitigação:** middleware refresh + UI warning.

### R5.2 — Login por email sem 2FA
**Vetor:** credencial vazada.
**Impacto:** acesso total à persona.
**Mitigação:** habilitar TOTP no Supabase Auth (pelo menos para `administrador` e `administrador-master`).

---

## Como adicionar risco

Categorize em isolamento, autorização, PII, integridade de negócio, ou sessão. Sempre com vetor, impacto e mitigação.
