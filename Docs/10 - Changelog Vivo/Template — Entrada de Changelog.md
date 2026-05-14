# Template — Entrada de Changelog

> Copie o bloco abaixo no arquivo do mês corrente (`YYYY-MM.md`) toda vez que tocar uma área do código que afete regra de negócio, jornada, permissão ou banco.

```markdown
## YYYY-MM-DD — <título curto, imperativo>

**Commits:** `<hash1>` `<hash2>`
**Área(s):** [[Regra — X]] · [[Jornada — Y]] · [[Catálogo de Tabelas]]
**Persona afetada:** [[Loja]] · [[Gestor de Fábrica]]

**O que mudou (humano):**
- ...

**Onde mudou (técnico):**
- `src/lib/.../arquivo.ts:linha` — ...
- `supabase/migrations/2026MMDDHHMM_x.sql` — ...

**Por que mudou:**
> ...

**Risco residual / TODO:**
- [ ] ...
```

## Quando adicionar uma entrada

| Tipo de mudança | Registrar? |
|---|---|
| Bug fix em regra de negócio | **Sim** |
| Nova migration | **Sim** |
| Mudança de UI sem mudar regra | Sim, breve |
| Refactor sem mudar comportamento | Não (a menos que mude `arquivo:linha` de regra) |
| Ajuste de copy/i18n | Não |
| Mudança de permissão | **Sim** |
| Ajuste de cronograma/D+X/lead days | **Sim — sempre** |

## Por que isso existe

Ajustes estavam escapando porque o "porquê" da mudança morria no commit message. Aqui o porquê fica vivo, ligado à página da regra, e visível quando o próximo ajuste for considerado.
