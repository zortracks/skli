# remove command

| Field | Value |
|-------|--------|
| Slug | `cmd-remove` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

`skli remove` uninstalls Packages from the Manifest and, depending on `source` and flags, optionally deletes files on disk. Selection grammar matches [`cmd-update`](cmd-update.md) / [`cmd-restore`](cmd-restore.md) (including install-path form).

- **`source=repos`:** remove Manifest entry (or shrink `ides`) and delete installed IDE destinations, unless `--keep-sources`.
- **`source=local`:** remove Manifest entry only, unless `--remove-sources` (also delete `entry.path` on disk).

Partial IDE filter removes only selected IDEs; the Manifest entry is deleted when no IDE remains.

## User flows

### Flow-01 — Remove all Packages

**Persona:** developer.  
**Preconditions:** ProjectManifest present (project scope).

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove --all` | Every matching Package processed per source rules; Manifest written | Missing ProjectManifest |
| 2 | No matching Packages | Informative message; exit 0 | — |

### Flow-02 — Filter by IDE / kind / id

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove cursor --all` | Entries intersecting cursor; repos: drop cursor from `ides` / delete dest; local with `ide=cursor`: drop entry | Invalid IdeId |
| 2 | `skli remove all skill --all` | All skills | Invalid kind |
| 3 | `skli remove cursor skill arcade-bootstrap` | That id only | Missing id; no IDE intersection |

### Flow-03 — Target by install path

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove .cursor/skills/arcade-bootstrap` | Resolve path → ide/kind/id; same as explicit form for that IDE | Unmatched path; missing entry |

### Flow-04 — repos keep sources

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove cursor skill arcade-bootstrap --keep-sources` | Manifest updated/removed; IDE destination files left on disk | Flag on explicit local entry |

### Flow-05 — local remove sources

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove cursor rule specs-documentation --remove-sources` | Manifest entry removed; `entry.path` deleted | Flag on explicit repos entry; path delete failure |

### Flow-06 — Global scope

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove --all --global` | Same against GlobalManifest / global IDE dirs | — |

### Flow-07 — Partial IDE shrink (repos)

**Preconditions:** Entry with `ides: [cursor, claude]`.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `skli remove cursor skill foo` | Delete cursor dest (unless `--keep-sources`); `ides` → `[claude]`; entry kept | — |
| 2 | `skli remove claude skill foo` (after step 1) | Delete last IDE dest; entry removed from Manifest | — |

## Data model

Package entry: [`config-manifests`](config-manifests.md). Paths: [`ide-targets`](ide-targets.md).

- **repos:** destinations via `resolveInstallDirs` + `packageDestination` for `targetIdes` only. Remaining `ides` written back; empty `ides` ⇒ delete entry.
- **local:** always delete Manifest entry when `ide` matches filter; optionally delete resolved `entry.path` with `--remove-sources`.

No gitignore changes.

## CLI

```
skli remove --all [options]
skli remove <ide> --all [options]
skli remove <ide|all> <kind> --all [options]
skli remove <ide|all> <kind> <id> [options]
skli remove <install-path> [options]

Arguments (depending on form):
  ide            IdeId CSV, or literal all (all IDEs) when kind is present
  kind           PackageKind: skill | rule | agent
  id             Package id (Manifest map key)
  install-path   Path under an IdeId layout (same as update/restore)

Options:
  -g, --global         Use GlobalManifest and global IDE dirs
  --debug              Diagnostic logs (stderr)
  --all                Select all matching Packages (required unless <id> or <install-path> is given)
  --keep-sources       repos: do not delete install destinations
  --remove-sources     local: also delete entry.path on disk
```

Invalid combinations (selection same as update; `--keep-sources` with `--remove-sources`; wrong flag for explicit entry `source`) → error, exit ≠ 0.

## Business rules

| Id | Rule |
|----|------|
| BR-cmd-remove-001 | Both `source=repos` and `source=local` Packages can be removed. |
| BR-cmd-remove-002 | Project scope: ProjectManifest required (`init`). `--global`: GlobalManifest. |
| BR-cmd-remove-003 | IDE / kind / id / install-path selection identical to [`cmd-update`](cmd-update.md) BR-004/005/011/012/013, except both sources are eligible. |
| BR-cmd-remove-004 | repos without `--keep-sources`: delete install destinations for `targetIdes` (`force` rm; missing path OK). |
| BR-cmd-remove-005 | repos: remove `targetIdes` from `ides`; if `ides` empty, delete Manifest entry; otherwise write updated entry. |
| BR-cmd-remove-006 | local: when `ide` matches filter, delete Manifest entry. Without `--remove-sources`, leave `entry.path` on disk. |
| BR-cmd-remove-007 | `--remove-sources` on local: delete resolved `entry.path` (`force` recursive rm). |
| BR-cmd-remove-008 | `--keep-sources` + `--remove-sources` together → error. |
| BR-cmd-remove-009 | Explicit `<id>` / path: `--keep-sources` on local entry → error; `--remove-sources` on repos entry → error. Broad `--all`: each flag applies only to matching `source` (ignore otherwise). |
| BR-cmd-remove-010 | Explicit target missing from Manifest → error. Explicit target with no IDE intersection → error. |
| BR-cmd-remove-011 | No `.gitignore` cleanup. |

## User scenarios

`npx @zortracks/skli remove cursor skill arcade-bootstrap` uninstalls that repos skill from Cursor dirs and Manifest.  
`npx @zortracks/skli remove .cursor/skills/arcade-bootstrap` same via path.  
`npx @zortracks/skli remove cursor rule specs-documentation` drops the local Manifest reference without deleting the rule file.  
`npx @zortracks/skli remove --all --keep-sources` clears Manifest entries for repos Packages but leaves IDE copies on disk.

## Dependencies

- [`domain-glossary`](domain-glossary.md), [`config-manifests`](config-manifests.md), [`ide-targets`](ide-targets.md), [`cli-core`](cli-core.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md), [`cmd-install`](cmd-install.md), [`cmd-add`](cmd-add.md).

## Out of scope

- Cleaning `.gitignore` entries.
- `list` command.
- Interactive confirm prompts.
- Linked packages under `links` — see [`cmd-unlink`](cmd-unlink.md).

## Acceptance criteria

- [x] Four filter CLI forms + install-path form work for `remove`.
- [x] repos: destinations deleted unless `--keep-sources`; `ides` shrunk / entry removed.
- [x] local: Manifest entry removed; path deleted only with `--remove-sources`.
- [x] Flag misuse rules (mutual exclusion; explicit wrong-source) enforced.
- [x] `--global` and `--debug` supported.
- [x] Listed in `skli --help`.

## Terminology

See [`domain-glossary`](domain-glossary.md). CLI ide selector `all` is not an IdeId.

## Implementation notes

`src/commands/remove.ts`, `src/lib/remove-package.ts` / `src/lib/remove-cli.ts`; reuse `selectionFromArgs` from `src/lib/refresh-package.ts`; destinations via `src/lib/copy-package.ts` + `src/lib/ide-targets.ts`; Manifest helpers in `src/lib/manifests.ts`.
