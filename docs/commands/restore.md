# restore

Re-fetch repos Packages / links at the **pinned** Manifest version (no upgrade).

```
skli restore --all [options]
skli restore <ide> --all [options]
skli restore <ide|all> <kind> --all [options]
skli restore <ide|all> <kind> <id> [options]
skli restore <install-path> [options]
```

## Arguments

Same selection model as [update](./update): `ide`, `kind`, `id`, or `install-path`.

## Options

| Option | Description |
|--------|-------------|
| `-g, --global` | GlobalManifest and global IDE dirs |
| `--all` | Select all matching Packages (required unless `<id>` or path) |
| `--debug` | Diagnostic logs (stderr) |

No `--version` / `--gitignore` on restore.

## Examples

```bash
npx @zortracks/skli restore --all
npx @zortracks/skli restore cursor skill foo
npx @zortracks/skli restore .cursor/skills/arcade-bootstrap
```

## Behavior notes

- Only `source=repos` Packages; selection rules match update.
- Useful after a fresh clone or when IDE files were deleted but the Manifest still pins a version.

Product spec: [cmd-restore](/specs/features/cmd-restore).
