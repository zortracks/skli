# install command

| Field | Value |
|-------|--------|
| Slug | `cmd-install` |
| Status | defined |
| Last review | 2026-08-10 |

## Summary

`skli install {ide} {kind} {source}` installs a Skill, Rule, or Agent Package from a Source (local path or GitHub) into IDE-specific directories (project or global). Updates the relevant Manifest and registers the current project in the ProjectIndex.

**Current iteration:**
- Parse `<ide>` CSV → resolve primary install dirs ([`ide-targets`](ide-targets.md)).
- `kind` ∈ {`skill`, `rule`, `agent`}: fetch Source, copy into IDE dirs, upsert Package entry (`--versioning`, default `tag`).
- Optional `--gitignore`: append every project-relative destination under `# Ignored AI IDEs références` in `{project}/.gitignore` (all IdeIds installed, not Cursor-only).

Multi-package install from a remote ProjectManifest: see [`cmd-link`](cmd-link.md) (replaces former `kind=all` probe).

## User flows

### Flow-01 — Install Package local

**Preconditions:** ProjectManifest present (project scope); path exists; IDE supports kind.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli install cursor rule ./path/to/rule.mdc [--versioning none]` | Copy into each IDE rules dir; Manifest entry `source=local`, `path`, `versioning` (no `version`) | Missing manifest / path / unsupported IDE |

### Flow-02 — Install Package from GitHub

**Preconditions:** `gh` auth; Source `owner/repo[@ref]:path` or HTTPS blob URL with path.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli install cursor skill owner/repo@v1:skills/foo [--versioning tag] [--no-references]` | Download via `gh api`; copy (skip `references/` if flag); entry includes `includeReferences` | Missing `:path` / API / unsupported IDE / flag on non-skill |
| 2 | `skli install cursor skill https://github.com/owner/repo/blob/main/skills/foo/SKILL.md` | Same as shorthand; path normalized to skill directory | Unparsed URL / API |
| 3 | Project scope | ProjectIndex updated | — |

### Flow-03 — Gitignore destinations

**Preconditions:** Project scope; successful Package install (`kind` ∈ PackageKind).

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli install cursor,claude skill <source> --gitignore` | After copy: each project-relative destination appended under `# Ignored AI IDEs références` (e.g. `.cursor/skills/foo` and `.claude/skills/foo`) | `--gitignore` with `--global` |
| 2 | Section or `.gitignore` missing | Create file and/or section; then append | EACCES |
| 3 | Path already listed | Skip duplicate; exit 0 | — |

### Flow-04 — Invalid kind `all`

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli install cursor all <source>` | Rejected | Invalid kind; expected skill \| rule \| agent |

## Data model

Package entry: [`config-manifests`](config-manifests.md). Paths: [`ide-targets`](ide-targets.md). GitHub parse: [`github-source`](github-source.md).

`.gitignore` section header (exact): `# Ignored AI IDEs références`. Entries are project-relative paths using `/` separators. Skill → directory path; rule/agent → file path. One line per written destination for **every** IdeId that received a copy.

## CLI

```
skli install <ide> <kind> <source> [options]

Arguments:
  ide       IdeId CSV (e.g. cursor or cursor,claude)
  kind      InstallKind: skill | rule | agent
  source    Local path, or GitHub `owner/repo[@ref]:path` / HTTPS blob URL (path required)

Options:
  -g, --global              Use global / IDE-home path layout
  --versioning <mode>       Package VersioningMode (tag|commit|branch|none); default tag
  --no-references           Skill only: do not copy skill `references/` directory
  --gitignore               Project scope: add install destinations to `.gitignore`
  --debug                   Diagnostic logs (stderr)
```

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-install-001 | `ide`, `kind`, and `source` are required. |
| BR-cmd-install-002 | `ide` parsed per [`ide-targets`](ide-targets.md). |
| BR-cmd-install-003 | `kind` ∈ InstallKind (`skill` \| `rule` \| `agent`). |
| BR-cmd-install-004 | Resolve install dirs before work; zero dirs → error. |
| BR-cmd-install-006 | `kind` ∈ PackageKind: copy + Manifest write; GitHub Sources require a Package `path` (shorthand `:path` or HTTPS `/blob/…`). |
| BR-cmd-install-007 | `--versioning` defaults to `tag`; stored on Package entry. |
| BR-cmd-install-008 | Local entry: no `version` field, writes `ide`; repos entry: `version` = resolved install version (see BR-013), writes `ides`. |
| BR-cmd-install-015 | If Package id already present in the target Manifest (project or global): error before fetch/copy; message invites `skli restore`. |
| BR-cmd-install-016 | Local Package Source requires exactly one IDE in the CLI `ide` argument. |
| BR-cmd-install-013 | Repos + `versioning=tag`: if Source ref is an existing git tag, fetch/pin that tag; otherwise fetch/pin the **latest** tag (`TAG_COMMIT_DATE` DESC). Error if the repo has no tags. `version` is never a branch name. |
| BR-cmd-install-014 | Repos + `versioning=branch`: fetch/pin Source ref or default branch. `versioning=commit`: resolve to full SHA. `versioning=none`: fetch Source ref or default branch. |
| BR-cmd-install-009 | Project scope: require ProjectManifest (`init`); update ProjectIndex after success. |
| BR-cmd-install-010 | `--global`: write GlobalManifest; copy to global IDE dirs. |
| BR-cmd-install-011 | `--no-references` only valid with `kind=skill`; otherwise error. |
| BR-cmd-install-012 | Skill install writes `includeReferences` (`true` by default, `false` if `--no-references`); excludes root `references/` from copy when false. |
| BR-cmd-install-017 | `--gitignore` is project-scoped only; with `--global` → error. |
| BR-cmd-install-018 | After successful Package install with `--gitignore`: append every project-relative copy destination under `# Ignored AI IDEs références` (create file/section if needed; skip duplicates). Paths derive from actual destinations for all selected IdeIds ([`ide-targets`](ide-targets.md)) — never Cursor-only hardcoded. |

## User scenarios

`npx skli install cursor rule .cursor/rules/specs-documentation.mdc` copies the rule and records a local entry.  
`npx skli install cursor skill owner/repo@main:skills/foo --versioning tag` installs the **latest tag** (not `main`) and records that tag as `version`.  
`npx skli install cursor skill ./skills/foo --no-references` skips `references/` and sets `includeReferences: false`.  
`npx skli install cursor,claude skill owner/repo:skills/foo --gitignore` installs into both IDE dirs and adds both paths to `.gitignore`.  
`npx skli link cursor owner/repo --all` links a remote ProjectManifest (see [`cmd-link`](cmd-link.md)).

## Dependencies

- [`ide-targets`](ide-targets.md), [`github-source`](github-source.md), [`config-manifests`](config-manifests.md), [`domain-glossary`](domain-glossary.md), [`cmd-add`](cmd-add.md), [`cli-core`](cli-core.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md), [`cmd-remove`](cmd-remove.md), [`cmd-link`](cmd-link.md).

## Out of scope

- Multi-package install from a remote ProjectManifest — see [`cmd-link`](cmd-link.md).
- Cross-IDE format conversion.
- `list`.
- Uninstall — see [`cmd-remove`](cmd-remove.md) / [`cmd-unlink`](cmd-unlink.md).
- Version upgrade / re-fetch of existing Packages — see [`cmd-update`](cmd-update.md) and [`cmd-restore`](cmd-restore.md).

## Acceptance criteria

- [x] `install <ide> <kind> <source>` in `--help`; `--global`, `--debug`; no `--ide` option.
- [x] `--versioning` declared (default `tag`).
- [x] `kind=all` rejected (use `skli link`).
- [x] `kind` ∈ {skill,rule,agent} local: copy + Manifest local entry with `ide`.
- [x] `kind` ∈ {skill,rule,agent} repos: fetch + copy + Manifest repos entry with `version` + `ides`.
- [x] Duplicate Package id ⇒ error pointing to `skli restore` (no overwrite).
- [x] `versioning=tag` pins `version` to an existing tag (explicit Source tag or latest); never a branch.
- [x] `add` writes new local Package entry shape with `ide`.
- [x] `--no-references` (skill only) skips `references/` and sets `includeReferences: false`.
- [x] `--gitignore` appends all project destinations under `# Ignored AI IDEs références`; errors with `--global`.

## Terminology

See [`domain-glossary`](domain-glossary.md).

## Implementation notes

`src/commands/install.ts`, `src/lib/install-package.ts`, `src/lib/gitignore.ts`, `src/lib/resolve-version.ts`, `src/lib/fetch-github-path.ts`, `src/lib/ide-targets.ts`, `src/lib/github-source.ts`, `src/lib/manifests.ts`.
