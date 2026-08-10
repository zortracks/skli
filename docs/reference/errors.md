# Errors and exit codes

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (also `init` cancel after declining parent-git confirmation) |
| `≠ 0` | Error — message on stderr; with `--debug`, extra diagnostics |

## Common failures

| Situation | Typical fix |
|-----------|-------------|
| Missing ProjectManifest | Run `skli init` |
| Package id already installed | Use `skli restore` / `skli update`, or `skli remove` first |
| `gh` missing or not authenticated | Install GitHub CLI; `gh auth login` or set `GH_TOKEN` |
| Unknown IdeId | Use `cursor`, `claude`, `codex`, `copilot`, `windsurf` |
| `--gitignore` with `--global` | Drop one of the flags (gitignore is project-only) |
| Invalid selection on update/restore/remove | Provide `--all`, or `<kind> <id>`, or an install path — not mixed invalidly |
| Local package targeted by update/restore | Only `source=repos` packages refresh; remove/re-add local instead |
| GitHub install without `:path` | Add a package path: `owner/repo:skills/foo` or a blob URL |

Command-specific rules live under each [command page](/commands/) and the mirrored [specs](/specs/).
