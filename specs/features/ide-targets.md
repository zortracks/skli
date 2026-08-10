# IDE install targets

| Field | Value |
|-------|--------|
| Slug | `ide-targets` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

Registry of **IdeId** values and primary filesystem directories where skli deploys Skills, Rules, and Agents (project vs global). Consumed by `skli install <ide> …` to resolve target folders before copy/deploy.

## User flows

### Flow-01 — Parse multi-IDE argument

**Persona:** CLI skli.  
**Preconditions:** `<ide>` string provided.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | Parse CSV | Ordered unique `IdeId[]` | Empty / unknown id → error listing known ids |

### Flow-02 — Resolve install directories

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | For each IdeId × PackageKind × scope | Absolute primary dirs | Kind unsupported for that IDE → omit from list |

## Data model

### IdeId (primary install dirs)

Relative segments; project paths join `{projectRoot}`; global paths join `~` (`os.homedir()`).

| IdeId | Scope | rule | skill | agent |
|-------|-------|------|-------|-------|
| `cursor` | project | `.cursor/rules` | `.cursor/skills` | `.cursor/agents` |
| `cursor` | global | `.cursor/rules` | `.cursor/skills` | `.cursor/agents` |
| `claude` | project | `.claude/rules` | `.claude/skills` | `.claude/agents` |
| `claude` | global | `.claude/rules` | `.claude/skills` | `.claude/agents` |
| `codex` | project | `.` (AGENTS.md at root) | `.agents/skills` | — |
| `codex` | global | `.codex/rules` | `.agents/skills` | — |
| `copilot` | project | — | `.github/skills` | — |
| `copilot` | global | — | `.copilot/skills` | — |
| `windsurf` | project | `.windsurf/rules` | `.windsurf/skills` | — |
| `windsurf` | global | — | `.codeium/windsurf/skills` | — |

Cells marked — are unsupported for directory install in skli v0 (omitted from resolve).

Secondary/compat locations (e.g. `.agents/skills` for Cursor, `.claude/skills` for Copilot) are **not** primary targets.

## CLI

Consumed by install:

```
<ide>    One or more IdeId, comma-separated (e.g. cursor or cursor,claude). No special "all" value.
```

## Business rules

| Id | Rule |
|----|------|
| BR-ide-targets-001 | Known IdeId: `cursor`, `claude`, `codex`, `copilot`, `windsurf`. |
| BR-ide-targets-002 | Multi-IDE = CSV only; trim; dedupe; preserve first-seen order. No `all` IdeId. |
| BR-ide-targets-003 | `--global` selects global layout; otherwise project layout under cwd/project root. |
| BR-ide-targets-004 | When resolving for a single PackageKind, unsupported IdeId×kind pairs are skipped. |
| BR-ide-targets-005 | Primary dirs only; no copy in this feature alone. |
| BR-ide-targets-006 | Reverse resolve: an install path under a primary layout maps to `{ ide, kind, id }` (skill = directory basename; rule/agent = file basename without extension). Match across all IdeIds; prefer the most specific (longest) segment match. Used by [`cmd-update`](cmd-update.md) / [`cmd-restore`](cmd-restore.md) / [`cmd-remove`](cmd-remove.md) path form. |

## User scenarios

`skli install cursor,claude skill owner/repo:skills/foo --debug` resolves Cursor and Claude skill dirs, then installs.  
`skli update .cursor/skills/arcade-bootstrap` reverse-resolves to cursor / skill / arcade-bootstrap.  
`skli link cursor owner/repo --all` uses the same primary dirs for linked package copies.

## Dependencies

- [`domain-glossary`](domain-glossary.md) — IdeId, PackageKind, IDE home.
- [`cmd-install`](cmd-install.md), [`cmd-link`](cmd-link.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md), [`cmd-remove`](cmd-remove.md), [`cmd-unlink`](cmd-unlink.md) — consumers.

## Out of scope

- File copy / format conversion between IDEs.
- Secondary compat path mirrors.
- Codex execpolicy semantics vs AGENTS.md content merge.

## Acceptance criteria

- [x] `parseIdeArgument` CSV + validation.
- [x] `resolveInstallDirs` for all IdeId primary layouts.
- [x] Spec table matches code registry.
- [x] Reverse path → `{ ide, kind, id }` for all IdeId layouts (update/restore/remove).

## Terminology

See [`domain-glossary`](domain-glossary.md). Path details live here.

## Implementation notes

`src/lib/ide-targets.ts`.
