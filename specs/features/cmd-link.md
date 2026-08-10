# link command

| Field | Value |
|-------|--------|
| Slug | `cmd-link` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

`skli link {ide} {source}` links a remote ProjectManifest (GitHub repository) into the current project. The user selects which Skills, Rules, and Agents from that remote manifest to deploy. Selection is stored under ProjectManifest `links` only (no PackageEntry dual-write). Selected packages are copied into IDE install dirs the same way as [`cmd-install`](cmd-install.md).

Project scope only (no `--global`).

## User flows

### Flow-01 — Interactive link

**Persona:** developer.  
**Preconditions:** ProjectManifest present (`init`); `gh` authenticated; remote has `.skli/skli.json`.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli link cursor owner/repo` | Fetch remote ProjectManifest; checkbox prompt (arrows / space / enter) with `all`, `skip`, then each remote package id | Missing init; invalid ide; no GitHub source; missing remote manifest; auth |
| 2 | User selects packages | Write `links[owner/repo]` with `includeAll` / `includes` per kind; copy selected packages to IDE dirs | Link key already exists → error (use `unlink` first) |
| 3 | Success | Message listing linked packages / destinations | — |

### Flow-02 — Flags skip prompts

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli link cursor owner/repo --all` | All remote skills, rules, agents; `includeAll: true` for each kind; no interactive prompt | — |
| 2 | `skli link cursor owner/repo --all-skills` | Skills `includeAll: true`; rules/agents still prompted (or skip if empty) | — |
| 3 | Combined `--all-skills --all-rules --all-agents` | Same as `--all` | — |

### Flow-03 — Gitignore

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli link cursor owner/repo --all --gitignore` | After copy: destinations appended under `# Ignored AI IDEs références` | — |

### Flow-04 — Explicit ref / versioning

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli link cursor owner/repo@v1.0.0 --all --versioning tag` | Pin link `version` per install resolve rules; store `versioning` on link entry | No tags / invalid ref |

## Data model

Link entry: [`config-manifests`](config-manifests.md) (`links`). Paths: [`ide-targets`](ide-targets.md). Remote packages resolved by re-reading the remote ProjectManifest at the pinned `version` (ids → `path`).

**Storage rule:** linked packages are **not** written into local `skills` / `rules` / `agents` maps.

## CLI

```
skli link <ide> <source> [options]

Arguments:
  ide       IdeId CSV (e.g. cursor or cursor,claude)
  source    GitHub repo Source (`owner/repo[@ref]`, HTTPS, …). Package `:path` ignored.

Options:
  --all                 Select all skills, rules, and agents (no prompt)
  --all-skills          Select all remote skills (no skill prompt)
  --all-rules           Select all remote rules
  --all-agents          Select all remote agents
  --versioning <mode>   Link VersioningMode (tag|commit|branch|none); default tag
  --gitignore           Add copy destinations to `.gitignore`
  --debug               Diagnostic logs (stderr)
```

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-link-001 | Project scope only; ProjectManifest required (`init`). |
| BR-cmd-link-002 | `ide` parsed per [`ide-targets`](ide-targets.md). |
| BR-cmd-link-003 | `source` must parse as GitHub; fetch remote ProjectManifest at resolved ref. |
| BR-cmd-link-004 | Link key = `owner/repo`. If `links[key]` already exists → error (invite `skli unlink`). |
| BR-cmd-link-005 | Interactive checkbox when a kind is not covered by `--all` / `--all-{kind}`; choices include `all`, `skip`, and each remote package id for that kind. |
| BR-cmd-link-006 | `includeAll: true` when user picks `all` or a `--all*` flag for that kind; `includes` may be `[]`. Otherwise `includeAll: false` and `includes` = selected ids. `skip` → empty selection for that kind (`includeAll: false`, `includes: []`). |
| BR-cmd-link-007 | Resolve link `version` like install (`resolveInstallRef` + `--versioning`). |
| BR-cmd-link-008 | For each selected package: fetch remote `path` from remote PackageEntry; `copyPackageToTargets` into resolved IDE dirs; do **not** `addPackageToManifest`. |
| BR-cmd-link-009 | Write `links[owner/repo]` with `repos`, `versioning`, `version`, `ides`, and per-kind selection. |
| BR-cmd-link-010 | `--gitignore`: same behavior as install BR-017/018 for copied destinations. |
| BR-cmd-link-011 | Empty selection across all kinds → error (nothing to link). |

## User scenarios

`npx skli link cursor https://github.com/zortracks/skli --all` links every package from that repo’s ProjectManifest into Cursor dirs and records `links["zortracks/skli"]`.  
`npx skli link cursor,claude owner/repo` opens checkboxes per kind, then copies into both IDE layouts.

## Dependencies

- [`domain-glossary`](domain-glossary.md), [`config-manifests`](config-manifests.md), [`ide-targets`](ide-targets.md), [`github-source`](github-source.md), [`cmd-install`](cmd-install.md), [`cli-core`](cli-core.md), [`cmd-unlink`](cmd-unlink.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md).

## Out of scope

- `--global` / GlobalManifest links.
- Dual-write into local Package maps.
- Merging into an existing `links` entry (must unlink first).
- `--no-references` (skills copy with references included).

## Acceptance criteria

- [x] `skli link <ide> <source>` registered in `--help`.
- [x] Remote ProjectManifest fetched; interactive or `--all*` selection.
- [x] `links` entry written with `includeAll` / `includes`; no PackageEntry dual-write.
- [x] Selected packages copied to IDE dirs.
- [x] Duplicate link key → error.
- [x] `--gitignore` supported.

## Terminology

See [`domain-glossary`](domain-glossary.md). **Link** / **LinkEntry** defined in glossary and [`config-manifests`](config-manifests.md).

## Implementation notes

`src/commands/link.ts`, `src/lib/link-cli.ts`, `src/lib/link-package.ts`; reuse `copyPackageToTargets`, `fetchGitHubPathToTemp`, `resolveInstallRef`, remote ProjectManifest fetch helper.
