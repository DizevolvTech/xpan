# Checklist de Ajustes — Xpan

> Extraído do board Trello "Xpan - Dizevolv - Asantos Assessoria" em 2026-04-06
> Total: **26 itens abertos** | **22 finalizados**

---

## 🔴 IMPORTANTES (Prioridade Alta)

- [ ] **PARAMETROS CRONOGRAMA — relação produção/expedição por produto**
  Criar relação entre dia de produção e dia de expedição por PRODUTO nos parâmetros do cronograma.

- [ ] **Status na Linha de Produção (LP) — fluxo inconsistente**
  Após rejeição de auditoria, LP aparece inativa na auditoria mas ativa no cadastro. Códigos divergem entre páginas de cadastro e auditoria. Falta forma de identificar itens sem LP aprovada.

- [ ] **PEDIDO DA LOJA — itens inativos aparecendo**
  Itens indisponíveis/inativos NÃO devem aparecer no formulário de pedido da loja. Exibir apenas itens ativos.

- [ ] **PEDIDO DA LOJA — cronograma com datas erradas**
  Data de produção aparece após data de entrega/venda (não faz sentido). Para a loja, o importante é QUANDO VAI VENDER. Hachura verde deve indicar dia de previsão de venda. Coluna de dia de produção (azul) NÃO deve aparecer para o usuário loja.

- [ ] **PEDIDO DA LOJA — confirmação de pedido e lote mínimo**
  Loja faz pedidos independente da capacidade da fábrica. O sistema deve consolidar pedidos de todas as lojas para verificar se o lote mínimo de produção foi atingido.

- [ ] **Meus Pedidos — DUPLICIDADE de pedidos**
  Loja consegue fazer o mesmo pedido múltiplas vezes. Fluxo correto: fábrica audita cronogramas e libera pedidos semanais (um por dia da semana). Loja seleciona qual dia preencher; finalizado, não pode refazer (apenas editar). Ao abrir pedidos, sistema deve alertar sobre linhas pendentes/em revisão.

---

## 🐛 BUGS

- [ ] **Cadastro de receitas — ingredientes apagados ao voltar**
  Ao criar ingrediente novo pelo atalho (botão dentro do cadastro de produto), ao retornar a lista de ingredientes já digitada é apagada.

- [ ] **CRONOGRAMA INCORRETO — produtos não aparecem**
  Produtos de teste atribuídos a cada dia da semana não aparecem disponíveis para pedido. Datas no topo da tela de pedidos estão erradas.

- [ ] **Cadastro de ingrediente na receita — bug no retorno do modal**
  Ao salvar ingrediente via modal, a página de cadastro do produto reverte todas as alterações para a última versão salva (ex: nome alterado é perdido).

- [ ] **Erro no ajuste de linha de produção — itens se movem juntos**
  Ao ativar 7 itens sequencialmente na aba da LP, todos moveram juntos para o cabeçalho do cronograma. Erro apareceu no cabeçalho.

- [ ] **Permissões de usuário — acesso indevido visível**
  Logado como usuário loja, permissões internas mostram acesso ao painel Master User (acesso não funciona, mas aparece na interface).

- [ ] **REGRAS GLOBAIS CRONOGRAMA — botão salvar bloqueado**
  Botão de salvar alterações no cronograma está bloqueado/desabilitado para o usuário administrador.

---

## ✨ FEATURES / MELHORIAS

- [ ] **Nova Linha de Produção — atalho para criar categoria**
  Adicionar atalho para criar nova categoria de dentro do modal "Nova Linha de Produção" sem precisar sair dele.

- [ ] **Linha de Produção — cadastrar tipos**
  Registrar tipos disponíveis para linhas de produção (ex: "Seco", "Congelado").

- [ ] **Logo e nome da empresa na sidebar**
  Exibir logotipo e nome da empresa do cliente no topo da sidebar quando logado na conta do cliente.

- [ ] **Histórico de alterações no produto (estilo commit)**
  Após criação do produto, novas alterações exigem descrição + assinatura (como um commit Git), criando log/histórico de todas as versões do produto.

- [ ] **Clonar produto**
  Adicionar botão de "Clonar Produto" no cadastro de produto.

- [ ] **Cadastro de ingredientes — 3 unidades de medida**
  Ingredientes precisam de: unidade de compra, unidade de consumo e fator de conversão. Ex: ovos — compra por dúzia, usa como 50g cada = 600g. Óleo de soja — compra 900ml, consome como 0,810kg.

- [ ] **Receita — campo de cálculo de frações**
  Na página de receita, o sistema calcula automaticamente o peso total de ingredientes. Criar campo para calcular a quantidade de frações final do produto baseado no peso unitário preenchido na primeira aba do cadastro.

---

## 🎨 UX / INTERFACE

- [ ] **Lista de ingredientes na receita — remover paginação**
  NÃO usar paginação na lista de ingredientes da receita. A lista completa deve estar sempre visível na página principal.

- [ ] **Cadastro de ingredientes — simplificar metadados**
  Simplificar campo de observações para apenas "lembretes" do ingrediente. Campo de instrução de uso faz mais sentido na receita (ao adicionar ingrediente com quantidade X, incluir campo de observação lá).

- [ ] **Meus Pedidos — tela de loading e título**
  (a) Tela "PEDIDO NÃO ENCONTRADO" induz ao erro — trocar por tela de loading enquanto acessa o banco. (b) Ajustar formatação do título.

- [ ] **PEDIDO DA LOJA — alerta ao finalizar com filtro ativo**
  Ao finalizar pedido com filtro ativo (ex: só bolos), checar se há itens vazios em outros grupos de filtro e alertar: "Continuar assim?" ou "Voltar e continuar o pedido".

- [ ] **PEDIDOS RECEBIDOS — colunas redundantes**
  Remover colunas redundantes na listagem de status de pedidos (info já está no detalhe expandido). Coluna de data de recebimento está confusa (1 dia após d+2 do cronograma).

- [ ] **EDITAR PEDIDO — janela de auditoria**
  Ao clicar "auditar pedido", abrir a janela original com previsões diárias ao invés da janela simplificada.

---

## ❓ DÚVIDAS (pendente definição)

- [ ] **Cadastro receita — unidade de medida no ingrediente**
  Ao inserir produto na receita, há campo de unidade de medida, mas a unidade já foi definida no cadastro do ingrediente. Qual o propósito de manipular a unidade aqui na engenharia de cálculo?

---

## ✅ FINALIZADOS

- [x] Repensar página de cronograma para pedidos (d+2 entrega, d+3 venda)
- [x] Revisão da engenharia do cronograma de produção
- [x] Click no cabeçalho da tabela para ordenar colunas
- [x] Dropdowns com busca para inserção de produtos (listas 1000+ ingredientes)
- [x] Cadastro de produto não pré-selecionar linha de produção
- [x] Renomear "Subcategoria" para "Linhas de Produção"
- [x] Validação de campos obrigatórios ao salvar produto
- [x] Renomear campos: "Nome completo" e "Nome reduzido" em vez de nome/descrição
- [x] Botão de reordenar ingredientes na receita
- [x] Cadastro de loja sem gerente obrigatório
- [x] Fluxo "salvar e criar novo" no ingrediente
- [x] Códigos do produto: "código da fábrica" e "código da loja"
- [x] Botão de atalho para editar em páginas read-only
- [x] Renomear cabeçalho e status da linha de produção
- [x] UX de rejeição de auditoria da LP
- [x] Correção do retorno do modo read-only do master user
- [x] Cadastro de loja sem usuário disponível
- [x] Posicionamento do toast de erro próximo ao botão salvar
- [x] Drag-and-drop de prioridade de produção para cronogramas diários
- [x] UX da tabela de gestão de linhas de produção
- [x] Adição da coluna "Nome reduzido"
- [x] Sistema de comunicação entre master e clientes (mensagens + status)

---

## Resumo

| Categoria         | Abertos | Feitos |
|-------------------|---------|--------|
| Importantes       | 6       | —      |
| Bugs              | 6       | —      |
| Features          | 7       | —      |
| UX / Interface    | 6       | —      |
| Dúvidas           | 1       | —      |
| Finalizados       | —       | 22     |
| **Total**         | **26**  | **22** |
