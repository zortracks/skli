# IDE targets

skli resolves primary install directories per **IdeId**, Package kind, and scope.

| IdeId | Scope | rule | skill | agent |
|-------|-------|------|-------|-------|
| `cursor` | project / global | `.cursor/rules` | `.cursor/skills` | `.cursor/agents` |
| `claude` | project / global | `.claude/rules` | `.claude/skills` | `.claude/agents` |
| `codex` | project | `.` (`AGENTS.md`) | `.agents/skills` | — |
| `codex` | global | `.codex/rules` | `.agents/skills` | — |
| `copilot` | project | — | `.github/skills` | — |
| `copilot` | global | — | `.copilot/skills` | — |
| `windsurf` | project | `.windsurf/rules` | `.windsurf/skills` | — |
| `windsurf` | global | — | `.codeium/windsurf/skills` | — |

Cells marked — are unsupported (skipped when resolving).

Project paths join the project root; global paths join `~`.

## CLI selector

```bash
skli install cursor,claude skill owner/repo:skills/foo
```

CSV only; unknown ids error. There is no IdeId value `all`.

On `update` / `restore` / `remove`, the literal argument `all` means “every IdeId” as a **command selector**, not an IdeId enum member.

## Path form

Those same commands accept an install path instead of `<ide> <kind> <id>`:

```bash
skli update .cursor/skills/arcade-bootstrap
```

Full registry rules: [ide-targets](/specs/features/ide-targets).
