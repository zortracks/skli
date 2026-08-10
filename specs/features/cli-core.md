# CLI core

| Field | Value |
|-------|--------|
| Slug | `cli-core` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

npm package `skli` runnable via `npx skli {command} {options}`. Command and option parsing with **Commander**. Single entry point, global version and help.

## User flows

### Flow-01 — Show help

**Persona:** developer.  
**Preconditions:** Node.js installed; skli package available (local or registry).

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `npx skli --help` or `npx skli -h` | List of commands (`init`, `install`, `add`, …) and global options | — |
| 2 | `npx skli -V` | Package semver version | — |

### Flow-02 — Unknown command

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `npx skli unknown` | Commander error message + exit code ≠ 0 | unknown command |

## Data model

Nothing persisted by this feature (delegates to manifests).

## CLI

```
skli [options] [command]

Options:
  -V              Display version (reserved; `update --version` pins a Package)
  -h, --help      Display help

Commands:
  init                  Initialize the ProjectManifest for the git repository
  install <ide> <kind> <source>  Install Package(s) for IDE(s) from a Source
  add <ide> <kind> <path>  Reference a local Package in the ProjectManifest
  link <ide> <source>   Link a remote ProjectManifest (select packages)
  update …              Upgrade repos Packages and linked manifests
  restore …             Re-fetch repos Packages / links at pinned version
  remove …              Uninstall Packages from Manifest (and optionally disk)
  unlink <id>           Unlink a remote ProjectManifest link (owner/repo or URL)
```


## Business rules

| Id | Rule |
|----|------|
| BR-cli-core-001 | The npm binary is named `skli` (`package.json` → `bin.skli`). |
| BR-cli-core-002 | Node ESM runtime (`"type": "module"`). |
| BR-cli-core-003 | Parsing library: `commander` only for CLI routing. |
| BR-cli-core-004 | With no subcommand, show help (or equivalent Commander behavior). |

## User scenarios

A user discovers skli via `npx skli --help`, sees `init`, `install`, `add`, `link`, `update`, `restore`, `remove`, and `unlink`, then continues with one of those commands.

## Dependencies

- [`domain-glossary`](domain-glossary.md) — Package, Source, Manifest terms.
- [`cmd-init`](cmd-init.md), [`cmd-install`](cmd-install.md), [`cmd-add`](cmd-add.md), [`cmd-link`](cmd-link.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md), [`cmd-remove`](cmd-remove.md), [`cmd-unlink`](cmd-unlink.md) — registered commands.

## Out of scope

- Shell autocompletion.
- Automatic CLI updates.
- Plugins / third-party commands.

## Acceptance criteria

- [x] `npx skli --help` lists `init`, `install`, `add`, `link`, `update`, `restore`, `remove`, and `unlink`.
- [x] `npx skli -V` shows the package version (`--version` reserved for `update`).
- [x] TypeScript package is buildable; CLI entry with shebang.

## Terminology

See [`domain-glossary`](domain-glossary.md).

## Implementation notes

Target structure: `src/cli.ts`, `src/commands/*`, `src/lib/*`; build to `dist/`; `bin` points to the compiled entrypoint.
