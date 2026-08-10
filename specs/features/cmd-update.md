# update command

| Field | Value |
|-------|--------|
| Slug | `cmd-update` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

`skli update` refreshes installed Packages with `source=repos` by resolving a newer (or current) version from the remote repository, emptying each target install path, re-copying files, and updating Manifest `version` when it changes. Packages with `source=local` are skipped (broad filters) or rejected (explicit id).

Also refreshes **linked** packages from ProjectManifest `links`: re-fetch the remote ProjectManifest, resolve selected packages (`includeAll` / `includes`), copy with empty-first, bump `link.version`, and when `includeAll` install newly appeared remote packages.

Also supports targeting a Package by its **install path** (IDE layout path), optional `--version` to pin a specific ref on single-Package updates, and optional `--gitignore` to record destinations in the project `.gitignore`.

## User flows

### Flow-01 — Update all repos Packages

**Persona:** developer.  
**Preconditions:** ProjectManifest present (project scope); at least one `source=repos` entry (optional).

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update --all` | Every repos Package for all its `ides` re-resolved, destinations emptied then copied; `version` updated when resolved version differs | Missing ProjectManifest (project scope); `gh` / network |
| 2 | Resolved version equals pinned `version` | Skip that Package (message); continue; exit 0 | — |
| 3 | No matching repos Packages | Informative message; exit 0 | — |

### Flow-02 — Filter by IDE(s)

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update cursor,claude --all` | Only repos entries whose `ides` intersect the selector; copy only into intersection dirs | Invalid IdeId |

### Flow-03 — Filter by kind

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update cursor skill --all` | All repos skills targeting cursor (intersection) | Invalid kind |
| 2 | `skli update all rule --all` | All repos rules for all IDEs in each entry | — |

### Flow-04 — Single Package id

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update cursor skill arcade-bootstrap` | That id only; empty dest + copy; bump `version` if newer | Missing id; `source=local`; id not targeting selected IDE(s) |

### Flow-05 — Global scope

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update --all --global` | Same selection against GlobalManifest; copy to global IDE dirs | — |

### Flow-06 — Target by install path

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update .cursor/skills/arcade-bootstrap` | Resolve path → ide/kind/id via [`ide-targets`](ide-targets.md); same as `update cursor skill arcade-bootstrap` | Unmatched path; missing Manifest entry; `source=local` |
| 2 | `skli update .claude/rules/foo.mdc` | Resolve to claude/rule/foo | — |

### Flow-07 — Explicit `--version`

**Preconditions:** Single Package targeted (`<ide\|all> <kind> <id>` or install path).

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update cursor skill arcade-bootstrap --version v0.1.7` | Fetch/pin that ref (no latest resolution); Manifest `version` = `v0.1.7` when changed | Invalid with `--all` / multi-select; ref invalid for entry `versioning` |
| 2 | Already pinned to that version | Skip (message); exit 0 | — |

### Flow-08 — Gitignore after update

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update cursor skill arcade-bootstrap --gitignore` | Append project-relative destinations under `# Ignored AI IDE references` (also when refresh is skipped as already at version) | `--gitignore` with `--global` |

### Flow-09 — Linked manifests

**Preconditions:** ProjectManifest with a `links` entry; project scope (links are not global).

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli update --all` | PackageEntry repos refresh **and** each matching link: resolve newer version; fetch remote ProjectManifest; copy selected packages (`includeAll` or `includes`); update `link.version`; with `includeAll`, also copy new remote packages | `gh` / network |
| 2 | `skli update cursor skill foo` when `foo` is only linked (not in Package maps) | Refresh that linked skill into intersecting IDE dirs | Missing if neither map nor links |
| 3 | Link already at resolved version | Skip link bump; still no-op for packages already at that pin unless restore semantics | — |

## Data model

Package entry: [`config-manifests`](config-manifests.md). Link entry: same. Paths: [`ide-targets`](ide-targets.md). Version resolve: same as install via `resolveInstallRef` **without** Source ref ([`cmd-install`](cmd-install.md) BR-013/014), unless `--version` supplies an explicit ref.

Fields preserved on PackageEntry: `path`, `repos`, `versioning`, `ides`, `includeReferences`. Field updated: `version` when the resolved (or explicit) version differs.

On LinkEntry: `version` updated when resolved version differs; selection fields preserved (`includeAll` / `includes`); with `includeAll`, newly discovered remote ids are included in the sync without rewriting `includes`.

`.gitignore` behavior matches [`cmd-install`](cmd-install.md) BR-017/018 (all IdeId destinations from the refresh intersection).

## CLI

```
skli update --all [options]
skli update <ide> --all [options]
skli update <ide|all> <kind> --all [options]
skli update <ide|all> <kind> <id> [options]
skli update <install-path> [options]

Arguments (depending on form):
  ide            IdeId CSV, or literal all (all IDEs) when kind is present
  kind           PackageKind: skill | rule | agent
  id             Package id (Manifest map key)
  install-path   Project- or global-relative path under an IdeId layout (e.g. .cursor/skills/arcade-bootstrap)

Options:
  -g, --global         Use GlobalManifest and global IDE dirs
  --debug              Diagnostic logs (stderr)
  --all                Select all matching Packages (required unless <id> or <install-path> is given)
  --version <ref>      Single Package only: fetch and pin this ref
  --gitignore          Project scope: add refreshed destinations to `.gitignore`
```

Invalid combinations (e.g. `--all` with `<id>`, `<id>` without `<kind>`, no `--all` and no `<id>`/`<install-path>`, `--version` with `--all`, `--gitignore` with `--global`) → error, exit ≠ 0.

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-update-001 | Only Packages with `source=repos` are updated. |
| BR-cmd-update-002 | Broad selection (`--all` forms): skip `source=local` silently. Explicit `<id>` or path with `source=local` → error. |
| BR-cmd-update-003 | Project scope: ProjectManifest required (`init`). `--global`: GlobalManifest. |
| BR-cmd-update-004 | IDE filter: entry matches if `ides` intersects selected IDEs; copy only to intersection dirs. Selector `all` or omitted (`update --all`) = no IDE filter (all `ides` on each entry). |
| BR-cmd-update-005 | Kind filter: when `<kind>` present, only that PackageKind map. |
| BR-cmd-update-006 | Without `--version`: resolve fetch ref via entry `versioning` with no Source ref (latest tag / default branch / etc., same as install). |
| BR-cmd-update-007 | If resolved (or explicit) version equals entry `version`, skip fetch/copy for that Package. |
| BR-cmd-update-008 | Before copy: remove destination path (directory or file) then copy — no partial merge. |
| BR-cmd-update-009 | Skill with `includeReferences === false`: exclude root `references/` from copy (same as install `--no-references`). |
| BR-cmd-update-010 | On successful refresh with a new version: write updated `version` on the entry; other fields unchanged. |
| BR-cmd-update-011 | Explicit `<id>` or path target missing from Manifest → error. Explicit target with no IDE intersection → error. |
| BR-cmd-update-012 | `--all` and `<id>` / `<install-path>` are mutually exclusive. |
| BR-cmd-update-013 | Single-arg path form: resolve against all IdeId layouts ([`ide-targets`](ide-targets.md)); equivalent to `update <ide> <kind> <id>` for the matched IDE. Skill → directory basename as id; rule/agent → file basename without extension. |
| BR-cmd-update-014 | `--version <ref>` only with a single Package target (`<ide\|all> <kind> <id>` or `<install-path>`). Pin/fetch that ref (validate per entry `versioning`); do not resolve “latest”. Incompatible with `--all` / incomplete multi-select forms. |
| BR-cmd-update-015 | `--gitignore` project-scoped only (error with `--global`); for each matched Package (updated or skipped as already at version), append destinations per [`cmd-install`](cmd-install.md) BR-018. |
| BR-cmd-update-016 | Project scope: also refresh matching `links` entries (resolve newer version; sync selected remote packages; bump `link.version`). Global scope: PackageEntry only (no links). |
| BR-cmd-update-017 | Linked package selection: `includeAll` ⇒ all ids of that kind in the remote ProjectManifest at the fetch ref; else `includes`. |
| BR-cmd-update-018 | Explicit `<id>` missing from Package maps but present under a matching link ⇒ treat as linked package refresh. Missing from both ⇒ error. |

## User scenarios

`npx skli update --all` upgrades every repos Package in the project Manifest to the latest tag (when `versioning=tag`).  
`npx skli update cursor skill arcade-bootstrap` upgrades that skill into Cursor dirs only (intersection).  
`npx skli update .cursor/skills/arcade-bootstrap` same as the previous command via path.  
`npx skli update cursor skill arcade-bootstrap --version v0.1.7` pins that tag.  
Already at target version → skip message, exit 0.

## Dependencies

- [`domain-glossary`](domain-glossary.md), [`config-manifests`](config-manifests.md), [`ide-targets`](ide-targets.md), [`github-source`](github-source.md), [`cmd-install`](cmd-install.md), [`cli-core`](cli-core.md), [`cmd-restore`](cmd-restore.md), [`cmd-remove`](cmd-remove.md), [`cmd-link`](cmd-link.md), [`cmd-unlink`](cmd-unlink.md).

## Out of scope

- Updating `source=local` Packages.
- Changing an entry’s `versioning` mode.
- `list`.
- Uninstall — see [`cmd-remove`](cmd-remove.md) / [`cmd-unlink`](cmd-unlink.md).

## Acceptance criteria

- [x] Four filter CLI forms documented above work for `update`.
- [x] Install-path form resolves via IdeId layouts and updates the matching Package.
- [x] `--version` pins a single Package; rejected with `--all`.
- [x] `--gitignore` appends destinations (all IdeIds in the refresh); errors with `--global`.
- [x] Only `source=repos` Packages are refreshed; local skipped or rejected per BR.
- [x] Destination emptied before copy.
- [x] Manifest `version` updated when resolved version differs; skipped when equal.
- [x] `--global` and `--debug` supported.
- [x] Listed in `skli --help`.
- [x] Linked manifests (`links`) refreshed on project-scope update.

## Terminology

See [`domain-glossary`](domain-glossary.md). CLI ide selector `all` is not an IdeId.

## Implementation notes

`src/commands/update.ts`, shared refresh in `src/lib/refresh-package.ts` / `src/lib/refresh-cli.ts`; path resolve via `src/lib/ide-targets.ts` (or helper); `src/lib/gitignore.ts`; reuses `resolveInstallRef`, `fetchGitHubPathToTemp`, Manifest helpers.
