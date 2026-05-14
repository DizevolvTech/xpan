# Domingo, sábado e feriados — dias fechados e impacto em D+X

## Resumo

**O sistema NÃO tem conceito de "feriado".** A única alavanca para fechar um dia é o array `orderingBlockedDays` / `receivingBlockedDays` por loja, ou simplesmente não incluir o dia em `orderingDays` / `receivingDays`.

> ⚠️ Frágil: feriado nacional, regional, ou ponto facultativo precisam ser tratados manualmente loja-a-loja. Não há tabela `holidays`, não há flag de "dia fechado da fábrica". Um feriado em quinta-feira que afete a fábrica inteira só pode ser comunicado bloqueando o dia em cada loja individualmente.

## Domingo

`domingo` é um valor válido de `ProductionWeekDay` (`production-planning.ts:24`) e participa do array `weekdayByIndex` no motor (`engine.ts:51-59`):

```ts
const weekdayByIndex: ProductionWeekDay[] = [
  "domingo",  // index 0 = Date.getDay() === 0
  "segunda", ...
];
```

Helpers específicos:
- `getStoreReceivesSunday` (`production-planning.ts:1303-1305`) — retorna `true` se `receivingDays.includes("domingo")`.
- `getStoreCanOrderSunday` (`production-planning.ts:1307-1309`) — retorna `true` se `orderingDays.includes("domingo")`.

> Implícito: não há lógica especial de fábrica para domingo. A fábrica produz domingo se o `scheduleItem.productionDays.includes("domingo")`. Se ninguém pediu produto pra domingo, não roda.

## Como dias fechados afetam D+X

`moveToNextAllowedWeekday` (`engine.ts:131-145`) é o coração da regra de pulo:

```ts
export function moveToNextAllowedWeekday(dateKey: string, allowedDays: ProductionWeekDay[]): string {
  if (allowedDays.length === 0) {
    return dateKey;  // ⚠ fail-open
  }

  let cursor = dateKey;
  for (let i = 0; i < 7; i += 1) {
    if (allowedDays.includes(getWeekDayKey(cursor))) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }

  return dateKey;  // ⚠ não achou em 7 dias → devolve original
}
```

> ⚠️ Frágil: dois fail-opens silenciosos:
> 1. Se `allowedDays = []` (loja sem dia operacional), o motor devolve o `dateKey` original — o sistema **aceita pedido em dia que a loja não opera**, sem erro.
> 2. Se em 7 dias nenhum é permitido (raro mas possível por bug de configuração), idem.

### Aplicações

- **Avanço de `baseDate`**: `getOperationalBaseDateByStoreRule` (`engine.ts:156-163`) pula para o próximo dia em `getEnabledOrderingDays(store)`.
- **Avanço de `deliveryDate`**: `getDeliveryDateByStoreRule` (`engine.ts:147-154`) pula para o próximo dia em `getEnabledReceivingDays(store)`.
- **Cálculo de `productionDate` candidate**: dentro de `resolveProductionDateInWindow` (`engine.ts:341-352`), o "comprimento real" do gap depende dos `receivingDays`:

```ts
const candidateDelivery = receivingDays.length > 0
  ? moveToNextAllowedWeekday(addDays(cursor, productExpeditionLeadDays), receivingDays)
  : addDays(cursor, productExpeditionLeadDays);
```

Ou seja: se a entrega calculada cai em domingo (e domingo não recebe), o motor empurra para segunda. Mas a busca regressiva por dia de produção considera isso — ela só aceita um dia de produção tal que **a entrega calculada bate exatamente** com o `deliveryDate` "alvo" já ajustado.

> ⚠️ Implícito: o comentário no código (`engine.ts:339`) chama isso de **"ajuste de domingo"**:
> ```ts
> // Busca regressiva: dia de produção tal que produção + gap (após ajuste de domingo) = entrega
> ```
> Mas o "ajuste de domingo" é, na verdade, "ajuste de qualquer dia não permitido em `receivingDays`". O nome do comentário é enganoso e amplifica a falsa impressão de que domingo é tratado especialmente.

## Impacto efetivo

### Cenário 1 — pedido com base em sexta, D+X = 2, sábado não recebe
- `baseDate = sexta`
- `addDays(sexta, 2) = domingo`
- `moveToNextAllowedWeekday(domingo, [seg,...,sab])` → segunda
- `deliveryDate = segunda` (efetivo **D+3**, mas label mostra D+2).

### Cenário 2 — pedido com cutoff passado em sexta-feira tarde
- `getBaseDateByCutoff` → sábado
- Se sábado estiver bloqueado em `orderingBlockedDays`, `moveToNextAllowedWeekday` → segunda
- `baseDate = segunda` (avançou **2 dias por causa do cutoff + bloqueio**).
- A UI tem dois alertas:
  - `cutoffAppliedMessage` (`page.tsx:308-319`): mostra que cutoff moveu de sex → sab.
  - `orderingWindowAdjustmentMessage` (`page.tsx:320-326`): mostra que dia bloqueado moveu de sab → seg.

> Boa: o front explicita as duas razões. Mas o backend (validação ou aprovação) não checa esses motivos — aceita silenciosamente.

### Cenário 3 — fábrica fechada por feriado (sem suporte nativo)

Não existe. Solução real:
- Bloquear o dia em todas as lojas (via `receivingBlockedDays` para todas).
- Remover o dia de `scheduleItem.productionDays` em todos os cronogramas ativos.
- Não há automação. Erro de uma loja não atualizada = pedido entra para dia "fechado de fato".

## Sábado

Por convenção dos mocks (`production-planning.ts:432-433`): a maioria das lojas recebe e pede sábado, mas há lojas que não (ex.: `production-planning.ts:446-447` inclui domingo). Não há regra de motor.

## Resumo prático

| Pergunta | Resposta |
|---|---|
| Domingo é "dia fechado de fábrica" por default? | Não. Depende de `scheduleItem.productionDays`. |
| Feriado nacional é tratado? | Não. |
| `D+2` pode virar `D+3` por causa de bloqueio? | Sim, silenciosamente. |
| O label `D+X` na UI considera ajuste de bloqueio? | Não — é puramente `expeditionLeadDays` da settings. |
| Loja sem `orderingDays` configurado bloqueia pedidos? | Não — `moveToNextAllowedWeekday` devolve a data original. |
