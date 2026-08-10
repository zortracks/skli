# Configuration

## Files

| File | Path | Role |
|------|------|------|
| Project manifest | `{project}/.skli/skli.json` | Packages and links for the current project |
| Global manifest | `~/.skli/skli.json` | Packages for the user profile |
| Project index | `~/.skli/projects.json` | Absolute paths of projects touched by skli |

`~` is the user home (`os.homedir()` / `%USERPROFILE%` on Windows).

## Project vs global

Most commands default to the **project** manifest under the current working directory. Pass `-g` / `--global` to use the global manifest and global IDE install paths.

Commands that only work on the project: `init`, `add`, `link`, `unlink`.

## Gitignore section

With `--gitignore` (`install`, `link`, `update`), skli appends project-relative install destinations under:

```
# Ignored AI IDE references
```

Legacy header `# Ignored AI IDEs références` is still recognized when reading. The flag is project-scoped only (errors with `--global`).

## Schema

See [Project schema](/reference/schema) for the published JSON Schema of the ProjectManifest.
