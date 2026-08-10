# Getting started

## Requirements

- **Node.js** 20 or newer
- For GitHub Sources: the [`gh`](https://cli.github.com/) CLI, authenticated (`gh auth login` or `GH_TOKEN`)

## Install

```bash
# One-off (recommended to try)
npx skli --help

# Global install
npm install -g skli
skli --help
```

## First project

```bash
cd your-project
npx skli init
```

This creates `{project}/.skli/skli.json` and registers the project in `~/.skli/projects.json`.

## Typical workflows

### Reference a local package

Use when the skill/rule/agent already lives in the repo and you only need it listed in the manifest:

```bash
npx skli add cursor rule .cursor/rules/my-rule.mdc
```

### Install from GitHub

Copies the package into IDE folders and records a `repos` entry:

```bash
npx skli install cursor skill owner/repo@v1:skills/foo
npx skli install cursor,claude skill owner/repo:skills/foo --gitignore
```

### Link a remote manifest

Pulls `.skli/skli.json` from another GitHub repo and lets you select which packages to deploy (stored under `links`, not as local Package map entries):

```bash
npx skli link cursor owner/repo
npx skli link cursor owner/repo --all --gitignore
```

### Keep packages current

```bash
npx skli update --all
npx skli restore --all          # re-fetch pinned versions
npx skli remove cursor skill foo
npx skli unlink owner/repo
```

## Next steps

- [Concepts](./concepts) — Package, Manifest, Link, Scope
- [Configuration](./configuration) — file locations
- [Commands](/commands/) — full CLI reference
