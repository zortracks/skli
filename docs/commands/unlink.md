# unlink

Remove a whole **link** by `owner/repo` (or a GitHub Source URL that resolves to it).

```
skli unlink <id> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `id` | Link key `owner/repo`, or GitHub Source URL / shorthand resolving to `owner/repo` |

## Options

| Option | Description |
|--------|-------------|
| `--keep-sources` | Do not delete install destinations on disk |
| `--debug` | Diagnostic logs (stderr) |

## Examples

```bash
npx @zortracks/skli unlink owner/repo
npx @zortracks/skli unlink https://github.com/owner/repo --keep-sources
```

## Behavior notes

- ProjectManifest `links` only (not Package maps). No `--global`.
- Without `--keep-sources`, deletes install destinations for all packages selected by the link across its `ides`.
- Always deletes the entire LinkEntry on success.
- Resolves package paths via the remote ProjectManifest at `link.version`.

Product spec: [cmd-unlink](/specs/features/cmd-unlink).
