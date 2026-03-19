# ADR: Navegação orientada por permissões

## Status
Aceito

## Contexto
O sistema usava `role` tanto como perfil-base do usuário quanto como motor de navegação, redirect e autorização. Isso causava perda de contexto para administradores e usuários com permissões cruzadas ao navegar para áreas de outros perfis.

## Decisão
- `role` permanece apenas como perfil-base/template para defaults, labels e compatibilidade.
- Navegação, landing e acesso a módulos passam a ser resolvidos por `permissions + scopes`.
- A sidebar do app é única e global, agrupada por domínio funcional.
- O item `Meu Perfil` continua fora da autorização de módulos de negócio e sempre aponta para a rota de perfil do `baseRole`.
- O escopo de loja continua sendo uma segunda camada de autorização, independente da visibilidade de módulo.

## Regras principais
- A primeira rota do usuário é calculada por `resolveLandingPath(permissions, baseRole)`.
- A visibilidade do menu é calculada por `buildNavigationSections(permissions)`.
- APIs de negócio devem usar `permission` ou `anyOfPermissions`; não devem usar `role` para autorizar módulo.
- Rotas `/perfil` não contam como dashboard nem como capacidade de negócio.

## Consequências
- Administradores podem navegar por páginas de loja/fábrica sem perder a navegação global.
- Usuários com permissões cruzadas deixam de depender do `role` para acessar áreas liberadas.
- Qualquer nova tela operacional precisa entrar no catálogo canônico de permissões antes de ser considerada completa.
