# Regras de Pedido da Loja (D+X, Coluna Destacada e Disponibilidade)

## Objetivo
Registrar a regra de negócio do módulo **Responsável da Loja** para evitar perda de contexto entre conversas e implementação.

## Conceitos
- **Data base (D)**: dia em que o pedido está sendo montado.
- **D+X da loja**: prazo configurado para a loja receber produtos.
- **Data desejada de entrega**: `D + X`.
- **Coluna destacada**: coluna correspondente à **data desejada de entrega**.

## Regra 1: Coluna destacada sempre representa a entrega (D+X)
- A coluna destacada é sempre a data em que a loja deve receber o produto.
- Exemplo:
  - Hoje = segunda-feira.
  - Loja = D+3.
  - Entrega = quinta-feira.
  - Coluna destacada = **QUI**.

## Regra 2: Coluna destacada sempre aparece na primeira posição
- A coluna destacada deve ser a **primeira coluna de dia** da grade.
- As demais colunas devem ser rotacionadas em sequência (efeito “dança das cadeiras”).
- Exemplo com entrega em quinta:
  - Ordem visual das colunas de dia: `QUI, SEX, SAB, DOM, SEG, TER, QUA`.

## Regra 3: Somente a coluna destacada é editável
- Entrada de quantidade deve ser permitida apenas na coluna destacada.
- Todas as outras colunas de dia ficam bloqueadas para edição.
- Campos bloqueados podem ser exibidos como leitura/zero.

## Regra 4: Disponibilidade de produto deve respeitar fabricação + intervalo de entrega
Um produto só pode ficar disponível para pedido na data destacada quando **todas** as condições forem verdadeiras:
1. Produto pertence a sublinha aprovada para venda (status ativo/aprovado).
2. O cronograma da sublinha contém dia de fabricação compatível com o produto.
3. A data de fabricação somada ao intervalo necessário (produção + logística) permite atender a data de entrega D+X.

Forma conceitual:
- `data_fabricacao + intervalo_minimo <= data_entrega_desejada`

Se não cumprir, o produto deve aparecer como indisponível para aquela entrega.

## Regra 5: Catálogo exibido para a loja
- A loja vê somente catálogo comercial (ex.: Produto, Categoria, Unidade).
- Termos internos de produção (linha, sublinha, setor) não devem aparecer na interface da loja.
- Esses vínculos internos podem existir no backend/mock, mas ocultos da UI.

## Regra 6: Entrega em domingo
- Quando a data calculada de entrega cair em **domingo**, a entrega deve ser movida para **segunda-feira**.
- Exceção: se a loja estiver cadastrada com **"Recebe aos domingos = Sim"**, a entrega permanece no domingo.
- Essa regra deve impactar:
  - Data de entrega exibida no pedido (D+X).
  - Coluna destacada e rotação dos dias.
  - Planejamento de produção e expedição.

Forma conceitual:
- `data_entrega_ajustada = data_entrega_d+x`
- Se `dia_semana(data_entrega_ajustada) = domingo` e `loja.recebe_domingo = false`, então:
  - `data_entrega_ajustada = data_entrega_ajustada + 1 dia`

## Critério de aceitação (resumo)
1. Ao mudar D+X (ou data base), a coluna destacada muda para o dia correto da entrega.
2. A coluna destacada sempre é renderizada na primeira posição da grade.
3. Apenas a coluna destacada aceita input.
4. Produto disponível/indisponível muda conforme cronograma + intervalo de dias.
5. UI da loja não expõe termos internos de produção.
6. Entregas que cairiam no domingo são automaticamente reprogramadas para segunda, salvo lojas habilitadas para domingo.

## Status do documento
- Versão: 1.1
- Contexto: protótipo frontend sem backend transacional.
