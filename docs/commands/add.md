# add

Reference a **local** Package in the ProjectManifest without copying files.

```
skli add <ide> <kind> <path>
```

## Arguments

| Argument | Description |
|----------|-------------|
| `ide` | IdeId: `cursor` \| `claude` \| `codex` \| `copilot` \| `windsurf` |
| `kind` | `skill` \| `rule` \| `agent` |
| `path` | Local Package path (file or directory; must exist) |

## Examples

```bash
npx @zortracks/skli add cursor rule .cursor/rules/specs-documentation.mdc
npx @zortracks/skli add cursor skill .cursor/skills/my-skill
```

## Behavior

- Project scope only; ProjectManifest must already exist (`skli init`).
- Id = basename of `path` without extension.
- Entry uses `source=local` and `versioning=none`.
- Does not deploy/copy into IDE dirs (path is the source of truth on disk).

Product spec: [cmd-add](/specs/features/cmd-add).
