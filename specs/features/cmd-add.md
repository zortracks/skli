# add command

| Field | Value |
|-------|--------|
| Slug | `cmd-add` |
| Status | implemented |
| Last review | 2026-08-09 |

## Summary

`skli add {ide} {kind} {path}` references a local **Package** (Skill, Rule, or Agent) in the current project's ProjectManifest (`{cwd}/.skli/skli.json`). Does not install files; does not write to the ProjectIndex. If the ProjectManifest is missing, error inviting `npx @zortracks/skli init`.

## User flows

### Flow-01 — Reference a local Package

**Persona:** developer.  
**Preconditions:** ProjectManifest present; `path` points to an existing file or directory.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli add <ide> <kind> <path>` | `ide` / `kind` validated | invalid / missing |
| 2 | — | `path` resolved; exists (file or directory) | path does not exist |
| 3 | — | ProjectManifest read | ProjectManifest missing → message `npx @zortracks/skli init` |
| 4 | — | Upsert entry: `source=local`, `path`, `versioning=none`, `ide` (no `version`, no `repos`, no `ides`) | EACCES |
| 5 | — | Success message; exit code 0 | — |

### Flow-02 — Package already referenced (same id)

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli add <ide> <kind> <path>` with id already present | Entry updated; success | — |

### Flow-03 — ProjectManifest missing

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli add <ide> <kind> <path>` without `{cwd}/.skli/skli.json` | No write | Clear error inviting `npx @zortracks/skli init`; exit code ≠ 0 |

## Data model

Package entry — see [`config-manifests`](config-manifests.md).

| Field written | Value |
|---------------|--------|
| Key (id) | Basename of `path` without extension |
| `source` | `"local"` |
| `path` | Path relative to cwd if possible, otherwise absolute (POSIX separators) |
| `versioning` | `"none"` |
| `ide` | IdeId from CLI |

No `repos`, no `version`, no `ides`.

## CLI

```
skli add <ide> <kind> <path>

Arguments:
  ide     IdeId: cursor | claude | codex | copilot | windsurf
  kind    PackageKind: skill | rule | agent
  path    Local Package path (file or directory)
```

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-add-001 | `ide`, `kind`, and `path` are required. |
| BR-cmd-add-002 | `kind` ∈ PackageKind (`skill`, `rule`, `agent`). |
| BR-cmd-add-003 | `path` must exist (file or directory); otherwise error. |
| BR-cmd-add-004 | ProjectManifest = `{cwd}/.skli/skli.json`; if missing: error inviting `npx @zortracks/skli init` (do not create the file). |
| BR-cmd-add-005 | Write the entry in the map matching `kind` (`skills` / `rules` / `agents`). |
| BR-cmd-add-006 | Id = basename of `path` without extension. |
| BR-cmd-add-007 | Entry: `source=local`, `path` relative if possible, `versioning=none`, `ide`; omit `repos`, `version`, `ides`. |
| BR-cmd-add-008 | Same id already present: upsert, no error. |
| BR-cmd-add-009 | Do not modify the ProjectIndex. |
| BR-cmd-add-010 | `ide` ∈ IdeId. |

## User scenarios

After `npx @zortracks/skli init`, from the repo: `skli add cursor rule .cursor/rules/specs-documentation.mdc` records the rule in `.skli/skli.json`.

## Dependencies

- [`cli-core`](cli-core.md) — command registration.
- [`config-manifests`](config-manifests.md) — ProjectManifest (read/write; no lazy creation here).
- [`cmd-init`](cmd-init.md) — prior ProjectManifest creation.
- [`ide-targets`](ide-targets.md) — IdeId.
- [`domain-glossary`](domain-glossary.md) — PackageKind, Package, ProjectManifest, PackageSourceOrigin.

## Out of scope

- ProjectManifest creation (→ [`cmd-init`](cmd-init.md)).
- File install / copy (→ `install`).
- ProjectIndex.
- Global / IDE scope.

## Acceptance criteria

- [x] `skli add <ide> <kind> <path>` upserts a local Package entry with `ide` in the ProjectManifest map.
- [x] Refuses if ProjectManifest missing with message `npx @zortracks/skli init`.
- [x] Refuses invalid ide/kind or missing path.
- [x] Idempotent (upsert) for the same id.
- [x] Does not touch `~/.skli/projects.json`.

## Terminology

See [`domain-glossary`](domain-glossary.md).

## Implementation notes

`src/commands/add.ts` + manifest helpers (`readProjectManifest` / `writeProjectManifest` / `addPackageToManifest`).
