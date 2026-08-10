# init

Create a ProjectManifest and register the project in the ProjectIndex.

```
skli init [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--name <name>` | Project name |
| `--description <text>` | Description |
| `--versioning <tag\|commit\|branch\|none>` | Versioning mode (default: `tag`) |
| `--tag <tag>` | Project tag (repeatable) |
| `--tags <list>` | Comma-separated tags |
| `-y, --yes` | Defaults without prompt; confirm parent git |
| `-f, --force` | Allow overwrite if manifest already present |

## Examples

```bash
npx @zortracks/skli init
npx @zortracks/skli init -y --name my-app --tags ai,cursor
npx @zortracks/skli init --force
```

## Behavior

- Writes `{cwd}/.skli/skli.json`.
- Requires a git repository (parent git confirmation unless `-y`).
- Updates `~/.skli/projects.json` with the absolute project path.
- Exit `0` on success or after declining parent-git; non-zero on error (no git, existing manifest without `--force`, validation, I/O).

Product spec: [cmd-init](/specs/features/cmd-init).
