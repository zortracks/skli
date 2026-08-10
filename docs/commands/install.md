# install

Install a Skill, Rule, or Agent from a local path or GitHub Source into IDE directories; update the Manifest.

```
skli install <ide> <kind> <source> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `ide` | IdeId CSV (e.g. `cursor` or `cursor,claude`) |
| `kind` | `skill` \| `rule` \| `agent` |
| `source` | Local path, or GitHub `owner/repo[@ref]:path` / HTTPS blob URL (**path required** for GitHub) |

## Options

| Option | Description |
|--------|-------------|
| `-g, --global` | GlobalManifest + global IDE dirs |
| `--versioning <mode>` | `tag` \| `commit` \| `branch` \| `none` (default `tag`) |
| `--no-references` | Skill only: do not copy skill `references/` |
| `--gitignore` | Project scope: append destinations under `# Ignored AI IDE references` |
| `--debug` | Diagnostic logs (stderr) |

## Examples

```bash
npx @zortracks/skli install cursor rule ./path/to/rule.mdc
npx @zortracks/skli install cursor skill owner/repo@v1:skills/foo
npx @zortracks/skli install cursor,claude skill owner/repo:skills/foo --gitignore
npx @zortracks/skli install cursor skill owner/repo:skills/foo --global
```

## Behavior notes

- Project scope requires an existing ProjectManifest (`init`); updates ProjectIndex after success.
- Duplicate Package id in the target Manifest → error (use `skli restore`).
- Local Source requires exactly one IdeId in `<ide>`.
- `--gitignore` cannot combine with `--global`.
- Multi-package install from a remote ProjectManifest is owned by [`link`](./link), not `install`.

Product spec: [cmd-install](/specs/features/cmd-install).
