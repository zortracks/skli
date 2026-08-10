# Concepts

Terminology matches the product glossary ([domain-glossary](/specs/features/domain-glossary)).

## Packages

| Term | Meaning |
|------|---------|
| **Skill** | Capability / workflow package for an AI IDE (file or folder). |
| **Rule** | Persistent guidance package. |
| **Agent** | Agent persona / tools / instructions package. |
| **Package** | Generic term for Skill, Rule, or Agent. |

Kinds on the CLI: `skill` | `rule` | `agent`.

## Manifests and links

| Term | Meaning |
|------|---------|
| **ProjectManifest** | `{project}/.skli/skli.json` — metadata, Package maps, optional `links`. |
| **GlobalManifest** | `~/.skli/skli.json` — Package maps only (no `links`). |
| **Link** | Project-scoped binding to a remote ProjectManifest (`owner/repo`) with a pinned version and selection. Linked packages are copied to IDE dirs but are **not** dual-written into local Package maps. |
| **ProjectIndex** | `~/.skli/projects.json` — absolute paths of projects the CLI has touched. |

## Origins

| `source` on a Package entry | Meaning |
|-----------------------------|---------|
| `local` | Filesystem path (from `add` or local `install`). |
| `repos` | GitHub repository (from GitHub `install`). |

## Scope

| Scope | How |
|-------|-----|
| **project** | Default — ProjectManifest and project-relative IDE folders (e.g. `.cursor/`). |
| **global** | `--global` — GlobalManifest and IDE home under `~` (e.g. `~/.cursor/`). |

`link` / `unlink` are always project-scoped.

## Versioning

`VersioningMode`: `tag` (default) | `commit` | `branch` | `none`.

On GitHub install with `tag`, the pinned `version` is a git tag (explicit Source tag if it exists, otherwise the latest tag).

## IdeId

Supported targets: `cursor`, `claude`, `codex`, `copilot`, `windsurf`.

Pass one or more as a CSV: `cursor,claude`. See [IDE targets](./ide-targets).
