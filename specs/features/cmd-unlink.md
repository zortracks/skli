# unlink command

| Field | Value |
|-------|--------|
| Slug | `cmd-unlink` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

`skli unlink <id>` removes an entire LinkEntry from ProjectManifest `links` (key = `owner/repo`). By default it also deletes the corresponding IDE install destinations for every package selected by that link. Paths are resolved by re-fetching the remote ProjectManifest at the link’s pinned `version`.

`<id>` is the link key (`owner/repo`) or a GitHub Source (URL / shorthand) that resolves to `owner/repo`.

Project scope only. No `--global`, no `--all`, no per-package / install-path selection.

## User flows

### Flow-01 — Unlink by link key

**Persona:** developer.  
**Preconditions:** ProjectManifest with `links["owner/repo"]`.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli unlink owner/repo` | All linked packages for that entry deleted from IDE dirs; `links[owner/repo]` removed | Missing ProjectManifest; unknown link key |
| 2 | Missing link key | — | Error; exit ≠ 0 |

### Flow-02 — Unlink by GitHub URL

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli unlink https://github.com/owner/repo` | Same as Flow-01 for `owner/repo` | Unparsed Source; unknown link |

### Flow-03 — Keep sources

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli unlink owner/repo --keep-sources` | Remove `links[owner/repo]` only; IDE files left on disk | Unknown link |

## Data model

Link entry: [`config-manifests`](config-manifests.md). Destinations: remote PackageEntry `path` at `link.version` + `resolveInstallDirs` + `packageDestination` for every package selected by `includeAll` / `includes` across skills/rules/agents and all link `ides`.

On success: delete `links[key]` entirely (omit `links` when empty).

## CLI

```
skli unlink <id> [options]

Arguments:
  id    Link key `owner/repo`, or GitHub Source URL / shorthand resolving to owner/repo

Options:
  --debug          Diagnostic logs (stderr)
  --keep-sources   Do not delete install destinations on disk
```

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-unlink-001 | Operates only on ProjectManifest `links` (not Package maps). |
| BR-cmd-unlink-002 | ProjectManifest required (`init`). No `--global`. |
| BR-cmd-unlink-003 | Resolve `<id>` to `owner/repo` via exact key match or [`parseGitHubSource`](github-source.md); otherwise error. |
| BR-cmd-unlink-004 | Unknown `links[owner/repo]` → error. |
| BR-cmd-unlink-005 | Without `--keep-sources`: delete install destinations for all packages selected by the link across its `ides` (`force` rm; missing path OK). |
| BR-cmd-unlink-006 | Always delete the entire LinkEntry on success. |
| BR-cmd-unlink-007 | Resolve package paths via remote ProjectManifest at `link.version` ([`github-source`](github-source.md)). |
| BR-cmd-unlink-008 | No `.gitignore` cleanup. No `--all`. |

## User scenarios

`npx @zortracks/skli unlink zortracks/skli` removes that link and deletes linked IDE copies.  
`npx @zortracks/skli unlink https://github.com/zortracks/skli --keep-sources` removes link metadata only.

## Dependencies

- [`domain-glossary`](domain-glossary.md), [`config-manifests`](config-manifests.md), [`ide-targets`](ide-targets.md), [`github-source`](github-source.md), [`cmd-link`](cmd-link.md), [`cmd-remove`](cmd-remove.md), [`cli-core`](cli-core.md).

## Out of scope

- Removing PackageEntry map entries (use [`cmd-remove`](cmd-remove.md)).
- Per-package or IDE-filtered unlink.
- Cleaning `.gitignore`.
- Interactive confirm prompts.
- `--global` / `--all`.

## Acceptance criteria

- [x] `skli unlink <id>` registered in `--help`.
- [x] Accepts `owner/repo` or GitHub URL; removes entire link entry.
- [x] Destinations deleted unless `--keep-sources`.
- [x] `--debug` supported.
- [x] No `--all` / remove-like selection grammar.

## Terminology

See [`domain-glossary`](domain-glossary.md).

## Implementation notes

`src/commands/unlink.ts`, `src/lib/unlink-cli.ts`, `src/lib/unlink-package.ts`; remote manifest fetch for path resolution when deleting destinations.
