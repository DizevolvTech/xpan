# Pendências do vídeo de ajustes (28/09/26) — aguardando resposta do cliente

> Itens do vídeo "Gravação ajustes Xpan 28set26" (22 min) que **não foram feitos** porque dependem de resposta do cliente ou do Daniel. Guardado em 06/10/2026 por decisão do Lucas, para retomar quando as respostas chegarem. Nada aqui foi alterado no sistema.

**Já entregue e fora desta lista:** código do cliente (ERP/GTIN) em telas e impressões; versões do produto com restauração. Ver `Docs/10 - Changelog Vivo/2026-10.md` (entrada de 06/10).

**Regra para retomar:** só mexer em cada item depois da resposta indicada. Itens 1 e 2 alteram cálculo de produtos já calibrados — não implementar por inferência.

---

## 1. ✅ FEITO 08/10 — Sobra assada soma (cliente respondeu 07/10)

> Assado efetivo = Kg assados + sobra. Ver `Docs/10 - Changelog Vivo/2026-10.md` (entrada de 08/10). O texto abaixo é o histórico da dúvida.

- **Vídeo (13:10–13:45):** o cliente quer *Assado efetivo = assados padrão + sobra* (74,375 + 0,136 = 74,511) e diz "não diminui, tem que somar". Na planilha dele "Kg assados" são só as unidades padrão e a sobra vem à parte.
- **Sistema hoje:** `effectiveBakedKg = bakedKg − leftoverBakedKg` (`src/lib/lab-test.ts`), com teste "sobra assada entra no assado efetivo (kg_assados − sobra)" e a legenda "Kg assados − sobra assada" na tela. Feito de propósito (commit `fa646d8`).
- **Não é erro de conta:** os dois estão certos para o que cada um chama de "Kg assados". O que muda é o significado do campo.
- **Depende de:** cliente (pergunta 1) e Daniel (pergunta 9).
- **Risco de mexer:** altera o rendimento de produtos já calibrados no jeito atual. Se confirmado "soma", decidir também o que acontece com os produtos existentes.
- **Também relacionado:** o cliente vê peso da unidade crua 143 × 142,8 e quebra 434 × 417 (14:09–14:34). Parte pode vir deste item; o resto precisa da planilha dele ao lado da tela (pergunta 2). O valor 141,771 veio da transcrição automática e deve ser confirmado.

## 2. ✅ FEITO 08/10 — Mix de produtos por loja (cliente respondeu 07/10)

> Resposta: o mix é **por loja** e funciona como **filtro padrão dos lotes abertos** (qual loja vê qual produto por padrão). Pedido manual e encomenda fora do padrão **não são bloqueados**. Decisão (Lucas 08/10): marcar na loja, padrão todos os produtos. Entregue: ver `Docs/10 - Changelog Vivo/2026-10.md` (entrada de 08/10). Falta o cliente informar quais produtos cada loja vende.

- **Vídeo (16:21–17:25):** nem todo produto existe em todas as lojas (ex.: submercado × atacado; no Chama, a loja A1 tem 30–40% do mix). No **pedido manual** o produto fora do mix não pode aparecer para o analista. Em pedido automático, "ok".
- **Sistema hoje:** não existe mix por loja. Só há "disponível para pedido" (vale para todas as lojas). `buildStoreOrderCatalog` não filtra por loja.
- **Recomendação registrada:** marcar o mix **na loja** (escolhe os produtos que ela recebe), com padrão "todos os produtos" — loja nova e cliente sem mix continuam como hoje. Marcar no produto exigiria listar as 16 lojas em cada item.
- **Depende de:** perguntas 3 e 4 (vale também para importação por planilha? quais produtos ficam fora de cada loja?).

## 3. Produto vendido em kg e produzido em unidade (peso equivalente para o ERP)

- **Vídeo (18:24–18:58):** produz-se em unidade, mas o ERP do cliente baixa em kg; é preciso enviar o peso equivalente em kg. "Então a gente tem que ver isso."
- **Sistema hoje:** existe `salesToKgFactor` e `internalKg`; não há saída/arquivo para o ERP do cliente.
- **Depende de:** pergunta 5 (qual peso o ERP deve receber).

## 4. Importação de pedido adaptável à planilha de cada cliente

- **Vídeo (19:14–19:45):** cada ERP gera um Excel diferente; o sistema deveria se adaptar à planilha do cliente, não exigir o nosso modelo.
- **Sistema hoje:** `order-excel.ts` exige as colunas `loja`, `produto`, `quantidade` (modelo XPAN). A coluna do produto já aceita o código do ERP do cliente.
- **Depende de:** pergunta 6 (exemplo real de planilha de pedido de cada cliente: Chama, Mistoquentaria etc.).

## 5. Tela de unidades do produto (conversa de escopo, adiada pelo próprio cliente)

- **Vídeo (08:33–09:50):** campos duplicados; expedição aparece em "Un" e em "Kg" ao mesmo tempo; não achou como desligar a "embalagem individual"; quer sequência lógica e menos informação. Disse que é "ajuste depois" e "conversa depois".
- **Sistema hoje:** grade Embalagem · Venda · Produção · Expedição (`product-form-dialog.tsx`).
- **Não é pergunta de ordem** (a pergunta 10 foi retirada). Tratar como ajuste de tela: mostrar um desenho antes de mexer.

## 6. Dúvidas do cliente que não são pedido

- **"Mínima produção" (15:17–15:27):** ele não sabe para que serve. No sistema é só alerta na OP, não trava e não define batida (a própria tela diz isso). Confirmar com o Daniel se há outra função (pergunta 8).
- **Aprovação da linha de produção por um superior (15:57–16:18):** ele acha desnecessária. O sistema já não exige segunda pessoa: quem tem a permissão de auditar o cronograma aprova. Sem mudança.
- **Exemplo do código na impressão (20:00–22:09):** ele não conseguiu achar uma tela que ainda mostrasse o código da fábrica. Já tratado no item entregue; se ele indicar a tela, conferir (pergunta 7).

---

## Perguntas pendentes (resumo)

**Cliente:** 1 sobra incluída em "Kg assados"? · 2 planilha × tela do mesmo produto · 3 mix vale para importação? · 4 produtos fora do mix de cada loja · 5 peso equivalente em kg para o ERP · 6 planilhas de pedido de cada cliente · 7 tela que ainda mostrava código da fábrica.
**Daniel:** 8 função da "mínima produção" · 9 a subtração da sobra foi intencional?

> Limites da análise: a transcrição do vídeo é automática (errou termos como "GTIN" → "JETIN"); só 68 quadros e 7 em alta resolução foram vistos.
