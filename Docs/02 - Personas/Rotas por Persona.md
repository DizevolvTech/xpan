# Mapa de Rotas por Persona

Árvore hierárquica de todas as rotas do App Router (`src/app/**/page.tsx`), agrupadas por persona, com a linha do `export default` em cada arquivo. Coletado em 2026-05-13.

> Convenção: cada bullet referencia `path:linha` onde `linha` é o `export default` do `page.tsx`.

---

## 0. Públicas (sem sessão)

- `/` (home — redireciona para landing) — `src/app/page.tsx:6`
- `/login` — `src/app/login/page.tsx:7`

Layout raiz: `src/app/layout.tsx`.

---

## 1. Persona `administrador-master`

Layout: `src/app/administrador-master/layout.tsx` (chama `AreaShellLayout areaGroup="administrador-master"`).

- `/administrador-master` — `src/app/administrador-master/page.tsx:29` (Painel SaaS)
- `/administrador-master/clientes` — `src/app/administrador-master/clientes/page.tsx:78`
  - `/administrador-master/clientes/[tenantId]` — `src/app/administrador-master/clientes/[tenantId]/page.tsx:80`
- `/administrador-master/perfil` — `src/app/administrador-master/perfil/page.tsx:3`

---

## 2. Persona `administrador`

Layout: `src/app/administrador/layout.tsx`.

- `/administrador` — `src/app/administrador/page.tsx:223` (Dashboard Executivo)
- `/administrador/usuarios` — `src/app/administrador/usuarios/page.tsx:116`
- `/administrador/ocorrencias` — `src/app/administrador/ocorrencias/page.tsx:6`
- `/administrador/perfil` — `src/app/administrador/perfil/page.tsx:3`

> Nota: como `roleAllowedGroups["administrador"]` inclui `gestor-dados`, `gestor-fabrica`, `chao-fabrica` e `loja` (`src/lib/permission-modules.ts:486`), o `administrador` também navega para as rotas dessas áreas via menu, mas elas ficam fisicamente nas pastas das outras personas.

---

## 3. Persona `gestor-dados`

Layout: `src/app/gestor-dados/layout.tsx`.

- `/gestor-dados` — `src/app/gestor-dados/page.tsx:27` (Visão Geral)
- `/gestor-dados/ingredientes` — `src/app/gestor-dados/ingredientes/page.tsx:55`
- `/gestor-dados/produtos` — `src/app/gestor-dados/produtos/page.tsx:31`
- `/gestor-dados/setores` — `src/app/gestor-dados/setores/page.tsx:52`
  - `/gestor-dados/setores/[sectorId]` — `src/app/gestor-dados/setores/[sectorId]/page.tsx:16`
- `/gestor-dados/linhas-producao` — `src/app/gestor-dados/linhas-producao/page.tsx:65`
  - `/gestor-dados/linhas-producao/[lineId]` — `src/app/gestor-dados/linhas-producao/[lineId]/page.tsx:64`
- `/gestor-dados/lojas` — `src/app/gestor-dados/lojas/page.tsx:68`
- `/gestor-dados/perfil` — `src/app/gestor-dados/perfil/page.tsx:3`

---

## 4. Persona `gestor-fabrica`

Layout: `src/app/gestor-fabrica/layout.tsx`.

- `/gestor-fabrica` — `src/app/gestor-fabrica/page.tsx:31` (Visão Geral)
- `/gestor-fabrica/sublinhas-producao` — `src/app/gestor-fabrica/sublinhas-producao/page.tsx:206` (Auditoria do cronograma ativo)
- `/gestor-fabrica/pedidos` — `src/app/gestor-fabrica/pedidos/page.tsx:46`
  - `/gestor-fabrica/pedidos/[orderId]` — `src/app/gestor-fabrica/pedidos/[orderId]/page.tsx:25`
- `/gestor-fabrica/ordens-producao` — `src/app/gestor-fabrica/ordens-producao/page.tsx:65`
  - `/gestor-fabrica/ordens-producao/[opId]` — `src/app/gestor-fabrica/ordens-producao/[opId]/page.tsx:32`
- `/gestor-fabrica/expedicao` — `src/app/gestor-fabrica/expedicao/page.tsx:74`
  - `/gestor-fabrica/expedicao/[expeditionId]` — `src/app/gestor-fabrica/expedicao/[expeditionId]/page.tsx:31`
- `/gestor-fabrica/ocorrencias` — `src/app/gestor-fabrica/ocorrencias/page.tsx:56`
- `/gestor-fabrica/perfil` — `src/app/gestor-fabrica/perfil/page.tsx:3`

---

## 5. Persona `chao-fabrica`

Layout: `src/app/chao-fabrica/layout.tsx`.

- `/chao-fabrica` — `src/app/chao-fabrica/page.tsx:15` (Visão Geral)
- `/chao-fabrica/ordens-producao` — `src/app/chao-fabrica/ordens-producao/page.tsx:64`
  - `/chao-fabrica/ordens-producao/[opId]` — `src/app/chao-fabrica/ordens-producao/[opId]/page.tsx:32`
- `/chao-fabrica/expedicao` — `src/app/chao-fabrica/expedicao/page.tsx:73`
  - `/chao-fabrica/expedicao/[expeditionId]` — `src/app/chao-fabrica/expedicao/[expeditionId]/page.tsx:31`
- `/chao-fabrica/entregas` — `src/app/chao-fabrica/entregas/page.tsx:93`
- `/chao-fabrica/perfil` — `src/app/chao-fabrica/perfil/page.tsx:3`

---

## 6. Persona `loja`

Layout: `src/app/loja/layout.tsx`.

- `/loja` — `src/app/loja/page.tsx:27` (Visão Geral)
- `/loja/pedidos` — `src/app/loja/pedidos/page.tsx:161`
  - `/loja/pedidos/[orderId]` — `src/app/loja/pedidos/[orderId]/page.tsx:93`
- `/loja/ocorrencias` — `src/app/loja/ocorrencias/page.tsx:83`
- `/loja/perfil` — `src/app/loja/perfil/page.tsx:3`

---

## 7. Área `/impressao` (compartilhada — fora do controle de áreas)

Rotas para imprimir documentos (escopo "impressão" definido em `src/lib/printing-documents.ts`). Não estão em `appAreaPath`, então **não disparam `isProtectedAppPath`** — passam pelo middleware sem redirect quando há sessão (verificar autenticação caso a caso nos próprios `page.tsx`).

- `/impressao/expedicao/[expeditionId]` — `src/app/impressao/expedicao/[expeditionId]/page.tsx:34`
- `/impressao/pedido-loja/[orderId]` — `src/app/impressao/pedido-loja/[orderId]/page.tsx:72`
- `/impressao/pre-pesagem/[opId]` — `src/app/impressao/pre-pesagem/[opId]/page.tsx:75`
- `/impressao/producao/[opId]` — `src/app/impressao/producao/[opId]/page.tsx:75`

> ⚠️ verificar: como `/impressao` não está em `appAreaPath` (`src/lib/permission-modules.ts:74-81`), `isProtectedAppPath` retorna `false`. **Acesso anônimo é teoricamente possível** se as próprias páginas não chamarem `resolveServerAccess`. Vale auditar os 4 `page.tsx` para confirmar guardas individuais.

---

## 8. Route groups vazios

Existem rascunhos de route groups que **não materializam rotas**:

- `src/app/(perfil-gestor-dados)/{ingredientes,linhas-producao,lojas,produtos,setores}/` — vazios
- `src/app/(perfil-gestor-fabrica)/{pedidos,sublinhas-producao}/` — vazios
- `src/app/(perfil-loja)/{ocorrencias,pedidos}/` — vazios

> ⚠️ verificar: estrutura aparentemente preparada para uma futura reorganização ou refatoração interrompida. Não afeta o roteamento porque não há `page.tsx` em nenhum deles. Pode ser limpeza pendente.

---

## 9. APIs (`src/app/api/`)

Não são "navegáveis" mas compõem a superfície de acesso. Grupos:

- `/api/auth/{login,logout}` — `src/app/api/auth/login/route.ts`, `logout/route.ts`
- `/api/me/profile` — `src/app/api/me/profile/route.ts`
- `/api/admin/users` + `[userId]` — protegidas por `administrador.usuarios`
- `/api/admin/support-occurrences[/...]` — protegidas por `administrador.ocorrencias`
- `/api/master/*` — protegidas por `administrador-master.clientes`
- `/api/master-data/*` — protegidas por permissões `gestor-dados.*`
- `/api/factory-planning[/workflow]` — `gestor-fabrica.dashboard`/`ops` (compartilhado com `chao-fabrica.*`)
- `/api/delivery-executions` — `gestor-fabrica.expedicao` OR `chao-fabrica.expedicao`
- `/api/store-orders[/...]` — `loja.pedidos` (e `gestor-fabrica.pedidos` em agregação)
- `/api/store-order-catalog` — `loja.pedidos`
- `/api/store-occurrences[/...]` — `loja.ocorrencias` OR `gestor-fabrica.ocorrencias`

---

## Resumo numérico

- **Páginas totais.** 46 `page.tsx`
- **Por persona (sem `/perfil` e fora `/impressao`/`/login`/`/`):**
  - administrador-master: 3 + perfil
  - administrador: 3 + perfil
  - gestor-dados: 7 + perfil (inclui detail pages)
  - gestor-fabrica: 9 + perfil
  - chao-fabrica: 5 + perfil
  - loja: 3 + perfil
- **Impressão.** 4
- **Públicas.** 2 (`/` e `/login`)
