# Runbook A1-A8 — Operação do fluxo automatizado

> Guia prático para Daniel, Adriano e Leonora operarem o sistema após a
> entrega da [[decisoes/ADR_iniciativa_automacao_pedido_entrega|iniciativa de automação A1-A8]] (2026-05-21).
> Cobre o que faz cada novo recurso, como usar no dia a dia, e o que olhar
> quando algo parece estar errado.

**Última revisão:** 2026-05-21

---

## 1. Auto-release diário (cron)

### O que é

Todo dia útil, às **17:00 (horário de Brasília)**, o sistema percorre todos
os tenants ativos e libera automaticamente os pedidos que estão prontos
para produção (`availableForRelease=true`). O gestor não precisa abrir a
lista e clicar "Liberar" um por um.

### O que aparece no banco

Para cada pedido liberado pelo cron, é gravado um evento em
`store_order_events`:

- `event_type` = `liberacao_producao`
- `metadata.origin` = `"sistema"` (em vez de `"manual"`)
- `created_by_profile_id` = `null` (não foi um humano — foi o cron)

Quando o gestor clica "Liberar para produção" pela UI, o evento também é
`liberacao_producao` mas com `metadata.origin = "manual"` e
`created_by_profile_id` do gestor.

### Como verificar que rodou

1. Abra o Vercel dashboard → projeto → aba **Logs**.
2. Filtre por `auto-release` ou pelo path `/api/cron/auto-release`.
3. A linha de log final do dia mostra um JSON parecido com:

   ```json
   {
     "ok": true,
     "referenceDate": "2026-05-21",
     "tenantsProcessed": 3,
     "totals": { "released": 12, "skipped": 4, "failed": 1 },
     "perTenant": [
       { "tenantId": "...", "released": 8, "skipped": 2, "failed": 0 },
       { "tenantId": "...", "released": 4, "skipped": 2, "failed": 1, "error": null }
     ]
   }
   ```

4. **Interpretação:**
   - `released` — pedidos efetivamente liberados.
   - `skipped` — pedidos que já estavam liberados ou cancelados (nada a fazer).
   - `failed` — pedidos que falharam na validação do A1 (capacidade,
     planejamento inviável). **Não bloqueiam o batch** — o cron segue
     processando os outros tenants.

### Disparo manual

O botão **"Auto-liberar elegíveis"** no `/gestor-fabrica/pedidos` faz a
mesma coisa, mas executa imediatamente e amarra ao seu usuário (`origin=manual`).
Útil quando você quer rodar antes do horário do cron, ou quando o cron falhou
e você quer recuperar.

### Quando o cron NÃO dispara

- **`CRON_SECRET` não configurado:** o endpoint devolve 503. Verifique no
  Vercel Dashboard → Settings → Environment Variables se a variável existe
  em produção.
- **Vercel Cron desabilitado:** verificar `vercel.json` no repo e o painel
  de Cron Jobs no Vercel.
- **Tenant inativo:** só tenants com `status='ativo'` são processados.

---

## 2. Pedido bloqueado para produção — quando o gestor pode forçar

### O que acontece

Ao clicar **"Liberar para produção"**, o sistema valida no servidor antes de
liberar. Se houver problema, o pedido aparece **bloqueado** com motivo
explícito. Três motivos possíveis:

| Motivo | Pode forçar? | O que significa |
|---|---|---|
| `order_cancelled` | **NÃO** | Pedido cancelado pela loja ou gestor. Reabrir antes (botão "Reabrir pedido"). |
| `order_not_planned` | **SIM** | Pedido não aparece no planejamento de hoje. Provável causa: janela operacional incompatível, MPI sem cadastro, ou data fora do cronograma da linha. |
| `order_not_releasable` | **SIM** | Pedido planejável mas com algum item sem capacidade ou data inviável. Estouro de linha, sem schedule cobrindo o dia. |

### Como funciona o "Liberar mesmo assim"

1. Você clica "Liberar para produção".
2. Toast vermelho aparece com o motivo do bloqueio (ex: "pedido contém
   item(ns) sem produção planejável hoje — capacidade ou data inviável").
3. Se for um motivo **forçável**, abre automaticamente um diálogo:
   - **Título:** "Liberar o pedido {código} mesmo assim?"
   - **Descrição:** repete o motivo e avisa "A liberação ficará registrada
     como exceção (liberação forçada) no histórico do pedido."
   - **Botão "Liberar mesmo assim"** → confirma o override.
   - **Botão "Voltar"** → cancela.
4. Ao confirmar:
   - Pedido é liberado normalmente.
   - Toast amarelo: "Pedido {código} liberado com exceção (override do gestor)."
   - Evento `liberacao_forcada` é gravado em `store_order_events` (em
     adição ao `liberacao_producao`).

### Onde ver o histórico de exceções

Na timeline do pedido (`/gestor-fabrica/pedidos/[id]` → seção "Histórico"
ou `/loja/pedidos/[id]` → timeline), procure pelo evento com badge
diferenciada **"Liberação forçada"**.

Para um relatório agregado, filtre `store_order_events` por
`event_type = 'liberacao_forcada'` direto no Supabase.

### Quando usar o override

- Cliente VIP que pediu fora da janela e justifica o esforço extra.
- Linha próxima do limite mas o gestor sabe que terminou outra OP cedo.
- Cadastro de produto/cronograma com erro pontual que vai ser corrigido,
  mas o pedido não pode esperar.

### Quando NÃO usar

- Forçar liberação de pedido cancelado (não é permitido pelo sistema).
- "Forçar tudo" rotineiramente — o ponto do auto-release é precisamente
  evitar essa decisão repetida. Se você está forçando todo dia, **o
  cadastro tem problema**: cronograma muito apertado, capacidade subdimensionada,
  ou janela operacional mal configurada.

---

## 3. Tentativa de entrega falhada — registro estruturado

### O que mudou

Antes (até 2026-05-20):
- Falhou a entrega → operador clicava "Falha" → `delivery_executions.status`
  virava `tentativa_falha` (sobrescrevendo a anterior se houvesse).
- Sem motivo estruturado. Sem reagendamento.

Agora (a partir de 2026-05-21):
- Falhou a entrega → operador clica "Registrar falha" → abre **diálogo
  estruturado** com motivo + observação + reagendamento opcional.
- Cada falha grava uma linha nova em `delivery_attempts` — histórico completo,
  append-only.

### Como registrar uma falha

1. No `/chao-fabrica/entregas`, encontre a entrega em `em_rota` ou
   `no_destino`.
2. Clique **"Registrar falha"** (desktop) ou o botão equivalente no card
   mobile (depois do bugfix de auditoria, mobile e desktop usam o mesmo
   diálogo).
3. No diálogo:
   - **Motivo da falha** (obrigatório, escolher 1 dos 8):
     - Cliente ausente
     - Endereço errado
     - Recusa do cliente
     - Estabelecimento fechado
     - Avaria no veículo
     - Acesso bloqueado
     - Documentação pendente
     - Outro motivo
   - **Observação** (opcional, texto livre — útil pra "Outro motivo" ou
     detalhe específico do dia).
   - **Reagendar para** (opcional, data): se preenchido, o sistema sabe
     que essa entrega não foi cancelada, só adiada.
4. Clique **"Registrar tentativa"**.
5. O sistema:
   - Insere linha em `delivery_attempts` com `attempt_number` incremental
     por pedido.
   - Atualiza `delivery_executions.status` para `tentativa_falha`.
   - Grava evento `entrega_status` no `store_order_events` (visível pra loja).
6. Para retomar a entrega depois, clique **"Retomar rota"** — volta para
   `em_rota`.

### Onde ver o histórico

- **Na linha da entrega:** uma badge mostra `2ª tentativa` (ou similar)
  quando existem tentativas prévias falhadas.
- **Na timeline do pedido** (loja vê): cada tentativa aparece como evento
  cronológico.
- **Relatório agregado:** o card "Métricas operacionais" (ver seção 4)
  mostra falhas por motivo no período.

### Por que essa estrutura

- Antes, perder o histórico de "falhei 3 vezes nessa loja por endereço
  errado" era automático. Agora fica registrado.
- O cliente real (Daniel) precisa rastrear esse padrão pra decidir se troca
  cadastro de loja, muda janela, ou conversa com o destinatário.

---

## 4. Métricas operacionais — como ler

### Onde ficam

`/gestor-fabrica` (dashboard principal) → card **"Métricas operacionais"**.

Período padrão: últimos 7 dias. Atualiza a cada vez que a tela carrega.

### Os 4 tiles

#### Lead time médio

O tempo médio entre o primeiro e o último evento de produção por item.
Mostra também a média **por estágio** (Em preparação, Em produção, Em
forno, Embalando).

- **Origem:** eventos da `production_order_events` (tabela do A5).
- **Como interpretar:** se "Em forno" é o estágio mais demorado, é
  esperado — não é gargalo necessariamente. Se "Em preparação" é o mais
  demorado, vale ver se faltou MPI/ingrediente.
- **Tone:** sempre `info` (azul). Não há threshold automático — depende do
  produto.

#### OTIF (On Time In Full)

Percentual de pedidos entregues no prazo. Considera entrega antes do fim
do `delivery_date` como "no prazo".

| OTIF | Tone | Significa |
|---|---|---|
| ≥ 95% | Verde (success) | Excelente |
| 80% – 94,9% | Amarelo (warning) | Aceitável, dá pra melhorar |
| < 80% | Vermelho (danger) | Crítico |

**Limitação consciente:** a métrica usa "entregue até fim do dia D" como
prazo. Não considera janela horária real da loja. Se a loja exige
recebimento até 8:00 e foi entregue 14:00, ainda conta como "no prazo".
Refinar quando o schema ganhar `expected_delivery_time` no cadastro de loja.

#### Ocupação média

Soma de `scheduledKg / capacityKg` por linha, na média. Mostra também o
pico (linha mais carregada).

| Ocupação | Tone | Significa |
|---|---|---|
| < 70% | Azul (info) | Folga, dá pra absorver pedido extra |
| 70% – 89,9% | Amarelo (warning) | Saudável mas próximo do limite |
| ≥ 90% | Vermelho (danger) | Risco de estouro — qualquer pedido extra força override |

**Pré-requisito:** `production_lines.capacity_per_day_kg` cadastrado em
todas as linhas. Linha sem capacidade cadastrada não entra no cálculo.

#### Falhas de entrega

Total de tentativas falhadas no período + top 3 motivos.

- **0 falhas** → verde (success).
- **>0 falhas** → amarelo (warning), independentemente do volume.
- **Detalhe:** Top 3 motivos do enum (ex: "Cliente ausente: 4", "Endereço
  errado: 2").

---

## 5. Cadastrar `delivery_zone` das lojas

### Por que importa

O agrupamento de rotas (A8) prioriza `store.delivery_zone` (texto livre que
você cadastra). **Sem cadastro, cai no fallback** por janela de recebimento
— o que funciona, mas não captura o conhecimento operacional do gestor.

### Como cadastrar

1. Abra **`/gestor-dados/lojas`**.
2. Para cada loja, clique editar.
3. Procure o campo **"Zona de Entrega"** (logo abaixo do endereço/contato).
4. Preencha um texto livre identificando a região:
   - `"Centro"`, `"Zona Sul"`, `"Barra"`, `"Bairros A"`, etc.
   - Lojas com a mesma zona vão pra mesma rota.
5. Salve.

### O que acontece com o agrupamento

| Cenário | Como o sistema agrupa |
|---|---|
| Todas as lojas com `delivery_zone` | Por zona ("Zona Centro", "Zona Sul"). Dentro do grupo: ordena por janela horária. |
| Algumas com zona, outras sem | Mistura: lojas com zona viram um grupo cada, lojas sem caem no fallback "Janela HH:MM - HH:MM". |
| Nenhuma com zona | Tudo cai no fallback de janela. Funcional, mas você perde a curadoria manual. |
| Nem zona, nem janela | Cai em "Sem agrupamento" — rota livre, ordenação alfabética. |

### Boas práticas

- Mantenha a nomenclatura consistente: `"Zona Sul"` (não misturar com
  `"zona sul"`, `"ZS"`, `"Sul"`). O agrupamento é **case-sensitive parcial**
  mas confunde o gestor.
- Não tem limite de zonas. Crie quantas fizer sentido pra realidade do
  motoboy.
- Vazio = null = fallback. Não precisa preencher "Sem zona" como texto.

---

## 6. Histórico (timeline) da OP

### O que é

Toda mudança de status de item de produção (`updateProductionItemStatus`)
grava uma linha em `production_order_events` — tabela append-only indexada
por `planning_key` (chave estável da OP).

### Onde ver

`/gestor-fabrica/ordens-producao/[opId]` → card **"Histórico da OP"**.

Mostra cronologicamente:

- Cada transição de estágio (Em preparação → Em produção → ...).
- Quem fez (profile_id quando há) ou "Sistema" quando não há.
- Quanto tempo entre eventos.

### Quando o histórico parece incompleto

- **Eventos órfãos:** se o cadastro do produto/cronograma mudou no meio do
  caminho, a `planning_key` pode mudar e os eventos antigos não aparecem
  na timeline da nova OP. Comportamento esperado — eles continuam no banco
  com a chave antiga.
- **Eventos faltando:** se o operador avançou status pelo Supabase direto
  (sem passar pela UI), não houve gravação. Sempre operar via UI.

---

## 7. Troubleshooting

### Cron rodou mas nada foi liberado

Possíveis causas:

- **Nenhum pedido elegível:** todos os pedidos do dia já estavam liberados
  ou estavam bloqueados na validação. Olhe `skipped` e `failed` na resposta
  do log.
- **`failed > 0`:** validação do A1 bloqueou. Abra os pedidos manualmente
  e use "Liberar mesmo assim" se julgar correto.
- **Tenants inativos:** verifique `tenants.status` no Supabase. Só
  `'ativo'` é processado.

### Cron não dispara

⚠️ **O deploy é Netlify, que IGNORA `vercel.json`.** O agendamento vive em
`netlify/functions/cron-auto-release.mts` (Scheduled Function, `export const config`),
não naquele arquivo. Schedule atual: `0 21 * * *` = 18:00 BRT, logo após o corte.

1. **A função está publicada?** `curl -s -o /dev/null -w '%{http_code}'
   https://<site>/.netlify/functions/cron-auto-release` → **403** = publicada (a Netlify
   bloqueia invocação HTTP direta de scheduled function); **404** = não foi para o deploy.
2. **`CRON_SECRET` chegou no runtime?** Bata na rota com um token PROPOSITALMENTE errado —
   a rota checa a env ANTES do token, então nada é executado:
   `curl -H 'Authorization: Bearer invalido' https://<site>/api/cron/auto-release`
   → **401** = configurada; **503** = ausente no runtime.
3. **Se der 503:** a variável só entra em runtime num novo build. Site configuration →
   Environment variables → confirme scope cobrindo **Functions/Runtime** (não só Builds) e
   context **Production**, e dispare **Trigger deploy → Deploy site**.
4. **Logs:** a Scheduled Function não devolve body, então o `console.log` do `[cron]` é o
   registro de auditoria — veja em Logs → Functions.
4. **Inspecione o último log do path** `/api/cron/auto-release` no Vercel.

### Release falha de surpresa

- O dialog "Liberar mesmo assim" não apareceu? Verifique:
  - O motivo era `order_cancelled` (não-forçável). Reabra o pedido antes.
  - O erro veio em formato inesperado. Inspecione a Network do navegador —
    a mensagem `Invalid release: ...` é o sinal de que veio do A1.
- O pedido foi liberado mas não aparece no chão de fábrica? Verifique:
  - `productionDate` futura (status `agendado`) — ver
    [[Backlog de Ajustes#AJ-0013 — Visibilidade de pedido liberado para produção|AJ-0013]].
  - Cache de planning de 10s — espere um pouco ou recarregue.

### Timeline da OP não aparece

- **Nenhum evento ainda:** OP recém-criada, sem movimentação. Normal.
- **Eventos no banco mas tela vazia:** verifique se o `planning_key` da OP
  bate com o `production_item_key` na `production_order_events`. Quando o
  cadastro muda, a chave pode divergir (ver seção 6).
- **Erro 500 no endpoint** `GET /api/factory-planning/ops/[opId]/timeline`:
  inspecionar Vercel logs do path.

### Métricas todas em "—"

- **Sem amostras no período:** janela de 7 dias sem nenhuma movimentação
  registrada. Normal pra ambiente novo.
- **Sem capacidade cadastrada:** ocupação fica em "—" ou ignora linhas
  sem `capacity_per_day_kg`. Cadastrar nas linhas ativas.
- **Sem entregas concluídas:** OTIF em "—". Esperar fluxo completo
  acontecer pelo menos uma vez no período.

### Tentativa de falha em mobile não abre o diálogo

Verifique se o deploy contém o commit `b6212bf` (bugfix de auditoria). Antes
desse commit, o card mobile usava caminho legado e a falha não gravava em
`delivery_attempts`. Se ainda estiver acontecendo, esse é o sinal — força
um redeploy.

---

## Onde olhar pra cada coisa

| Quero ver... | Onde está |
|---|---|
| Status corrente do pedido | `/gestor-fabrica/pedidos` (lista) ou `/loja/pedidos/[id]` (timeline) |
| Eventos de pedido cronológicos | `store_order_events` no banco; `/loja/pedidos/[id]` na UI |
| Histórico de estágios de uma OP | `/gestor-fabrica/ordens-producao/[id]` → "Histórico da OP" |
| Tentativas de entrega falhadas | `/chao-fabrica/entregas` (badge na linha) + `delivery_attempts` no banco |
| Métricas (lead time, OTIF, ocupação, falhas) | `/gestor-fabrica` → card "Métricas operacionais" |
| Demanda agregada por produto | `/gestor-fabrica/pedidos` → card "Demanda por produto" |
| Cadastro de zona de entrega | `/gestor-dados/lojas` → editar loja → campo "Zona de Entrega" |
| Logs do cron | Vercel Dashboard → projeto → Logs → filtro `auto-release` |

## Referência cruzada

- ADR principal da iniciativa: [[decisoes/ADR_iniciativa_automacao_pedido_entrega]]
- Decisões anteriores que essa iniciativa pressupõe: [[decisoes/ADR_expansao_mpi_em_op]] (fase 1 e 2)
- Jornadas atualizadas: [[Jornada — Pedido da Loja]], [[Jornada — Produção do Dia]], [[Jornada — Expedição e Entrega]]
- Backlog: [[Backlog de Ajustes]]
