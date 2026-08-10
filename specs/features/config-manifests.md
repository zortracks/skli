# Configuration manifests

| Field | Value |
|-------|--------|
| Slug | `config-manifests` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

Defines the three skli configuration JSON files, their lazy creation, and cross-platform paths (Windows / Unix).

## User flows

### Flow-01 — Lazy creation

**Persona:** skli CLI.  
**Preconditions:** file or parent directory missing.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | First write to a Manifest or ProjectIndex | Parent directories created; initial JSON file written | EACCES / disk full |

## Data model

### Common Manifest fields — `skli.json`

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `version` | number | yes | integer ≥ 1 | File schema version |
| `skills` | object | yes | map id → entry | `skill` Packages |
| `rules` | object | yes | map id → entry | `rule` Packages |
| `agents` | object | yes | map id → entry | `agent` Packages |

#### Package entry (map value)

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `source` | `"local"` \| `"repos"` | yes | PackageSourceOrigin | Origin kind |
| `repos` | string | if `source=repos` | `owner/repo` | Omitted when `local` |
| `path` | string | yes | POSIX relative path | Path in repo (`repos`) or relative to project (`local`) |
| `versioning` | VersioningMode | yes | glossary enum | Per-package; install default `tag`; `add` uses `none` |
| `version` | string | if `source=repos` | non-empty | Currently installed version (a git tag when `versioning=tag`); **omitted** when `local` |
| `ide` | IdeId | if `source=local` | glossary enum | Single target IDE; **omitted** when `repos` |
| `ides` | IdeId[] | if `source=repos` | non-empty, unique | IDEs installed into; **omitted** when `local` |
| `includeReferences` | boolean | skill installs | default `true` | Written by `skli install … skill`; whether `references/` was copied |

Example — repos skill with references excluded:

```json
{
  "source": "repos",
  "repos": "owner/repo",
  "path": "skills/my-skill",
  "versioning": "tag",
  "version": "v1.2.0",
  "ides": ["cursor", "claude"],
  "includeReferences": false
}
```

Example — local rule:

```json
{
  "source": "local",
  "path": ".cursor/rules/my-rule.mdc",
  "versioning": "none",
  "ide": "cursor"
}
```

### ProjectManifest — project metadata

In addition to common fields, the ProjectManifest (`{project}/.skli/skli.json`) carries:

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `$schema` | string | no | URI | IDE tooling; written by `init` |
| `name` | string | yes (after `init`) | non-empty recommended | Project name |
| `description` | string | yes (after `init`) | | May be `""` |
| `versioning` | VersioningMode | yes (after `init`) | glossary enum | Default `tag` at init |
| `tags` | string[] | yes (after `init`) | trimmed non-empty strings | May be `[]` |
| `links` | object | no | map `owner/repo` → LinkEntry | Project-only; absent ⇒ no links |

#### Link entry (`links` map value)

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `repos` | string | yes | `owner/repo` | Same as map key |
| `versioning` | VersioningMode | yes | glossary enum | Resolve policy for the linked repo |
| `version` | string | yes | non-empty | Pinned version of the remote ProjectManifest / packages |
| `ides` | IdeId[] | yes | non-empty, unique | IDEs the linked packages were copied into |
| `skills` | LinkResourceSelection | yes | | Selection for skills |
| `rules` | LinkResourceSelection | yes | | Selection for rules |
| `agents` | LinkResourceSelection | yes | | Selection for agents |

#### LinkResourceSelection

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `includeAll` | boolean | yes | | When `true`, every package of that kind in the remote manifest (at link / update time) |
| `includes` | string[] | yes | package ids | When `includeAll` is `false`, only these ids; may be `[]` when `includeAll` is `true` |

Linked packages are **not** duplicated into local `skills` / `rules` / `agents` maps. Paths are resolved by reading the remote ProjectManifest at `version`.

Example — link with mixed selection:

```json
"links": {
  "zortracks/skli": {
    "repos": "zortracks/skli",
    "versioning": "tag",
    "version": "v0.1.0",
    "ides": ["cursor"],
    "skills": { "includeAll": false, "includes": ["arcade-bootstrap"] },
    "rules": { "includeAll": true, "includes": [] },
    "agents": { "includeAll": false, "includes": [] }
  }
}
```

Tolerant read: manifests without metadata, `$schema`, or `links` remain readable (package maps; missing `links` ⇒ treat as `{}`).

Published JSON Schema (Draft 2020-12): [`schemas/skli.project.schema.json`](../../schemas/skli.project.schema.json). Canonical `$schema` URL written by `init`:

`https://raw.githubusercontent.com/zortracks/skli/main/schemas/skli.project.schema.json`

Initial value after `skli init` (example):

```json
{
  "$schema": "https://raw.githubusercontent.com/zortracks/skli/main/schemas/skli.project.schema.json",
  "version": 1,
  "name": "my-repo",
  "description": "",
  "versioning": "tag",
  "tags": [],
  "skills": {},
  "rules": {},
  "agents": {}
}
```

### GlobalManifest

Same common fields (`version`, `skills`, `rules`, `agents`). **No** project metadata (`name`, `description`, `versioning`, `tags`).

Initial value (empty global manifest):

```json
{
  "version": 1,
  "skills": {},
  "rules": {},
  "agents": {}
}
```

### ProjectIndex — `projects.json`

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `version` | number | yes | integer ≥ 1 | Schema version |
| `projects` | string[] | yes | unique absolute paths | Referenced project paths |

Initial value:

```json
{
  "version": 1,
  "projects": []
}
```

## CLI

No dedicated command; used by `add`, `install`, `init`, etc.

## Business rules

| Id | Rule |
|----|------|
| BR-config-001 | ProjectManifest = `{project}/.skli/skli.json`. |
| BR-config-002 | GlobalManifest = `~/.skli/skli.json`. |
| BR-config-003 | ProjectIndex = `~/.skli/projects.json`. |
| BR-config-004 | `~` = user home (`os.homedir()`). |
| BR-config-005 | Read/write helpers: create missing directories; if file missing on read, initial value is allowed. **Creation** of the ProjectManifest for a project is owned by `init` (not `add`). |
| BR-config-006 | Paths in `projects` are stored absolute and normalized. |
| BR-config-007 | Adding a path already present in `projects`: no-op (no duplicate). |
| BR-config-008 | Metadata `name`, `description`, `versioning`, `tags` are reserved for the ProjectManifest. |
| BR-config-009 | ProjectManifest JSON Schema lives at `schemas/skli.project.schema.json`; `$schema` (when present) points at the raw GitHub URL on `main`. |
| BR-config-010 | Package entry with `source=repos` and `versioning=tag`: `version` is a git tag name (never a branch). |
| BR-config-011 | `source=local` ⇒ required `ide` (single IdeId); `source=repos` ⇒ required `ides` (IdeId[], min 1). |
| BR-config-012 | `links` is ProjectManifest-only; GlobalManifest must not carry `links`. |
| BR-config-013 | Link key and `repos` are `owner/repo`; each kind has `includeAll` + `includes`. |

## User scenarios

After `skli init`, the ProjectManifest exists with metadata; `skli add` can reference Packages in it. `install` may create / update manifests and ProjectIndex per its pipeline.

## Dependencies

- [`domain-glossary`](domain-glossary.md) — Manifest, ProjectIndex, Scope, PackageKind, VersioningMode, PackageSourceOrigin, Link.
- Consumed by [`cmd-add`](cmd-add.md), [`cmd-install`](cmd-install.md), [`cmd-init`](cmd-init.md), [`cmd-link`](cmd-link.md), [`cmd-unlink`](cmd-unlink.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md).

## Out of scope

- Schema version migration (tolerant read of older ProjectManifests without metadata).
- Concurrent file locking.
- GlobalManifest / ProjectIndex published JSON Schemas.
- Runtime validation of manifests against the JSON Schema.

## Acceptance criteria

- [x] Lazy read/write helpers for all 3 files.
- [x] Paths resolved correctly on Windows and Unix.
- [x] Empty manifest / post-init ProjectManifest match the model above.
- [x] Published ProjectManifest JSON Schema at `schemas/skli.project.schema.json`.
- [x] Post-init ProjectManifest includes `$schema` pointing at the canonical raw GitHub URL.
- [x] ProjectManifest JSON Schema documents optional `links` / LinkEntry.

## Terminology

See [`domain-glossary`](domain-glossary.md).

## Implementation notes

Module `src/lib/paths.ts` + `src/lib/manifests.ts`. Schema file: `schemas/skli.project.schema.json`.
