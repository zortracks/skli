# restore command

| Field | Value |
|-------|--------|
| Slug | `cmd-restore` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

`skli restore` re-fetches installed Packages with `source=repos` at their **pinned** Manifest `version`, empties each target install path, and re-copies files. Does not resolve a newer version and does not change Manifest `version`. Same selection grammar as [`cmd-update`](cmd-update.md) (including install-path form). Packages with `source=local` are skipped (broad filters) or rejected (explicit id / path). No `--gitignore` or `--version` on restore.

Also restores **linked** packages from ProjectManifest `links` at each link’s pinned `version` (re-fetch remote ProjectManifest; copy selected packages; do not bump `link.version`).

## User flows

### Flow-01 — Restore all repos Packages

**Persona:** developer.  
**Preconditions:** ProjectManifest present (project scope); Packages have `source=repos` and a pinned `version`.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli restore --all` | Every repos Package re-fetched at `entry.version`; destinations emptied then copied; Manifest `version` unchanged | Missing ProjectManifest; missing `version` / `repos` / `path`; `gh` / network |
| 2 | No matching repos Packages | Informative message; exit 0 | — |

### Flow-02 — Filter by IDE / kind / id

Same forms as update:

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli restore cursor --all` | Repos entries intersecting cursor; copy to intersection dirs | Invalid IdeId |
| 2 | `skli restore all skill --all` | All repos skills | Invalid kind |
| 3 | `skli restore cursor skill arcade-bootstrap` | That id at pinned version | Missing id; `source=local`; no IDE intersection |

### Flow-03 — Global scope

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli restore --all --global` | GlobalManifest; global IDE dirs | — |

### Flow-04 — Target by install path

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli restore .cursor/skills/arcade-bootstrap` | Resolve path → ide/kind/id; re-fetch pinned version into that IDE’s dirs | Unmatched path; missing entry; `source=local` |

### Flow-05 — Linked manifests

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli restore --all` | PackageEntry repos restore **and** each matching link at `link.version`; copy selected packages; `link.version` unchanged | Missing pin / remote |
| 2 | Linked-only package id | Restore that linked package at the link pin | Missing if neither map nor links |

## Data model

Package entry: [`config-manifests`](config-manifests.md). Paths: [`ide-targets`](ide-targets.md).

Fetch ref = entry `version` (required for repos). No Manifest field changes on success.

## CLI

```
skli restore --all [options]
skli restore <ide> --all [options]
skli restore <ide|all> <kind> --all [options]
skli restore <ide|all> <kind> <id> [options]
skli restore <install-path> [options]

Arguments (depending on form):
  ide            IdeId CSV, or literal all (all IDEs) when kind is present
  kind           PackageKind: skill | rule | agent
  id             Package id (Manifest map key)
  install-path   Path under an IdeId layout (same as update)

Options:
  -g, --global   Use GlobalManifest and global IDE dirs
  --debug        Diagnostic logs (stderr)
  --all          Select all matching Packages (required unless <id> or <install-path> is given)
```

Invalid combinations → error, exit ≠ 0 (same as update selection rules; no `--version` / `--gitignore`).

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-restore-001 | Only Packages with `source=repos` are restored. |
| BR-cmd-restore-002 | Broad selection: skip `source=local` silently. Explicit `<id>` or path with `source=local` → error. |
| BR-cmd-restore-003 | Project scope: ProjectManifest required. `--global`: GlobalManifest. |
| BR-cmd-restore-004 | IDE / kind / id / install-path selection identical to [`cmd-update`](cmd-update.md) BR-004/005/011/012/013. |
| BR-cmd-restore-005 | Fetch ref is entry `version` (pinned). Error if `version`, `repos`, or `path` missing. |
| BR-cmd-restore-006 | Before copy: remove destination path then copy — no partial merge. |
| BR-cmd-restore-007 | Skill with `includeReferences === false`: exclude root `references/` from copy. |
| BR-cmd-restore-008 | Manifest entry is not modified on success (including `version`). |
| BR-cmd-restore-009 | Always re-fetch and re-copy when selected (no “already up to date” skip). |
| BR-cmd-restore-010 | Project scope: also restore matching `links` at pinned `link.version` (selection per [`cmd-update`](cmd-update.md) BR-017). Global: PackageEntry only. |
| BR-cmd-restore-011 | Explicit `<id>` may resolve to a linked package when absent from Package maps ([`cmd-update`](cmd-update.md) BR-018). |

## User scenarios

`npx @zortracks/skli restore cursor skill arcade-bootstrap` re-downloads the pinned tag into Cursor after a local edit.  
`npx @zortracks/skli restore .cursor/skills/arcade-bootstrap` same via path.  
`npx @zortracks/skli restore --all` refreshes every repos Package at its current pinned version without upgrading.

## Dependencies

- [`domain-glossary`](domain-glossary.md), [`config-manifests`](config-manifests.md), [`ide-targets`](ide-targets.md), [`github-source`](github-source.md), [`cmd-update`](cmd-update.md), [`cmd-install`](cmd-install.md), [`cli-core`](cli-core.md), [`cmd-remove`](cmd-remove.md), [`cmd-link`](cmd-link.md), [`cmd-unlink`](cmd-unlink.md).

## Out of scope

- Restoring `source=local` Packages.
- Version upgrades (see [`cmd-update`](cmd-update.md)).
- `--gitignore` / `--version` (update only).
- `list`.
- Uninstall — see [`cmd-remove`](cmd-remove.md) / [`cmd-unlink`](cmd-unlink.md).

## Acceptance criteria

- [x] Four filter CLI forms documented above work for `restore`.
- [x] Install-path form resolves via IdeId layouts and restores the matching Package.
- [x] Fetch uses pinned `version`; Manifest unchanged.
- [x] Destination emptied before copy.
- [x] `--global` and `--debug` supported.
- [x] Listed in `skli --help`.
- [x] Duplicate `install` of same id points users to `skli restore`.
- [x] Linked manifests (`links`) restored on project-scope restore.

## Terminology

See [`domain-glossary`](domain-glossary.md). CLI ide selector `all` is not an IdeId.

## Implementation notes

`src/commands/restore.ts`, shared with update via `src/lib/refresh-package.ts` / `src/lib/refresh-cli.ts`; path resolve shared with update.
