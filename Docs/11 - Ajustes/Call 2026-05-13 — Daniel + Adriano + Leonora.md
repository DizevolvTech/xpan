# Call 2026-05-13 — Daniel + Adriano + Leonora

**Duração:** 77 min · **Gravação:** ZipCall
**Participantes:** Daniel Abreu (cliente — tecnologia), Adriano Santos (cliente — operação), Leonora Renck (gestora do projeto), Giuseppe Martins (dev)
**Tom geral:** "A melhor call do ano até agora" (Leonora). Daniel testou ponta-a-ponta. Engenharia validada. Foco mudou para **UX, fluidez de status e modelo de pedido**.

> Esta página é o registro humano da reunião. Os ajustes acionáveis estão em [[Backlog de Ajustes]] com ID `AJ-####`.

## Contexto

- Daniel conseguiu testar lead days, drift e produção/expedição/entrega.
- Engenharia (D+2/D+3, lead days, drift) **valida** — testes positivos.
- Daniel não conseguiu ainda usar com cliente real por causa da **dificuldade de operar a UI**.
- Adriano trouxe casos reais (cliente Espírito Santo, MPI de pandeló) que reforçaram o modelo.

## O que foi dito (resumo por bloco)

### Bloco 1 — Visão Geral / Kanban (00:00-13:30)

Daniel sentiu falta de uma **visão global** dos pedidos por status. Hoje tem que clicar em cada OP para entender o que está acontecendo. Sugestão: visualização tipo Kanban (cards de pedido com etapas em colunas), **read-only com atalho de clique** que leva o usuário à OP/pedido conforme a persona.

- **Giuseppe:** "Posso fazer um acompanhamento, mas manipular só com cabana. É perigoso." → escopo confirmado: **só visualização e navegação**.

### Bloco 2 — Dashboard atual (11:00-13:30)

Dashboard tem cards de "Pedidos do dia", "Aguardando liberação", "Entregas", mas **não são clicáveis** — não levam para a tela correspondente. Leonora confirmou: "visualização em cards, com indicadores por etapa e filtros, a gente consegue fazer."

### Bloco 3 — Auditoria do Cronograma (13:30-16:30)

Daniel pediu que o `expedition_lead_days` (dias entre produção e entrega) **apareça como coluna na tabela de auditoria** do cronograma. Hoje só está no cadastro do produto.

### Bloco 4 — MPI / Ingrediente Misturado (16:30-20:30)

- Daniel: "Cadastrei ingrediente misturado e ele não foi para a ordem de produção."
- Adriano contou caso real do **pandeló** no cliente Espírito Santo: cliente atual deles trata pandeló dentro do bolo (errado, gera divergência); o sistema do Xpan precisa **gerar OP de MPI separada**.
- Adriano: cliente atual usa "receita associada"; o Xpan modela como produto MPI (`can_be_ingredient`, `is_mpi_ingredient`). Manter o modelo, **só adicionar legenda para evitar confusão**.
- **Pendência:** validar se MPI realmente está gerando OP separada quando consumida em outra receita.

### Bloco 5 — Cadastro de Receita / Decimais (16:30-22:30)

Receita mostra rendimento arredondado (ex.: "9 unidades" para 9.1). Daniel precisa do número exato (3 casas após a vírgula) para copiar pra Excel. Giuseppe: "Vou colocar para aparecer 4 caracteres no total: 1 antes + 3 após vírgula."

### Bloco 6 — Pedido da Loja: indisponíveis (23:00-25:00)

- Itens indisponíveis aparecem **no topo** e bloqueiam a lista. Daniel tem que clicar "ver 50" para encontrar disponíveis.
- Solução: **mover indisponíveis para o fim** ou esconder (filtro padrão).

### Bloco 7 — Pedido da Loja: lote mínimo (25:00-26:30)

Sistema mostra "abaixo do lote mínimo de produção" para a loja. **Não faz sentido**: a fábrica soma pedidos de todas as lojas; o lote mínimo é problema da fábrica, não da loja. **Remover validação no lado loja.**

### Bloco 8 — Pedido duplicado (26:30-28:30)

- Hoje: se duas pessoas abrem o mesmo pedido (mesma loja + mesmo dia), só dá erro **na hora de salvar** — perde tempo + perde dados digitados.
- Comportamento desejado: ao abrir o pedido, já mostrar "pedido em andamento por X" ou "já preenchido", **antes do usuário começar a digitar**.

### Bloco 9 — Modelo: quem cria pedido (mudança estrutural) (28:30-30:00)

> ⚠️ Mudança de modelo importante.

- **Hoje:** loja clica "novo pedido", sistema cria.
- **Como deveria ser:** **a fábrica abre os pedidos** (semana, dia, etc.) e a loja vê uma **lista de pedidos disponíveis para preencher**. Loja não cria, só preenche.
- Quando fábrica audita cronograma, isso impacta os pedidos abertos. Após auditar, a fábrica **publica** os pedidos pras lojas.

### Bloco 10 — Impressão compacta (28:30)

Ordens de produção e folhas de impressão muito espaçadas. Estilo planilha do Google: o mais compacto possível para economizar folha.

### Bloco 11 — Status inconsistente entre etapas (34:00-36:30)

- Item está como "aguardando expedição" no painel, mas dentro da OP está **100% concluído**.
- Quando vai pra expedição, está como **"aguardando produção"**.
- Há **dessincronia entre `workflow_production_items.status`, `delivery_executions.status` e a visão composta no UI**.
- Daniel pediu Kanban também por essa razão (visualizar onde o pedido trava).

### Bloco 12 — Log de auditoria do cronograma (36:30-39:30)

Quando alguém altera produto + audita o cronograma, o log existe (na alteração) mas a **lista de auditoria pendente não mostra o que foi alterado**. Em linhas grandes (50 itens) fica impossível identificar.

- Sugestão: marca-texto no item alterado, ou puxar o log para a listagem.

### Bloco 13 — Pedido liberado some (39:30-40:30)

Daniel liberou um pedido para produção e **não viu o pedido aparecer** na fila de ordens. Talvez só apareça no dia da produção (lead days). Falta visibilidade de "pedido agendado, vai aparecer em X dias".

### Bloco 14 — Quadradinhos de cobertura (46:30-58:00)

> ⚠️ Esse é o ponto mais técnico da call. **Mudança de regra de UI + cálculo.**

- Hoje os "quadradinhos verdes" no pedido da loja mostram **1 quadradinho por dia de entrega**.
- Como deveria ser: **N quadradinhos = N dias de cobertura** (dependente do ciclo de produção do produto).
  - Produto que produz 3x por semana → pedido cobre 2 dias → 2 quadradinhos verdes.
  - Produto que produz 1x por semana → pedido cobre 7 dias → 7 quadradinhos verdes.
  - Produto de cardápio (sábado só) → 1 quadradinho.
- Quando a fábrica abre pedidos em vários dias da semana, **a soma dos quadradinhos cobre exatamente a semana**.
- **Adriano nomeou:** "dias de cobertura" (termo deles).
- **Bonus pedido pelo Adriano:** mostrar a data no quadradinho ("sábado dia 17", "domingo dia 18") porque venda varia por dia (sábado = 20%, segunda = 6% da semana). Loja precisa olhar dia-a-dia.

### Bloco 15 — Estoque / armazenamento (futuro) (1:02-1:08)

- `products.allows_storage` existe mas **não interage com OP**.
- Cenário: massa de pizza / pandeló produzidos para estoque, consumidos depois sem nova OP.
- Adriano sugere: shelf life por produto, projeção, produzir antes baseado em média de venda.
- Daniel sugere também: **OP sem pedido** (degustação, teste, "vou produzir 50 mesmo sem cliente").
- **Decisão:** marcar como **versão 12 / fase 2**. Não entra agora.

### Bloco 16 — Limpar banco para testes (1:15)

Daniel pediu: limpar pedidos para começar testes do zero — bancos com dados de testes antigos estão "embolados" e gerando erros falsos. Giuseppe: "Vou zerar a tabela de pedidos."

## Próximos passos acordados

- Giuseppe executa os ajustes "de imediato" — todos exceto estoque/MPI-com-estoque.
- Daniel testa **na semana de 2026-05-19** (terça em diante; sexta 16 e sábado 17 já com algum tempo).
- Próxima call: terça-feira 2026-05-20 (16h-17h, se necessário), só depois que ajustes estiverem testáveis.
- Leonora ainda **não marcou** call seguinte: quer evitar prometer data sem alinhar com Giuseppe.

## Tom dos clientes

- **Daniel** está engajado, técnico, faz mocks e prints, prefere mensagem clara em texto.
- **Adriano** entrou no meio, traz visão de operação real ("padaria não é fábrica") e tem nomenclatura própria ("dias de cobertura"). Comentou que querem testar com cliente São Paulo + cliente Espírito Santo após validação.
- **Visão do produto:** "tem milhares de software de PCP, mas o nosso está bem focado no chão da padaria — é diferencial".

## Links

- [[Backlog de Ajustes]] — lista numerada para execução
- [[Call 2026-05-13 — Plano de Ataque]] — ordem de execução proposta
- [[Regra — Pedido da Loja]] — afetado por AJ-0007, AJ-0008, AJ-0009
- [[Jornada — Pedido da Loja]] — afetado por AJ-0009 (mudança de modelo)
- [[Jornada — Cronograma da Semana]] — afetado por AJ-0003, AJ-0014
- [[Integrações entre Jornadas]] — afetado por AJ-0011 (status sincronia)
