# Domain glossary

| Field | Value |
|-------|--------|
| Slug | `domain-glossary` |
| Status | defined |
| Last review | 2026-08-10 |

## Summary

Terminological authority for skli. Every related feature must reuse these terms without redefining them.

## Entities

| Term | Definition |
|------|------------|
| **Skill** | Installable unit describing a capability or workflow for an AI IDE (skill file or folder). |
| **Rule** | Installable unit of persistent rules / guidance for an AI IDE. |
| **Agent** | Installable unit describing an agent (persona, tools, instructions) for an AI IDE. |
| **Package** | Generic term for Skill, Rule, or Agent when discussing installation without distinguishing type. |
| **Manifest** | `skli.json` file listing installed Packages and their versions for a given scope. |
| **ProjectManifest** | Manifest at `{project}/.skli/skli.json`, including project metadata (`name`, `description`, `versioning`, `tags`), Package maps, and optional `links`. |
| **GlobalManifest** | Manifest at `~/.skli/skli.json` (user profile) — Package maps only, no project metadata, no `links`. |
| **Link** | Project-scoped binding to a remote ProjectManifest (`owner/repo`) with a pinned version and per-kind selection (`includeAll` / `includes`). Linked packages are copied to IDE dirs but are **not** recorded as local Package map entries. |
| **LinkEntry** | One value under ProjectManifest `links` (key = `owner/repo`). |
| **ProjectIndex** | `~/.skli/projects.json` listing absolute paths of projects referenced by the CLI. |
| **Source** | Install origin: local path or GitHub Source (`owner/repo[@ref]:path` or URL) targeting a Package (or a repository containing one). |
| **PackageSourceOrigin** | Manifest field `source` on a Package entry: `local` (filesystem) or `repos` (GitHub repository). Distinct from the CLI Source argument. |
| **IDE home** | User-level configuration root of an AI IDE (e.g. `~/.cursor`, `~/.claude`) under which global Package dirs live. Concrete paths per IdeId: [`ide-targets`](ide-targets.md). |

## Enums

### Scope

| Value | Meaning |
|-------|---------|
| `project` | Install / reference relative to the current repository (`ProjectManifest`). |
| `global` | Install / reference to the user profile (`GlobalManifest`) and/or IDE home paths. |
| `ide` | Deploy into IDE-specific folders (project `.cursor/` / `.claude/` / … or global IDE home) — selected via the `install` `<ide>` argument. |

### IdeId

Supported AI IDE targets for install path resolution. Path layouts: [`ide-targets`](ide-targets.md).

| Value | Meaning |
|-------|---------|
| `cursor` | Cursor |
| `claude` | Claude Code |
| `codex` | OpenAI Codex |
| `copilot` | GitHub Copilot (VS Code / CLI) |
| `windsurf` | Windsurf (Cascade) |

Multi-select on CLI: comma-separated IdeId list (e.g. `cursor,claude`). IdeId itself has no special `all` value.

**CLI ide selector (update / restore / remove):** those commands also accept the literal argument `all` meaning “every IdeId” (no IDE filter). That token is a command-level selector, not a member of the IdeId enum — see [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md), and [`cmd-remove`](cmd-remove.md).

**CLI install-path (update / restore / remove):** a single filesystem path under a primary IdeId layout (e.g. `.cursor/skills/arcade-bootstrap`) may select one Package instead of `<ide> <kind> <id>`. Resolution: [`ide-targets`](ide-targets.md).

### PackageKind

| Value | Meaning |
|-------|---------|
| `skill` | Skill-type Package. |
| `rule` | Rule-type Package. |
| `agent` | Agent-type Package. |

### InstallKind

Selector for `skli install` — which Package kind to install from a Source. Same values as PackageKind (historical alias name in CLI docs).

| Value | Meaning |
|-------|---------|
| `skill` | Skill only. |
| `rule` | Rule only. |
| `agent` | Agent only. |

Multi-package install from a remote ProjectManifest is owned by [`cmd-link`](cmd-link.md), not `InstallKind`.

### VersioningMode

Versioning mode for a project (ProjectManifest metadata) or a Package entry (`versioning` field).

| Value | Meaning |
|-------|---------|
| `tag` | Versioning by git tags (default at project init and package install). On repos install, Package `version` is a tag (explicit Source tag if it exists, otherwise the repository’s latest tag). |
| `commit` | Versioning by commit SHA (repos install resolves Source ref to full SHA). |
| `branch` | Versioning by branch name. |
| `none` | No versioning policy (e.g. local `add`); repos install still records the resolved ref as `version`. |

### PackageSourceOrigin

| Value | Meaning |
|-------|---------|
| `local` | Package originates from a local filesystem path. |
| `repos` | Package originates from a GitHub repository. |

## Paths (canonical)

| Alias | Path |
|-------|------|
| ProjectManifest | `{project}/.skli/skli.json` |
| GlobalManifest | `~/.skli/skli.json` |
| ProjectIndex | `~/.skli/projects.json` |

`~` means the user home (`os.homedir()` / `%USERPROFILE%` on Windows).

## Out of scope

- File format details inside each IDE directory (frontmatter schemas) — see product docs; path registry in [`ide-targets`](ide-targets.md).
- Public Package catalog.

## Terminology

This file is the authority; other specs link here.
