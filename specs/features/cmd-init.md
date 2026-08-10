# init command

| Field | Value |
|-------|--------|
| Slug | `cmd-init` |
| Status | implemented |
| Last review | 2026-08-09 |

## Summary

`skli init` initializes a skli project: detects the git repository root, collects project metadata (interactive or via flags), creates the ProjectManifest `{gitRoot}/.skli/skli.json`, and registers the path in the ProjectIndex.

## User flows

### Flow-01 — Init at git root (cwd = git root)

**Persona:** developer.  
**Preconditions:** `cwd` is the root of a git repository; ProjectManifest missing.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli init` | Git repository found; root = cwd | No git repository in the tree |
| 2 | — | Collect `name`, `description`, `versioning`, `tags` (prompts or flags) | Non-TTY without `-y` and missing fields |
| 3 | — | Write `{gitRoot}/.skli/skli.json` | EACCES |
| 4 | — | Add `gitRoot` to ProjectIndex | — |
| 5 | — | Success message; exit code 0 | — |

### Flow-02 — Init from a subdirectory (parent git root)

**Persona:** developer.  
**Preconditions:** `cwd` is not the git root; a git repository exists in a parent.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli init` | Parent git root discovered | No git repository |
| 2 | — | Ask permission to write the ProjectManifest at the repo root | User decline → cancel |
| 3 | With `-y` | Parent git confirmation accepted automatically | — |
| 4 | — | Same continuation as Flow-01 (collect → write → ProjectIndex) | — |

### Flow-03 — Manifest already present

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli init` without `--force` when `.skli/skli.json` exists | No write | Clear error; exit code ≠ 0 |
| 2 | `skli init --force` | Project metadata overwritten; `skills` / `rules` / `agents` maps preserved if re-read OK, otherwise empty maps | — |

### Flow-04 — Non-interactive mode `-y`

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli init -y` | Defaults for missing fields; no prompts; parent git auto-confirmed | No git repository |

## Data model

ProjectManifest — see [`config-manifests`](config-manifests.md). Fields written by `init`:

| Field | Default |
|-------|---------|
| `$schema` | Canonical ProjectManifest schema URL (see [`config-manifests`](config-manifests.md)) |
| `name` | basename of the git root |
| `description` | `""` |
| `versioning` | `tag` (VersioningMode) |
| `tags` | `[]` |
| `skills` / `rules` / `agents` | `{}` (or preserved if `--force` + re-read OK) |

ProjectIndex: normalized absolute path of `gitRoot` added (no-op if already present).

## CLI

```
skli init [options]

Options:
  --name <name>                          Project name
  --description <text>                   Description
  --versioning <tag|commit|branch|none>  Versioning mode (default: tag)
  --tag <tag>                            Project tag (repeatable)
  --tags <list>                          Comma-separated tags
  -y, --yes                              Defaults without prompt; confirm parent git
  -f, --force                            Allow overwrite if manifest present
  -h, --help                             Help
```

Exit codes: `0` success or cancel after parent-git decline; `≠ 0` error (no git, existing manifest without `--force`, validation, I/O).

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-init-001 | Walk up from `cwd` until `.git` is found (file or directory). |
| BR-cmd-init-002 | No git repository in the tree → fatal error. |
| BR-cmd-init-003 | If `cwd` ≠ git root → ask confirmation to write at the repo root; `-y` accepts automatically. |
| BR-cmd-init-004 | Decline of parent-git confirmation → cancel without writing (exit code 0). |
| BR-cmd-init-005 | ProjectManifest = `{gitRoot}/.skli/skli.json`. |
| BR-cmd-init-006 | Manifest already present without `--force` → error; with `--force` → overwrite metadata, preserve package maps if readable. |
| BR-cmd-init-007 | Missing fields + TTY → interactive prompts (defaults in parentheses). |
| BR-cmd-init-008 | Missing fields + non-TTY without `-y` → error. |
| BR-cmd-init-009 | `-y` → defaults without prompt for missing fields. |
| BR-cmd-init-010 | `versioning` ∈ VersioningMode; default `tag`. |
| BR-cmd-init-011 | Tags: non-empty strings after trim; repeatable `--tag` and/or CSV `--tags` merged. |
| BR-cmd-init-012 | After successful write: add `gitRoot` to ProjectIndex. |
| BR-cmd-init-013 | Written ProjectManifest always includes `$schema` set to the canonical ProjectManifest JSON Schema URL. |

## User scenarios

From a repo root: `npx @zortracks/skli init` then prompts; or `npx @zortracks/skli init -y --name my-app --tags ai,cursor`. Then `skli add` can reference Packages.

## Dependencies

- [`cli-core`](cli-core.md) — command registration.
- [`config-manifests`](config-manifests.md) — ProjectManifest, ProjectIndex.
- [`domain-glossary`](domain-glossary.md) — ProjectManifest, ProjectIndex, VersioningMode.

## Out of scope

- GlobalManifest init.
- Automatic migration of older manifests without metadata.
- Advanced tag validation (beyond trim / non-empty).

## Acceptance criteria

- [x] `skli init` creates `{gitRoot}/.skli/skli.json` with metadata + empty maps.
- [x] Walks up parent directories for git; error if none found.
- [x] Confirmation if cwd ≠ git root; `-y` auto-accepts.
- [x] Existing manifest → error unless `--force`.
- [x] Flags and/or prompts for name, description, versioning, tags.
- [x] `-y` applies defaults without prompt.
- [x] ProjectIndex updated with the absolute project path.
- [x] Visible in `npx @zortracks/skli --help`.
- [x] Written ProjectManifest includes `$schema` (including `--force`).

## Terminology

See [`domain-glossary`](domain-glossary.md) — VersioningMode, ProjectManifest, ProjectIndex.

## Implementation notes

`src/commands/init.ts`, `src/lib/git.ts`; prompts via `@inquirer/prompts`.
