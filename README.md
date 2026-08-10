# skli

CLI to manage **skills**, **rules**, and **agents** for AI IDEs — like a package manager.

**Documentation:** [https://zortracks.github.io/skli/](https://zortracks.github.io/skli/)

## Install

Requires **Node.js 20+**. For GitHub sources, install and authenticate the [`gh`](https://cli.github.com/) CLI.

```bash
# One-off
npx skli <command> [options]

# Or install globally
npm install -g skli
skli <command> [options]
```

## Quick start

```bash
# 1. Create a project manifest
npx skli init

# 2a. Reference a local package already in the repo
npx skli add cursor rule .cursor/rules/my-rule.mdc

# 2b. Install a package from GitHub into IDE folders
npx skli install cursor skill owner/repo@v1:skills/foo

# 2c. Link a remote project manifest and pick packages interactively
npx skli link cursor owner/repo

# Optional: ignore installed IDE paths in git
npx skli install cursor skill owner/repo:skills/foo --gitignore
```

## Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `init` | Create `{project}/.skli/skli.json` and register the project | `skli init -y` |
| `add` | Reference a **local** skill/rule/agent in the project manifest (no copy) | `skli add cursor rule .cursor/rules/foo.mdc` |
| `install` | Install a skill/rule/agent from a local path or GitHub into IDE dirs | `skli install cursor skill owner/repo:skills/foo` |
| `link` | Link a remote ProjectManifest and deploy selected packages | `skli link cursor owner/repo --all` |
| `update` | Upgrade repos packages (and linked manifests) to a newer ref | `skli update --all` |
| `restore` | Re-fetch repos packages / links at the **pinned** version | `skli restore cursor skill foo` |
| `remove` | Uninstall packages from the manifest (and optionally disk) | `skli remove cursor skill foo` |
| `unlink` | Remove a whole link by `owner/repo` (or URL) | `skli unlink owner/repo` |

Common options:

| Option | Commands | Meaning |
|--------|----------|---------|
| `-g, --global` | `install`, `update`, `restore`, `remove` | Use `~/.skli/skli.json` and global IDE folders |
| `--gitignore` | `install`, `link`, `update` | Append project install destinations under `# Ignored AI IDE references` in `.gitignore` |
| `--version <ref>` | `update` | Pin a single package to an explicit ref |
| `--all` | `link`, `update`, `restore`, `remove` | Select all matching items (required for broad update/restore/remove) |
| `--debug` | most commands | Diagnostic logs on stderr |

Run `skli <command> --help` for full signatures.

### GitHub sources

Shorthand: `owner/repo[@ref][:path]` or an HTTPS blob URL.

```bash
skli install cursor skill owner/repo@v1.2.0:skills/my-skill
skli install cursor rule https://github.com/owner/repo/blob/main/rules/foo.mdc
skli link cursor owner/repo@main
```

### Scopes

- **Project** (default): `{cwd}/.skli/skli.json`, copies under the project IDE folders (e.g. `.cursor/`).
- **Global** (`--global`): `~/.skli/skli.json`, copies under the user IDE home (e.g. `~/.cursor/`).

`link` / `unlink` are project-scoped only.

## Configuration

| File | Path | Role |
|------|------|------|
| Project manifest | `{project}/.skli/skli.json` | Packages and links for the project |
| Global manifest | `~/.skli/skli.json` | Packages for the user profile |
| Project index | `~/.skli/projects.json` | Projects touched by the CLI |

Published schema: [`schemas/skli.project.schema.json`](schemas/skli.project.schema.json).

## Spec status

Product specs live under [`specs/`](specs/) ([index](specs/README.md)). Full user docs and mirrored specs: [zortracks.github.io/skli](https://zortracks.github.io/skli/).

| Feature | Status |
|---------|--------|
| [domain-glossary](specs/features/domain-glossary.md) | defined |
| [cli-core](specs/features/cli-core.md) | implemented |
| [config-manifests](specs/features/config-manifests.md) | implemented |
| [cmd-init](specs/features/cmd-init.md) | implemented |
| [cmd-install](specs/features/cmd-install.md) | implemented |
| [cmd-link](specs/features/cmd-link.md) | implemented |
| [cmd-add](specs/features/cmd-add.md) | implemented |
| [cmd-update](specs/features/cmd-update.md) | implemented |
| [cmd-restore](specs/features/cmd-restore.md) | implemented |
| [cmd-remove](specs/features/cmd-remove.md) | implemented |
| [cmd-unlink](specs/features/cmd-unlink.md) | implemented |
| [github-source](specs/features/github-source.md) | implemented |
| [ide-targets](specs/features/ide-targets.md) | implemented |

## Contributing

```bash
npm install
npm run build
npx skli --help
```

Docs site (local): `npm run docs:dev` after install.

GitHub Pages is built by [`.github/workflows/docs.yml`](.github/workflows/docs.yml) on push to `main`. One-time repo setting: **Settings → Pages → Source = GitHub Actions**.

### Release

1. GitHub Actions → **Bump version** → `patch` / `minor` / `major`.
2. Merge PR `release/vX.Y.Z` → `main`.
3. `tag-release` creates tag `vX.Y.Z`; `publish` releases to npm via Trusted Publishing (OIDC).

First-time npm: create the package if needed, then configure **Trusted Publisher** on npmjs.com for org/user `zortracks`, repo `skli`, workflow `publish.yml`.

## License

MIT — see [LICENSE](LICENSE).
