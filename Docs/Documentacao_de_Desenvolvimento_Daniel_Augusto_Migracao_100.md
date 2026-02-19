## SUMÁRIO GERAL
1. **Perfil: Gestor de Dados Mestre (Engenharia)**
2. **Perfil: Gestor de Fábrica**
3. **Perfil: Responsável de Loja**
4. **Estrutura de Dados**
5. **Regras de Negócio**
6. **Fluxos de Integração**
---
# PARTE 1: GESTOR DE DADOS MESTRE (ENGENHARIA)
## 1. Visão Geral do Perfil
O **Gestor de Dados Mestre (Engenharia)** é o usuário responsável por cadastrar e gerenciar todos os
dados fundamentais que fazem a plataforma funcionar. Este perfil possui acesso completo aos módulos de
configuração e cadastro das entidades mestres do sistema.
**Permissões de acesso:**
- Gestão de Ingredientes (materials)
- Gestão de Produtos (produtos)
- Gestão de Setores (setores)
- Gestão de Linhas de Produção (linhas_producao)
- Gestão de Lojas (lojas)
- Gestão de Embalagens
- Gestão de Rotas de Expedição
---
## 2. Dashboard - Visão Geral de Dados
**Página:** `Visão Geral da Gestão de Dados`
A tela inicial do Gestor de Dados Mestre apresenta um dashboard com cartões de acesso rápido aos principais
módulos de gestão e indicadores gerais do sistema.
### 2.1 Indicadores (KPIs)
- **Registros Ativos:** Total de 1.234 registros cadastrados
- **Última Atualização:** Informação atualizada há 15 minutos
- **Clientes Cadastrados:** 233 clientes/lojas
### 2.2 Cartões de Navegação
Cada cartão representa um módulo de gestão com:
- Ícone identificador
- Título do módulo
- Descrição breve
- Botão "Gerenciar"
Módulos disponíveis:
1. Gestão de Ingredientes
2. Gestão de Produtos
3. Gestão de Setores
4. Linhas de Produção
5. Gestão de Lojas
6. Gestão de Embalagens
7. Rotas de Expedição
---
## 3. Gestão de Ingredientes
**Página:** `Gestão de Ingredientes` 
**Tabela no banco:** `materials`
### 3.1 Visão de Lista
**Indicadores:**
- **Registros Ativos:** 29 Ingredientes
- **Última Atualização:** Há 11 dias
**Campos de Busca e Filtros:**
- Código do Ingrediente
- Nome do Ingrediente
**Colunas da Tabela:**
- **Código:** Identificador único (ex: IN-572015)
- **Nome:** Nome do ingrediente (ex: farinha)
- **Tipo:** Classificação (puro, misturado)
- **Un. Medida:** Unidade padrão (kg, litros)
**Ações por registro:**
- **Visualizar (ícone olho):** Exibe detalhes
- **Editar (ícone lápis):** Abre modal de edição
- **Excluir (ícone lixeira):** Remove ingrediente
### 3.2 Cadastro de Novo Ingrediente
**Modal:** `Cadastrar Novo Ingrediente`
**Campos obrigatórios (*):**
- **Nome do Ingrediente:** Campo texto
- **Tipo:** Dropdown (Puro, Misturado, etc.)
- **Unidade de Medida:** Dropdown (Kg, Litros)
**Ações:**
- "Cadastrar Ingrediente" (salva)
- "Cancelar" (fecha sem salvar)
### 3.3 Edição de Ingrediente
**Modal:** `Editar Ingrediente`
**Campos editáveis:**
- Código (somente leitura)
- Nome
- Tipo
- Unidade de Medida
---
## 4. Gestão de Produtos
**Página:** `Gestão de Produtos` 
**Tabela no banco:** `produtos`
### 4.1 Visão de Lista
**Indicadores:**
- **Registros Ativos:** 14 Produtos
- **Última Atualização:** Há 14 dias
**Colunas da Tabela:**
- **Código:** Código único (ex: PR-83374)
- **Nome:** Nome do produto (ex: pão frances)
- **Linha Produção:** Linha associada
- **Ativo?:** Status (Sim/Não)
- **Peso Unitário:** Peso de cada unidade (ex: 2 Kg)
- **Validade:** Prazo em dias (ex: 5 dias)
**Ações:**
- **Visualizar (ícone olho)**
- **Editar (ícone lápis)**
- **Excluir (ícone lixeira)**
### 4.2 Cadastro de Novo Produto
**Modal:** `Cadastrar Novo Produto`
Dividido em seções:
#### Seção: Dados do Produto
**Campos básicos obrigatórios (*):**
- **Nome do Produto:** Ex: Pão Francês
- **Linha de Produção:** Dropdown
- **Descrição:** Campo texto
- **Quebra (%):** Percentual de perda
- **Rendimento (%):** Valor padrão 10.0
- **Validade (dias):** Prazo (ex: 5)
- **Permite Armazenamento?:** Sim/Não
**Produção:**
- **Produção Mínima:** Ex: 200kg
- **Produção Econômica:** Ex: 200kg
**Dias de Produção (checkboxes):**
- Segunda a Domingo (seleção dos dias em que o produto pode ser produzido)
#### Seção: Unidades de Medida e Conversões
**IMPORTANTE:** Esta é a seção crítica onde se define como a loja verá e fará pedidos deste produto.
**📦 Unidade de Venda (Como a Loja Pede):**
- **Unidade de Venda:** Ex: Kg, Unidades, Formas, Gramas, Dúzias, Bandejas, Pacotes
- **Fator de Conversão (KC):** Multiplicador para converter para Kg
 - Exemplo: Se Unidade = "Unidades" e peso = 0.5 Kg por unidade, Fator = 0.5
 - Significado: 1 Unidade = 0.5 Kg, então 200 Unidades = 100 Kg
**🏭 Unidade de Produção (Padeiro):**
- **Unidade de Produção:** Ex: forma, assadeira, tela, kg
- **Fator de Conversão (KC):** Multiplicador equivalente
- Nota: Sistema internamente sempre trabalha em Kg
**🚚 Unidade de Expedição (Embalagem):**
- **Unidade de Expedição:** Ex: pacote, caixa, carrinho, saco
- **Fator de Conversão (KC):** Multiplicador
- **Quantidade por Embalagem (opcional):** Número de unidades por embalagem
**Rota e Ingrediente MPI:**
- **Rota de Expedição:** Dropdown
- **É um ingrediente MPI?:** Sim/Não (define se o produto também é matéria-prima)
#### Seção: Ingredientes
Tabela de composição do produto.
**Campos:**
- **Nome do Ingrediente:** Dropdown com ingredientes disponíveis
- **Quantidade:** Campo numérico
- Botão "+" para adicionar
**Lista de Ingredientes Adicionados:**
- Tabela com: Código, Nome, Un. Medida, Quantidade, Ações
#### Seção: Modo de Preparo
Editor de texto rico com ferramentas de formatação.
---
## 5. Gestão de Setores
**Página:** `Gestão de Setores` 
**Tabela no banco:** `setores`
### 5.1 Visão de Lista
**Indicadores:**
- **Registros Ativos:** 3 Setores
- **Última Atualização:** Há 22 dias
**Colunas da Tabela:**
- **Código:** Identificador único
- **Nome:** Nome do setor
- **Nº Linhas de Produção:** Quantidade de linhas
- **Status:** Ativo/Inativo
- **Usuário Responsável:** Nome do gestor
**Ações:**
- **Visualizar**
- **Editar**
- **Excluir**
### 5.2 Cadastro de Novo Setor
**Modal:** `Cadastrar Novo Setor`
**Campos obrigatórios (*):**
- **Nome do Setor:** Ex: Confeitaria
- **Usuário Responsável:** Dropdown
- **Descrição do Setor:** Campo texto
### 5.3 Edição de Setor
**Modal:** `Editar Setor`
**Campos:**
- Código (somente leitura)
- Status
- Nome
- Linhas de Produção (informativo)
- Usuário Responsável
- Descrição
---
## 6. Linhas de Produção
**Página:** `Linhas de Produção` 
**Tabela no banco:** `linhas_producao`
### 6.1 Visão de Lista
**Indicadores:**
- **Registros Ativos:** 9 Linhas de Produção
- **Última Atualização:** Há 14 dias
**Colunas da Tabela:**
- **Código:** Identificador único
- **Nome:** Nome da linha
- **Setor:** Setor vinculado
- **Tipo:** Classificação (seco, etc.)
- **Horário de Funcionamento:** Período operacional
- **Status:** Ativo/Inativo
### 6.2 Cadastro de Nova Linha de Produção
**Modal:** `Nova Linha de Produção`
**Campos obrigatórios (*):**
- **Nome da Linha de Produção:** Ex: Pão Francês
- **Capacidade de Produção - Dia (Kg):** Ex: 200Kg
- **Setor:** Dropdown
- **Tipo:** Dropdown
- **Horário de Funcionamento:** Campos de hora (início e fim)
- **Descrição da Linha de Produção:** Campo texto
### 6.3 Visualização Detalhada de Linha de Produção
**Página:** `Detalhes da Linha - Teste Linha Bolo`
#### Seção Esquerda: Informações Gerais
**Campos:**
- Código de Linha
- Data de Cadastro
- Setor Associado
- Horário de Funcionamento
- Descrição
- Botão "Editar Linha de Produção"
#### Seção Direita: Sublinhas de Produção
**Botão:** "+ Nova Sublinha de Produção"
**Lista de Sublinhas:** Cada uma em um card com:
- Código e nome
- Data de criação
- Número de produtos
- Data de referência
- Ações (editar, excluir)
#### Visualização Expandida da Sublinha
**Grade de Produção Semanal:**
Tabela com produtos por dia da semana, mostrando para cada dia:
- Ícone de calendário
- Nome do dia
- Número de produtos
- Cards de produtos com código, nome, produção mínima, peso
---
## 7. Gestão de Lojas
**Página:** `Gestão de Lojas` 
**Tabela no banco:** `lojas`
### 7.1 Visão de Lista
**Indicadores:**
- **Registros Ativos:** 2 Lojas
- **Última Atualização:** Há 4 dias
**Colunas da Tabela:**
- **Código:** Código único
- **Nome:** Nome da loja
- **Usuário Responsável:** Gestor
- **Unidade Padrão:** Unidade padrão
- **Horário Limite:** Hora limite para pedidos
- **Status:** Ativo/Inativo
### 7.2 Cadastro de Nova Loja
**Modal:** `Cadastrar Loja`
**Seção: Informações Básicas**
**Campos obrigatórios (*):**
- **Nome da Loja:** Ex: Empório do Pão
- **Endereço:** Ex: Rua X, 123
- **Usuário Responsável:** Dropdown
- **Email:** Ex: loja@email.com
- **Telefone:** Ex: (99) 99999-9999
**Configurações Operacionais:**
- **Unidade de Medida Padrão:** Dropdown (este é apenas informativo, cada produto tem sua unidade)
- **Horário Limite Pedido:** Campo de hora
- **Expedição (D+X):** Dropdown (D+0, D+1, D+2, D+3) - **CRÍTICO PARA O SISTEMA**
**Descrição:**
- Campo texto
**Seção: Horários para Recebimento**
Grade semanal com campos de hora para cada dia (Seg, Ter, Qua, Qui, Sex, Sab, Dom).
---
## 8. Lógica de Negócio: Sistema de Pedidos e Cronogramas
### 8.1 Conceito: Cronologia Bivalente
O sistema trabalha com **duas perspectivas temporais** para o mesmo fluxo:
**Perspectiva 1 - Cronograma de Pedido (Loja):**
- Organizado por **dia de VENDA**
- Usado pela loja para fazer pedidos
- Pergunta: "Quando vou vender?"
**Perspectiva 2 - Cronograma de Produção (Fábrica):**
- Organizado por **dia de PRODUÇÃO**
- Pergunta: "Quando vou produzir?"
### 8.2 Parâmetros do Sistema
#### Parâmetro da Loja: Expedição (D+X)
Define a relação entre **dia do pedido** e **dia da venda**.
**Opções:**
- **D+0:** Pedido hoje → Venda hoje
- **D+1:** Pedido hoje → Venda amanhã
- **D+2:** Pedido hoje → Venda em 2 dias
- **D+3:** Pedido hoje → Venda em 3 dias
**Exemplo com D+3:**
```
Pedido SEGUNDA → Venda QUINTA
Pedido TERÇA → Venda SEXTA
Pedido QUARTA → Venda SÁBADO
```
**Característica:** Parâmetro **geral** para **todos** os produtos da loja.
#### Parâmetros do Produto
Cada produto possui dois parâmetros independentes:
**A) Dias de Produção da Semana**
Define em quais dias da semana o produto pode ser produzido (checkboxes no cadastro).
**Exemplo - Pão Francês:**
- ✅ Segunda
- ✅ Terça
- ❌ Quarta
- ❌ Quinta
- ✅ Sexta
- ❌ Sábado
- ❌ Domingo
**B) Dias entre Produção e Venda**
Define quantos dias antes da venda o produto deve ser produzido (campo no cadastro).
**Opções:**
- **0 dias:** Produz e vende no mesmo dia
- **1 dia:** Produz hoje, vende amanhã
- **2 dias:** Produz hoje, vende em 2 dias
### 8.3 Fluxo de Cálculo do Sistema
**Passo 1:** Loja faz o pedido (ex: segunda-feira)
**Passo 2:** Sistema calcula o dia da venda
```
Pedido Segunda + D+3 = Venda Quinta
```
**Passo 3:** Para cada produto, calcula quando produzir
```
Produto A: Venda Quinta - 1 dia = Produção Quarta
Produto B: Venda Quinta - 0 dias = Produção Quinta
Produto C: Venda Quinta - 2 dias = Produção Terça
```
**Passo 4:** Valida se o dia está nos dias permitidos
```
Produto A produz: Segunda/Quarta
Dia calculado: Quarta ✅ OK!
Produto C produz: Segunda/Sexta
Dia calculado: Terça ❌ Não permitido!
Sistema ajusta: Procura dia anterior permitido = Segunda ✅
```
**Passo 5:** Cria ordens de produção separadas por dia
```
1 PDF para Segunda (Produto C)
1 PDF para Quarta (Produto A)
1 PDF para Quinta (Produto B)
```
**Passo 6:** Na data de entrega, todos os produtos são reunidos em uma expedição
### 8.4 Sublinhas de Produção
As **Sublinhas de Produção** (cronogramas) são agrupamentos de produtos dentro de uma Linha de
Produção.
**Características:**
- Vinculadas a uma Linha de Produção específica
- Definem **quais produtos** estarão disponíveis para pedido
- Organizam produtos por **dia da semana de produção**
- Precisam ser **aprovadas pelo Gestor de Fábrica**
- Após aprovação, produtos aparecem disponíveis para lojas
**Estrutura:**
- Código da Sublinha
- Nome descritivo
- Data de referência
- Status (Ativo/Inativo/Aguardando Aprovação)
- Lista de produtos por dia da semana
---
# PARTE 2: GESTOR DE FÁBRICA
## 1. Visão Geral do Perfil
O **Gestor de Fábrica** é responsável por fazer gestão operacional e auditoria dos processos de produção e
pedidos.
**Responsabilidades principais:**
- Aprovar ou reprovar Sublinhas de Produção
- Gerenciar pedidos recebidos
- Auditar e monitorar o fluxo de produção
- Liberar produtos para pedidos
**Diferencial:** Apenas sublinhas aprovadas ficam disponíveis para lojas fazerem pedidos.
---
## 2. Navegação Principal
**Abas:**
- **Gestão de Pedidos**
- **Sublinhas de Produção**
---
## 3. Gestão de Sublinhas de Produção
**Página:** `Visão Geral - Sublinhas de Produção`
### 3.1 Dashboard de Sublinhas
**Indicadores (KPIs):**
- **Total de Cronogramas:** 8 sublinhas (azul)
- **Pendentes:** 0 aguardando aprovação (amarelo)
- **Ativos:** 5 sublinhas aprovadas (verde)
- **Reprovados:** 3 sublinhas reprovadas (vermelho)
### 3.2 Visão de Lista - Sublinhas
**Filtros:**
- Código
- Nome
- Criado por (Dropdown)
- Status
**Colunas da Tabela:**
- **Código:** Identificador (ex: SL-8397)
- **Nome:** Nome descritivo
- **Data Referência:** Data base
- **Status:** Ativo, Reprovado
- **Data de Cadastro:** Quando foi criada
- **Criado Por:** Usuário criador
**Ações:**
- **Visualizar (ícone olho)**
- **Imprimir (ícone impressora)**
### 3.3 Visualização Detalhada de Sublinha\
**Página:** `Detalhes do Cronograma SL-8397` (Status: Ativo)
**Botão superior:** "Imprimir Sublinha de Produção"
#### Seção Esquerda: Informações Gerais
**Campos:**
- Nome do Cronograma
- Data do Cadastro
- Linha de Produção
- Data da Referência
- Observação
- Usuário Responsável
- Última Atualização
#### Seção Direita: Lista de Produtos
**Tabela com:**
- Código
- Nome do Produto
- Produção Mínima
#### Seção Inferior: Grade de Produção Semanal
Visualização por dia da semana, mostrando quais produtos serão produzidos em cada dia com:
- Código e Nome do produto
- Produção Mínima
- Peso Unitário
---
## 4. Gestão de Pedidos (Visão do Gestor de Fábrica)
**Página:** `Visão Geral - Gestão de Pedidos`
### 4.1 Dashboard de Pedidos
**Indicadores (KPIs):**
- **Total de Pedidos:** 1.234 (azul)
- **Pendentes:** 32 (amarelo)
- **Em Produção:** 32 (azul claro)
- **Em Espera:** 12 (azul claro)
- **Rota de Entrega:** 32 (verde)
### 4.2 Visão de Lista - Pedidos
**Filtros:**
- Data (dd/mm/aaaa)
- Código
- Loja
- Status do Pedido
**Colunas da Tabela:**
- **Código:** Identificador
- **Data:** Criação
- **Data Prevista para Entrega:** Data programada
- **Cronograma de Expedição:** Cronograma associado
- **Status do Pedido:** Estado atual
- **Ações:** Visualizar, Imprimir
---
## 5. Fluxo de Aprovação de Sublinhas
### 5.1 Processo de Aprovação
**Passo 1: Criação**
- Gestor de Dados Mestre cria Sublinha
- Status: "Pendente"
**Passo 2: Revisão**
- Sublinha aparece como "Pendente" para Gestor de Fábrica
- Analisa viabilidade operacional
**Passo 3: Decisão**
- **Aprovar:** Status → "Ativo" (produtos ficam disponíveis)
- **Reprovar:** Status → "Reprovado" (produtos não aparecem)
**Passo 4: Disponibilização**
- Sublinhas "Ativas" têm produtos listados para lojas
---
## 6. Regra de Negócio: Controle de Disponibilidade
**RN007 - Disponibilidade de Produtos:**
```
Para um produto aparecer no catálogo de pedidos das lojas:
1. Produto deve estar ativo (produtos.ativo = true)
2. Produto deve estar em uma Sublinha de Produção
3. Sublinha deve ter status "Ativo"
4. Sublinha deve estar aprovada pelo Gestor de Fábrica
```
---
# PARTE 3: RESPONSÁVEL DE LOJA
## 1. Visão Geral do Perfil
O **Responsável de Loja** é o usuário que representa um ponto de venda e é responsável por fazer pedidos
de produtos.
**Responsabilidades:**
- Fazer pedidos de produtos disponíveis
- Visualizar histórico de pedidos
- Acompanhar status de pedidos
- Abrir ocorrências para problemas
- Gerenciar ocorrências abertas
**Usuário logado na interface:** Rommel Filho (vinculado a lojas)
---
## 2. Navegação Principal
**Abas:**
- **Gestão de Pedidos**
- **Conferência**
- **Ocorrências**
---
## 3. Gestão de Pedidos
**Página:** `Visão Geral - Gestão de Pedidos`
### 3.1 Dashboard de Pedidos da Loja
**Indicadores (KPIs):**
- **Total de Pedidos:** 1 pedido (azul)
- **Agendado:** 1 pedido (amarelo)
- **Em Produção:** 0 (azul claro)
- **Rota de Entrega:** 0 (verde)
- **Ocorrências:** 12 chamados (vermelho)
**Diferença:** Vê apenas seus próprios pedidos
### 3.2 Visão de Lista - Meus Pedidos
**Botão:** "+ Novo Pedido" (azul)
**Filtros:**
- Código
- Status do Pedido
**Colunas da Tabela:**
- **Código:** Identificador (ex: PD-1443)
- **Data:** Criação (ex: 07/11/2025 18:42)
- **Data Prevista para Entrega:** Data de recebimento
- **Status do Pedido:** Badge colorido
- **Loja Solicitante:** Nome da loja
**Ações:**
- **Visualizar**
- **Editar** (apenas se status = Agendado)
- **Excluir** (apenas se status = Agendado)
---
## 4. Criação de Novo Pedido
**Modal:** `Pedido Diário`
### 4.1 Cabeçalho do Pedido
**Campos de configuração:**
**Nome da Loja:**
- Dropdown para selecionar (ou pré-selecionada)
**Data de Entrega:**
- Exibida automaticamente
- Calculada: Data atual + D+X da loja
**Horário Limite - Pedido:**
- Exibido (hora limite configurada na loja)
### 4.2 Cálculo da Janela de Pedido
**Lógica de cálculo:**
```
Loja configurada: D+3
Data atual: Terça, 11/11/2025
Data de entrega: Terça + 3 dias = Sexta, 14/11/2025
Primeira coluna da grade: SEXTA-FEIRA (dia da entrega)
```
**Regra geral:**
```
Primeira coluna = Data atual + D+X da loja
```
### 4.3 Grade de Produtos - Estrutura Semanal
**Layout da grade:**
```
┌────────┬─────────────────┬──────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┐
│ Código │ Produto │ Un. │ SEX │ SÁB │ DOM │ SEG │ TER │ QUA │ QUI │ Total │
├────────┼─────────────────┼──────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┤
│PR-6397 │ Pão Teste │ Kg │50.00│ │ │ │ │ │ │ 50.00 Kg │
├────────┼─────────────────┼──────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┤
│PR-8337 │ pão frances │ Un │ 200 │ │ │ │ │ │ │ 200 Un │
├────────┼─────────────────┼──────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┤
│PR-5279 │ Bolo Tapioca │Forma │ 10 │ │ │ │ │ │ │ 10 Formas │
├────────┼─────────────────┼──────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┤
│PR-7407 │ Sonho │ Dz │ 15 │ │ │ │ │ │ │ 15 Dz │
├────────┼─────────────────┼──────┼─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────────┤
│PR-2245 │ Biscoito │ g │5000 │ │ │ │ │ │ │ 5000 g │
└────────┴─────────────────┴──────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴───────────────┘
```
**CORREÇÃO IMPORTANTE:**
- **Coluna "Un." mostra a unidade de venda específica de CADA produto** (não há campo fixo de unidade
no cabeçalho)
- Cada produto exibe sua própria unidade conforme configurado na Engenharia
- O campo "Total" exibe a soma com a unidade específica do produto
**Exemplos de unidades por produto:**
- PR-63972 - Pão Teste: **Kg**
- PR-83374 - pão frances: **Unidades**
- PR-52797 - Bolo de Tapioca: **Formas**
- PR-74072 - Sonho: **Dúzias**
- PR-22456 - Biscoito: **Gramas**
### 4.4 Disponibilidade de Produtos (Campos em Verde)
**Produtos disponíveis para pedido:**
Os campos aparecem em **verde claro** quando o produto está disponível para aquele dia específico.
**Critérios para disponibilidade:**
1. Produto está ativo
2. Produto está em uma Sublinha aprovada
3. Dia da semana está nos dias de produção do produto
4. Cálculo reverso da data de produção é compatível
**Lógica de disponibilidade reversa:**
```javascript
para cada dia da grade (ex: Sexta 14/11):
 para cada produto:
 dias_antes_venda = produto.dias_antes_venda
 data_producao_necessaria = dia_entrega - dias_antes_venda
 
 se data_producao_necessaria está em produto.dias_semana_producao:
 marcar campo como DISPONÍVEL (verde) ✅
 senão:
 marcar campo como INDISPONÍVEL (cinza) ❌
```
### 4.5 Preenchimento de Quantidades
**Entrada de dados:**
Cada campo verde pode receber valores numéricos na **unidade de venda configurada para aquele
produto**.
**Regras de entrada por tipo de unidade:**
**Unidades discretas (números inteiros):**
- Unidades (Un), Formas, Dúzias, Bandejas, Pacotes
- Formato: 0, 1, 2, 100, 200 (sem casas decimais)
**Unidades contínuas (números decimais):**
- Kg, Gramas (g), Litros (L), Mililitros (mL)
- Formato: 0.00, 50.50, 133.14 (com casas decimais)
**Cálculo automático do Total:**
```javascript
Total = SEX + SÁB + DOM + SEG + TER + QUA + QUI
```
O total é sempre exibido com a unidade específica do produto.
### 4.6 Sistema de Conversão de Unidades
**🔑 CONCEITO FUNDAMENTAL:**
O sistema opera em duas camadas distintas:
**CAMADA DE INTERFACE (Responsável de Loja):**
- Trabalha com a **unidade de venda** configurada no produto
- Cada produto pode ter sua própria unidade
- Interface amigável e contextualizada
**CAMADA INTERNA (Produção/Fábrica):**
- Converte tudo para **Kg** (unidade padrão de produção)
- Usa o `fator_conversao_venda` para fazer a conversão
- Padroniza ordens de produção
**Fluxo de Conversão:**
```
1. CADASTRO DO PRODUTO (Gestor de Dados Mestre)
 ↓
 Define: unidade_venda, fator_conversao_venda
 
2. PEDIDO DA LOJA (Responsável de Loja)
 ↓
 Interface exibe: unidade_venda
 Responsável pede: quantidade na unidade de venda
 
3. PROCESSAMENTO (Backend)
 ↓
 Converte: quantidade × fator_conversao_venda = quantidade em Kg
 Salva: total_unidade_venda (original) e total_kg (convertido)
 
4. ORDEM DE PRODUÇÃO (Fábrica)
 ↓
 Recebe: quantidade em Kg (padronizado)
```
**Exemplos de Conversão:**
**Exemplo 1 - Produto em Kg (sem conversão)**
```
Cadastro: unidade_venda = "Kg", fator = 1.0
Loja pede: 100 Kg
Produção recebe: 100 Kg
```
**Exemplo 2 - Produto em Unidades**
```
Cadastro: unidade_venda = "Unidades", fator = 0.5
Cada unidade = 0.5 Kg
Loja pede: 200 Unidades
Produção recebe: 200 × 0.5 = 100 Kg
```
**Exemplo 3 - Produto em Gramas**
```
Cadastro: unidade_venda = "Gramas", fator = 0.001
Loja pede: 5000 g
Produção recebe: 5000 × 0.001 = 5 Kg
```
**Exemplo 4 - Produto em Formas**
```
Cadastro: unidade_venda = "Formas", fator = 2.5
Cada forma = 2.5 Kg
Loja pede: 10 Formas
Produção recebe: 10 × 2.5 = 25 Kg
```
**Exemplo 5 - Produto em Dúzias**
```
Cadastro: unidade_venda = "Dúzias", fator = 0.36
1 dúzia = 0.36 Kg
Loja pede: 50 Dúzias
Produção recebe: 50 × 0.36 = 18 Kg
```
**Tabela Resumo de Conversões:**
| Unidade de Venda | Loja pede | Fator | Produção (Kg) |
|------------------|-----------|-------|---------------|
| Kg | 100 Kg | 1.0 | 100 Kg |
| Gramas | 5000 g | 0.001 | 5 Kg |
| Unidades | 200 un | 0.5 | 100 Kg |
| Formas | 10 formas | 2.5 | 25 Kg |
| Dúzias | 50 dz | 0.36 | 18 Kg |
| Bandejas | 30 band | 1.5 | 45 Kg |
| Pacotes | 100 pct | 0.5 | 50 Kg |
### 4.7 Botão de Ação e Validações
**"Fazer Pedido" (botão azul, canto superior direito):**
**Validações realizadas:**
1. **Pelo menos um produto deve ter quantidade > 0**
2. **Valores devem ser válidos para a unidade**
 - Discretas: apenas inteiros
 - Contínuas: decimais válidos
3. **Verificar produção mínima (alerta, não bloqueio)**
 - Se quantidade < produção mínima, exibir aviso
4. **Horário limite não ultrapassado**
 - Se passou do horário limite, calcular D+X do próximo dia
**Processamento ao confirmar:**
- Cria registro em `pedidos_loja`
- Status: "Agendado"
- Gera código único (PD-XXXX)
- Salva produtos em JSONB com quantidades por dia e conversões
- Retorna para lista de pedidos
---
## 5. Visualização de Pedido Existente
**Página:** `Detalhes do Pedido - PD-1443` (Status: Agendado)
**Botão:** "Imprimir Pedido"
### 5.1 Seção Esquerda: Informações Gerais
**Campos:**
- Data do Pedido
- Data Prevista para Entrega
- Descrição do Pedido
- Loja Solicitante
- Usuário Responsável
### 5.2 Seção Central: Produtos do Pedido
**Quando em edição (Status = Agendado):**
Mostra produtos nas unidades originais de venda:
| Código | Nome | Quantidade | Unidade |
|--------|------|------------|---------|
| PR-52797 | Bolo de Tapioca | 10 | Formas |
| PR-63972 | Pão Teste | 133.14 | Kg |
| PR-74072 | Sonho | 30 | Dúzias |
| PR-83374 | pão frances | 200 | Unidades |
**Quando processado (Status > Agendado):**
Mostra produtos convertidos para Kg com equivalência:
| Código | Nome | Quantidade (Kg) | Equivalente |
|--------|------|-----------------|-------------|
| PR-52797 | Bolo de Tapioca | 25.0 | (10 Formas) |
| PR-63972 | Pão Teste | 133.14 | (133.14 Kg) |
| PR-74072 | Sonho | 10.8 | (30 Dúzias) |
| PR-83374 | pão frances | 100.0 | (200 Unidades) |
### 5.3 Seção Direita: Histórico do Pedido
**Timeline cronológica de eventos:**
```
2024-07-17 14:30
Pedido em rota de entrega com 'Truck' transportadora.
2024-07-17 13:15
Pedido em espera - Produção concluída.
2024-07-17 09:20
Pedido em produção - Linha Confeitaria Bolo.
2024-07-16 18:42
Pedido criado por Rommel Filho.
```
---
## 6. Gestão de Ocorrências
**Página:** `Ocorrências` 
**Tabela no banco:** `ocorrencias`
### 6.1 Conceito de Ocorrências
Ocorrências são chamados para reportar problemas com produtos recebidos.
**Tipos de problemas:**
- Produto extraviado
- Produto danificado
- Quantidade incorreta
- Produto errado
- Produto vencido
- Qualidade insatisfatória
- Atraso na entrega
- Outro
### 6.2 Dashboard de Ocorrências
**Indicador:** Card vermelho exibindo número de ocorrências abertas
### 6.3 Visualização de Lista - Ocorrências
**Filtros:**
- Status (Todas, Aberta, Em análise, Resolvida, Fechada)
- Data de abertura
- Pedido relacionado
- Tipo de problema
**Colunas:**
- **Código:** Identificador (ex: OC-0001)
- **Pedido Relacionado:** Código do pedido
- **Produto Afetado:** Produto com problema
- **Tipo:** Categoria do problema
- **Data Abertura:** Quando foi reportado
- **Status:** Badge colorido
- **Ações:** Visualizar, comentar
### 6.4 Abertura de Nova Ocorrência
**Modal:** `Nova Ocorrência`
**Campos obrigatórios (*):**
**Pedido Relacionado:***
- Dropdown com pedidos recentes
- Filtro: Apenas pedidos com status "Rota de Entrega" ou "Entregue"
**Produto Afetado:***
- Dropdown com produtos do pedido selecionado
**Tipo de Problema:***
- Dropdown com opções pré-definidas
**Quantidade Afetada:***
- Campo numérico
- Unidade: Mesma do produto
**Descrição do Problema:***
- Campo texto longo
- Mínimo 20 caracteres, máximo 1000
**Anexos (opcional):**
- Upload de fotos/documentos
- Formatos: JPG, PNG, PDF
- Máximo: 5MB por arquivo, 5 arquivos total
**Ações:**
- "Abrir Ocorrência"
- "Cancelar"
**Processamento ao confirmar:**
- Gera código único (OC-XXXX)
- Status: "Aberta"
- Envia notificação ao Gestor de Fábrica
- Retorna para lista de ocorrências
### 6.5 Visualização e Acompanhamento de Ocorrência
**Página:** `Detalhes da Ocorrência - OC-0023`
**Badge de status:** Grande e colorido no topo
**Informações principais:**
- Código
- Pedido Relacionado
- Produto Afetado
- Tipo de Problema
- Data de Abertura
- Aberto por
**Descrição Detalhada:**
- Texto completo fornecido na criação
**Anexos:**
- Galeria de imagens/documentos
**Timeline de Interações:**
- Histórico cronológico de eventos e comentários
**Seção de Comentários:**
- Campo para adicionar novo comentário
- Botão "Adicionar Comentário"
**Ações Disponíveis (conforme status):**
- Se Aberta/Em análise: Adicionar comentário, anexar arquivo
- Se Resolvida: Adicionar comentário, "Confirmar Resolução", "Reabrir"
- Se Fechada: Visualização apenas, "Reabrir" se necessário
### 6.6 Fluxo de Estados da Ocorrência
```
ABERTA (criada pela loja)
 ↓
EM ANÁLISE (Gestor iniciou investigação)
 ↓
RESOLVIDA (Gestor marcou como resolvida)
 ↓
FECHADA (Loja confirmou resolução)
```
**Transições permitidas:**
| De | Para | Quem pode fazer |
|----|------|-----------------|
| Aberta | Em análise | Gestor de Fábrica |
| Em análise | Resolvida | Gestor de Fábrica |
| Em análise | Aberta | Gestor |
| Resolvida | Fechada | Responsável de Loja |
| Resolvida | Aberta | Responsável de Loja |
| Fechada | Aberta | Ambos (reabertura) |
---
# PARTE 4: ESTRUTURA DE DADOS
## 1. Tabela: materials (Ingredientes)
```sql
CREATE TABLE public.materials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text UNIQUE,
 name text NOT NULL UNIQUE,
 unit public.unit NOT NULL,
 default_price numeric(12, 4),
 created_at timestamp DEFAULT now(),
 material_type public.material_type,
 mix_type public.mix_type,
 update_at timestamp DEFAULT now()
);
```
## 2. Tabela: produtos (Produtos)
```sql
CREATE TABLE public.produtos (
 id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
 created_at timestamp NOT NULL DEFAULT now(),
 nome text,
 descricao text,
 modo_preparo text,
 dias_semana_producao jsonb,
 quebra numeric,
 rendimento numeric,
 validade numeric,
 permite_armazenamento boolean,
 tipo_embalagem text,
 peso_unitario numeric,
 producao_minima numeric,
 producao_economica numeric,
 rota_expedicao text,
 ingrediente_mpi boolean,
 ingredientes jsonb,
 update_at timestamp,
 ativo boolean,
 cod_produto text,
 linha_ref bigint,
 -- Unidades de Venda (Como a loja pede)
 unidade_venda text,
 fator_conversao_venda numeric DEFAULT 1,
 -- Unidades de Produção
 unidade_producao text,
 fator_conversao_producao numeric DEFAULT 1,
 -- Unidades de Expedição
 unidade_expedicao text,
 fator_conversao_expedicao numeric DEFAULT 1,
 qtd_por_embalagem integer,
 CONSTRAINT produtos_linha_ref_fkey FOREIGN KEY (linha_ref)
 REFERENCES linhas_producao (id)
);
```
## 3. Tabela: pedidos_loja (Pedidos)
```sql
CREATE TABLE public.pedidos_loja (
 id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
 cod_pedido text UNIQUE,
 created_at timestamp NOT NULL DEFAULT now(),
 update_at timestamp DEFAULT now(),
 -- Dados do pedido
 loja_solicitante bigint NOT NULL REFERENCES lojas(id),
 user_responsavel uuid REFERENCES users(id),
 data_expedicao timestamp,
 desc_pedido text,
 status_pedido public.status_pedido DEFAULT 'agendado',
 -- Produtos em JSONB (estrutura abaixo)
 produtos jsonb,
 CONSTRAINT pedidos_loja_loja_solicitante_fkey FOREIGN KEY (loja_solicitante)
 REFERENCES lojas(id) ON UPDATE CASCADE ON DELETE CASCADE
);
```
**Estrutura JSONB de produtos:**
```json
{
 "produtos": [
 {
 "produto_id": "uuid",
 "codigo": "PR-83374",
 "nome": "pão frances",
 "unidade_venda": "Unidades",
 "fator_conversao_venda": 0.5,
 "peso_unitario": 0.05,
 "quantidades_por_dia": {
 "sexta": 200,
 "sabado": 0,
 "domingo": 0,
 "segunda": 0,
 "terca": 0,
 "quarta": 0,
 "quinta": 0
 },
 "total_unidade_venda": 200,
 "total_kg": 100.0
 }
 ],
 "cronograma_expedicao": 3,
 "data_pedido": "2025-11-11",
 "data_entrega": "2025-11-14",
 "primeira_coluna": "sexta"
}
```
## 4. Tabela: ocorrencias (Ocorrências)
```sql
CREATE TABLE public.ocorrencias (
 id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
 created_at timestamp NOT NULL DEFAULT now(),
 update_at timestamp DEFAULT now(),
 cod_ocorrencia text UNIQUE NOT NULL,
 pedido_id bigint NOT NULL REFERENCES pedidos_loja(id) ON DELETE CASCADE,
 produto_id bigint NOT NULL REFERENCES produtos(id),
 tipo_problema text NOT NULL,
 quantidade_afetada numeric(12, 2) NOT NULL,
 unidade_afetada text NOT NULL,
 descricao text NOT NULL,
 status text NOT NULL DEFAULT 'aberta',
 aberto_por uuid NOT NULL REFERENCES users(id),
 loja_id bigint NOT NULL REFERENCES lojas(id),
 anexos jsonb,
 resolvido_em timestamp,
 resolvido_por uuid REFERENCES users(id),
 fechado_em timestamp,
 fechado_por uuid REFERENCES users(id),
 CONSTRAINT ocorrencias_status_check
 CHECK (status IN ('aberta', 'em_analise', 'resolvida', 'fechada'))
);
```
## 5. Tabela: ocorrencias_historico (Histórico de Ocorrências)
```sql
CREATE TABLE public.ocorrencias_historico (
 id bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
 created_at timestamp NOT NULL DEFAULT now(),
 ocorrencia_id bigint NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
 usuario_id uuid REFERENCES users(id),
 tipo_evento text NOT NULL,
 conteudo text,
 anexo_url text,
 status_anterior text,
 status_novo text,
 CONSTRAINT ocorrencias_historico_tipo_check
 CHECK (tipo_evento IN ('criacao', 'comentario', 'mudanca_status',
 'anexo_adicionado', 'reabertura'))
);
```
---
# PARTE 5: REGRAS DE NEGÓCIO
**RN001 - Validação de Dias de Produção:**
Ao calcular a data de produção, validar se está na lista `dias_semana_producao`. Se não, ajustar para o dia
permitido anterior mais próximo.
**RN002 - Ingrediente MPI:**
Produtos com `ingrediente_mpi = true` podem ser usados como ingredientes de outros produtos.
**RN003 - Aprovação de Sublinhas:**
Sublinhas criadas pelo Gestor de Dados Mestre ficam "Aguardando Aprovação" até o Gestor de Fábrica
aprovar. Apenas aprovadas aparecem para lojas.
**RN004 - Conversões de Unidades:**
Aplicar fatores de conversão corretamente em cada contexto:
- Pedido (loja): usar `unidade_venda`
- Produção (fábrica): usar `unidade_producao`
- Expedição: usar `unidade_expedicao`
**RN005 - Cálculo de Quantidade por Período:**
Ao gerar pedidos, calcular quantidade multiplicando demanda diária pelo número de dias até a próxima
produção.
**RN006 - Horário Limite de Pedido:**
Pedidos após `horario_limite` da loja são considerados para o próximo dia na calculagem do D+X.
**RN007 - Controle de Disponibilidade:**
Produtos só aparecem no catálogo se estiverem em sublinha ativa e aprovada.
**RN008 - Aprovação de Sublinha:**
Apenas Gestor de Fábrica pode alterar status de sublinha de "Pendente" para "Ativo" ou "Reprovado".
**RN009 - Alteração de Status de Pedido:**
Fluxo sequencial: Pendente → Em Produção → Em Espera → Rota de Entrega. Não é possível pular etapas.
**RN010 - Geração de Ordens:**
Ao mudar pedido para "Em Produção", gerar automaticamente ordens de produção distribuídas por dia.
**RN011 - Exclusão de Sublinha:**
Não é possível excluir sublinha com pedidos ativos ou produtos em produção.
**RN012 - Notificações:**
Ao aprovar/reprovar sublinha, notificar Gestor de Dados Mestre que a criou.
**RN013 - Edição de Pedido:**
Pedidos só podem ser editados se estiverem com status "Agendado".
**RN014 - Disponibilidade na Grade:**
Apenas produtos de sublinhas aprovadas com dias de produção compatíveis aparecem em verde.
**RN015 - Cálculo da Primeira Coluna:**
Primeira coluna = Data atual + D+X da loja. Esta é a data de entrega prevista.
**RN016 - Unidades de Medida (CORRIGIDA):**
A interface de pedido exibe produtos com suas respectivas unidades de venda. Cada produto tem sua própria
unidade. Backend converte para Kg usando `fator_conversao_venda`.
**RN017 - Abertura de Ocorrência:**
Ocorrências só podem ser abertas para pedidos com status "Rota de Entrega" ou "Entregue".
**RN018 - Validação de Quantidade Mínima:**
Se quantidade < produção mínima, exibir alerta mas permitir continuar.
**RN019 - Fechamento de Ocorrência:**
Apenas loja que abriu (ou usuário da mesma loja) pode confirmar resolução.
**RN020 - Conversão Bidirecional (CORRIGIDA):**
Pedido em edição (Agendado): mostra quantidades nas unidades originais.
Pedido processado: mostra em Kg com equivalência entre parênteses.
---
# PARTE 6: FLUXOS DE INTEGRAÇÃO
## 1. Fluxo Completo: Do Cadastro ao Pedido
```
┌─────────────────────────────────────────────────────────┐
│ 1. CADASTRO DO PRODUTO (Gestor de Dados Mestre) │
├─────────────────────────────────────────────────────────┤
│ Define: │
│ - Nome, descrição, modo de preparo │
│ - Dias de produção permitidos │
│ - Ingredientes que compõem │
│ - unidade_venda: "Unidades" │
│ - fator_conversao_venda: 0.5 (cada = 0.5 Kg) │
│ - Dias entre produção e venda: 1 │
│ - Produção mínima, validade, etc. │
└─────────────────────┬──────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ 2. CRIAR SUBLINHA (Gestor de Dados Mestre) │
├─────────────────────────────────────────────────────────┤
│ Agrupa produto em cronograma │
│ Status: Pendente │
└─────────────────────┬──────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ 3. APROVAR SUBLINHA (Gestor de Fábrica) │
├─────────────────────────────────────────────────────────┤
│ Valida viabilidade operacional │
│ Status: Ativo │
│ Produto fica disponível para lojas │
└─────────────────────┬──────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ 4. FAZER PEDIDO (Responsável de Loja) │
├─────────────────────────────────────────────────────────┤
│ Interface exibe: "Unidades" (unidade_venda) │
│ Loja pede: 200 Unidades │
│ Backend calcula: 200 × 0.5 = 100 Kg │
│ Salva: total_unidade_venda = 200, total_kg = 100 │
└─────────────────────┬──────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ 5. PROCESSAR PEDIDO (Gestor de Fábrica) │
├─────────────────────────────────────────────────────────┤
│ Calcula dias de produção │
│ Gera ordens de produção em Kg │
│ Status: Em Produção │
└─────────────────────┬──────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ 6. PRODUZIR (Linha de Produção) │
├─────────────────────────────────────────────────────────┤
│ Recebe: 100 Kg de pão frances │
│ Produz 200 unidades (100 Kg ÷ 0.5 Kg/un) │
└─────────────────────┬──────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────┐
│ 7. EXPEDIÇÃO E ENTREGA │
├─────────────────────────────────────────────────────────┤
│ Loja recebe: 200 Unidades │
│ Pode abrir ocorrência se houver problema │
└─────────────────────────────────────────────────────────┘
```
## 2. Fluxo de Ocorrência
```
┌────────────────────────────┐
│ Loja recebe produtos │
│ Identifica problema │
└────────────┬───────────────┘
 ↓
┌────────────────────────────┐
│ Abre Ocorrência │
│ Status: ABERTA │
└────────────┬───────────────┘
 ↓
┌────────────────────────────┐
│ Notifica Gestor de Fábrica │
└────────────┬───────────────┘
 ↓
┌────────────────────────────┐
│ Gestor analisa │
│ Status: EM ANÁLISE │
└────────────┬───────────────┘
 ↓
┌────────────────────────────┐
│ Gestor comenta/resolução │
│ Status: RESOLVIDA │
└────────────┬───────────────┘
 ↓
┌────────────────────────────┐
│ Loja confirma resolução │
│ Status: FECHADA │
└────────────────────────────┘
```
---
# OBSERVAÇÕES TÉCNICAS PARA MIGRAÇÃO
**Conversão de Unidades:**
Implementar camada de conversão no backend que sempre converte para Kg ao processar. Frontend sempre
exibe na unidade de venda do produto.
**Grade Dinâmica:**
Grade de pedido é dinâmica e muda conforme D+X da loja. Calcular colunas dinamicamente no frontend.
**Disponibilidade de Produtos:**
Implementar função que calcula quais produtos podem ser entregues em cada dia, considerando dias de
produção e intervalo produção-venda.
**Histórico de Pedidos:**
Criar tabela separada para rastrear mudanças de status e edições.
**Anexos de Ocorrências:**
Upload para S3 ou storage similar. Salvar apenas URLs em JSONB.
**Cálculo de Ocorrências:**
Card "Ocorrências" mostra apenas abertas ou em análise, não fechadas.
