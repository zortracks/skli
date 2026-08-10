# remove

Uninstall Packages from the Manifest (and optionally from disk).

```
skli remove --all [options]
skli remove <ide> --all [options]
skli remove <ide|all> <kind> --all [options]
skli remove <ide|all> <kind> <id> [options]
skli remove <install-path> [options]
```

## Arguments

Same selection model as [update](./update).

## Options

| Option | Description |
|--------|-------------|
| `-g, --global` | GlobalManifest and global IDE dirs |
| `--all` | Select all matching Packages |
| `--keep-sources` | repos: do not delete install destinations |
| `--remove-sources` | local: also delete `entry.path` on disk |
| `--debug` | Diagnostic logs (stderr) |

## Examples

```bash
npx @zortracks/skli remove cursor skill foo
npx @zortracks/skli remove --all
npx @zortracks/skli remove cursor skill foo --keep-sources
npx @zortracks/skli remove cursor rule my-rule --remove-sources
```

## Behavior notes

- Both `repos` and `local` Packages can be removed.
- Do not combine `--keep-sources` with `--remove-sources`.
- Does not clean `.gitignore` entries.

Product spec: [cmd-remove](/specs/features/cmd-remove).
