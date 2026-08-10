# update

Upgrade repos Packages (and linked manifests) to a newer resolved version.

```
skli update --all [options]
skli update <ide> --all [options]
skli update <ide|all> <kind> --all [options]
skli update <ide|all> <kind> <id> [options]
skli update <install-path> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `ide` | IdeId CSV, or literal `all` when kind is present |
| `kind` | `skill` \| `rule` \| `agent` |
| `id` | Package id (Manifest map key) |
| `install-path` | Path under an IdeId layout (e.g. `.cursor/skills/foo`) |

## Options

| Option | Description |
|--------|-------------|
| `-g, --global` | GlobalManifest and global IDE dirs |
| `--all` | Select all matching Packages (required unless `<id>` or `<install-path>`) |
| `--version <ref>` | Single Package only: fetch and pin this ref |
| `--gitignore` | Project scope: add refreshed destinations to `.gitignore` |
| `--debug` | Diagnostic logs (stderr) |

## Examples

```bash
npx skli update --all
npx skli update cursor skill foo
npx skli update cursor skill foo --version v2.0.0
npx skli update .cursor/skills/arcade-bootstrap
npx skli update --all --gitignore
```

## Behavior notes

- Only `source=repos` Packages are updated; local entries are skipped on broad selection (error if targeted explicitly).
- Invalid combinations (`--all` with `<id>`, `--version` with `--all`, `--gitignore` with `--global`, …) → error.

Product spec: [cmd-update](/specs/features/cmd-update).
