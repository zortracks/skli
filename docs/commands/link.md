# link

Link a remote ProjectManifest (GitHub) into the current project, select packages, and copy them into IDE install dirs.

```
skli link <ide> <source> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `ide` | IdeId CSV (e.g. `cursor` or `cursor,claude`) |
| `source` | GitHub repo Source (`owner/repo[@ref]`, HTTPS, …). Package `:path` ignored |

## Options

| Option | Description |
|--------|-------------|
| `--all` | Select all skills, rules, and agents (no prompt) |
| `--all-skills` | Select all remote skills |
| `--all-rules` | Select all remote rules |
| `--all-agents` | Select all remote agents |
| `--versioning <mode>` | Link VersioningMode (default `tag`) |
| `--gitignore` | Add copy destinations to `.gitignore` |
| `--debug` | Diagnostic logs (stderr) |

## Examples

```bash
npx skli link cursor owner/repo
npx skli link cursor owner/repo --all --gitignore
npx skli link cursor,claude owner/repo@v1 --all-skills
```

## Behavior notes

- Project scope only; ProjectManifest required.
- Selection is stored under ProjectManifest `links` only (no Package map dual-write).
- Remote packages are copied the same way as `install`.

Product spec: [cmd-link](/specs/features/cmd-link).
