# XPAN — Backlog de ajustes vindos do Trello

## Contexto
Este documento foi gerado a partir de uma exportação JSON do Trello.
Objetivo: implementar no sistema XPAN os ajustes funcionais, visuais e de regra de negócio listados abaixo.

## Instruções para o agente
- Analise o repositório atual antes de alterar qualquer arquivo.
- Localize os módulos relacionados a:
  - cadastro de produtos
  - cadastro de ingredientes
  - linhas de produção
  - cronograma de produção
  - auditoria
  - telas em modo somente leitura
- Para cada item:
  - identifique arquivos impactados
  - proponha a alteração mínima necessária
  - implemente
  - atualize ou crie testes quando fizer sentido
- Ao final, gere um resumo por item com:
  - arquivos alterados
  - regra aplicada
  - riscos ou pontos pendentes

## Itens prioritários

### 1. Usuário master — modo somente leitura
**Problema**
Ao retornar da visualização em modo somente leitura do cliente, a tela continua bloqueada ao voltar para a tela do master.

**Resultado esperado**
Ao sair da visualização somente leitura e retornar ao contexto do usuário master, o sistema deve restaurar corretamente o estado de edição esperado.

**Tipo**
Bug

**Critério de aceite**
- o bloqueio não permanece indevidamente
- a tela volta ao comportamento normal do usuário master
- não afeta outras telas que usam modo somente leitura

---

### 2. Cronograma de produção — clareza para usuário leigo
**Problema**
A tela do cronograma não está clara o suficiente para quem apenas lança pedido e previsão de venda.

**Necessidade**
Explicitar melhor a relação entre:
- dia do pedido
- dia da produção
- dia da expedição/entrega
- dia previsto de venda

**Exemplo de regra citada**
- pedido na segunda
- entrega na quarta (D+2)
- venda a partir de quinta (D+3)

**Resultado esperado**
A interface deve deixar essa sequência muito clara, com linguagem simples.

**Tipo**
UX + regra de negócio

**Critério de aceite**
- usuário entende facilmente o fluxo sem conhecer engenharia de produção
- os dias aparecem com rótulos claros
- o cálculo e exibição respeitam a lógica configurada do cronograma

---

### 3. Parâmetros de cronograma — relação entre produção e expedição
**Problema**
É necessário criar relação explícita entre dia de produção e dia de expedição.

**Resultado esperado**
O sistema deve permitir configurar ou derivar corretamente essa relação, refletindo isso nas telas e cálculos envolvidos.

**Tipo**
Regra de negócio

---

### 4. Cadastro de produto — não sair da tela com pendências obrigatórias
**Problema**
No cadastro de produto novo havia campos obrigatórios pendentes e o fluxo saiu da janela ao finalizar.

**Resultado esperado**
O sistema deve impedir finalização enquanto existirem pendências obrigatórias e informar claramente o que falta preencher.

**Tipo**
Bug + validação

**Critério de aceite**
- não fecha nem conclui indevidamente
- destaca os campos obrigatórios faltantes
- exibe feedback visível

---

### 5. Feedback de erro no cadastro/edição
**Problema**
Ao salvar alteração em produto, o sistema não deu feedback visível; a mensagem ficou no cabeçalho da janela e o usuário estava rolado para baixo.

**Resultado esperado**
Mensagens de erro devem aparecer próximas da ação principal de salvamento ou em área fixa visível.

**Tipo**
UX

**Critério de aceite**
- erro sempre visível sem exigir scroll até o topo
- mensagem ligada claramente ao motivo da falha
- comportamento consistente em cadastros semelhantes

---

### 6. Renomeação de termos
**Mudanças desejadas**
- “Subcategoria” → “Linhas de produção”
- “Subcategoria operacional” → “Status”
- revisar nomes em cadastros de produto e matéria-prima
- usar “Nome completo” e “Nome reduzido” quando aplicável

**Tipo**
Padronização de nomenclatura

**Critério de aceite**
- labels, colunas, títulos e textos de apoio ficam consistentes
- não quebrar integrações nem regras já existentes
- preservar chaves internas se o texto exibido for apenas de interface

---

### 7. Cadastro de produto — linha de produção não deve vir pré-selecionada
**Problema**
No cadastro de produto, a linha de produção não deveria vir preenchida por padrão.

**Resultado esperado**
O campo deve iniciar vazio, exigindo escolha explícita do usuário quando necessário.

**Tipo**
UX + regra de preenchimento

---

### 8. Tabelas dos cadastros — ordenação por clique no cabeçalho
**Resultado esperado**
Permitir ordenar listagens ao clicar no cabeçalho da coluna.

**Tipo**
Feature de usabilidade

---

### 9. Dropdowns grandes — permitir filtro digitando
**Contexto**
Há listas com muitos ingredientes/clientes.

**Resultado esperado**
Campos de seleção devem permitir busca por texto.

**Tipo**
Feature de usabilidade

---

### 10. Campos com texto de exemplo
**Regras**
- campos textuais podem exibir exemplo sombreado
- campos numéricos devem evitar exemplos que induzam o usuário ao erro

**Tipo**
UX

---

### 11. Ingredientes — unidade de compra x unidade de consumo
**Problema**
Ingredientes podem ter unidade de compra diferente da unidade real de consumo.

**Exemplos**
- ovos: compra por dúzia, consumo por gramas/unidades
- óleo: compra por ml, consumo por kg

**Resultado esperado**
O cadastro e os cálculos devem suportar conversão entre unidade de compra e unidade de consumo, incluindo fator de quebra/conversão.

**Tipo**
Regra de negócio

**Critério de aceite**
- cadastro suporta as duas unidades
- conversão é reaproveitada em cálculos posteriores
- comportamento fica previsível em receita/custo/estoque, se aplicável

---

### 12. Receita do produto — calcular quantidade final por peso unitário
**Resultado esperado**
Na tela de receita, usar o peso unitário para calcular a quantidade/fração final do produto quando aplicável.

**Tipo**
Regra de negócio

---

### 13. Gestão de linhas de produção — versionamento
**Discussão registrada**
Há questionamento sobre manter histórico de versões. A sugestão registrada é não manter versões duplicadas da linha, e sim registrar log de alterações.

**Ação esperada**
Verificar implementação atual e avaliar ajuste para:
- evitar duplicação desnecessária de linhas
- manter histórico em log/auditoria

**Tipo**
Regra de negócio + arquitetura funcional

---

## Itens de menor prioridade
- botão para sair do modo somente leitura e abrir edição sem fechar popup
- opção “salvar e criar novo” em cadastro de ingredientes
- melhoria de prioridade/sequência manual nos cronogramas diários
- dúvidas sobre cadastro de loja e vínculo com gerente/usuário