# Docs

Documentação viva do projeto. Conteúdo histórico (backlogs concluídos, docs de migração inicial) foi descartado — usar o git history quando precisar recuperar.

## Estrutura

- **`decisoes/`** — ADRs (Architecture Decision Records). Decisões arquiteturais que continuam valendo no código.
- **`regras-de-negocio/`** — Specs de regras de negócio que orientam a implementação atual.

## Índice

### Decisões
- [Navegação orientada por permissões](decisoes/ADR_navegacao_orientada_por_permissoes.md)

### Regras de negócio
- [Regras de Pedido da Loja (D+X, coluna destacada, disponibilidade)](regras-de-negocio/Regras_Pedido_Loja_DMaisX.md)

## Convenções

- Novo ADR: criar `decisoes/ADR_<assunto>.md` e listar acima.
- Nova regra: criar `regras-de-negocio/<assunto>.md` e listar acima.
- Documento ficou obsoleto: descartar (o git guarda a história), não acumular em pasta de arquivo.
