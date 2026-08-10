# skli

CLI to manage **skills**, **rules**, and **agents** for AI IDEs, like a package manager.

```bash
npx skli <command> [options]
```

## Vision

Install, reference, and version Packages (skills / rules / agents) at **project** or **user profile** scope, with optional deployment to the IDE folder (e.g. `~/.cursor`).

## Configuration

| File | Path | Role |
|------|------|------|
| Project manifest | `{project}/.skli/skli.json` | Packages installed in the project |
| Global manifest | `~/.skli/skli.json` | Packages for the user profile |
| Project index | `~/.skli/projects.json` | Projects touched by the CLI |

## Repository structure

| Path | Role |
|------|------|
| [`specs/`](specs/) | Product specifications ([`specs/README.md`](specs/README.md)) |
| [`schemas/`](schemas/) | Published JSON Schemas (ProjectManifest, …) |
| [`src/`](src/) | CLI source code (TypeScript) |

Neox configuration: [`.cursor/rules/neox-rules.json`](.cursor/rules/neox-rules.json).

## Development

```bash
npm install
npm run build
npx skli --help
npx skli init
npx skli add cursor rule .cursor/rules/specs-documentation.mdc
```

## Feature index

| Feature | Status | Description |
|---------|--------|-------------|
| [domain-glossary](specs/features/domain-glossary.md) | defined | Glossary — Skill, Rule, Agent, Manifest, Link, Scope, IdeId, InstallKind, VersioningMode |
| [cli-core](specs/features/cli-core.md) | implemented | npm package, `skli` bin, Commander, `npx skli` |
| [config-manifests](specs/features/config-manifests.md) | implemented | Schemas for `.skli` / `skli.json` / `projects.json` (incl. `links`) |
| [cmd-init](specs/features/cmd-init.md) | implemented | `init` — ProjectManifest + ProjectIndex |
| [cmd-install](specs/features/cmd-install.md) | defined | `install {ide} {kind} {source}` — skill/rule/agent; optional `--gitignore` |
| [cmd-link](specs/features/cmd-link.md) | implemented | `link {ide} {source}` — link remote ProjectManifest; select packages |
| [cmd-add](specs/features/cmd-add.md) | implemented | `add {ide} {kind} {path}` — reference Package in ProjectManifest |
| [cmd-update](specs/features/cmd-update.md) | implemented | `update` — upgrade repos Packages + linked manifests; path target; `--version`; `--gitignore` |
| [cmd-restore](specs/features/cmd-restore.md) | implemented | `restore` — re-fetch repos Packages / links at pinned version; path target |
| [cmd-remove](specs/features/cmd-remove.md) | implemented | `remove` — uninstall Packages; path target; `--keep-sources` / `--remove-sources` |
| [cmd-unlink](specs/features/cmd-unlink.md) | implemented | `unlink <id>` — remove a whole link by owner/repo or URL; optional `--keep-sources` |
| [github-source](specs/features/github-source.md) | implemented | GitHub Source parse + remote ProjectManifest via `gh` |
| [ide-targets](specs/features/ide-targets.md) | implemented | IdeId registry + primary rules/skills/agents install paths |
