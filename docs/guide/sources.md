# GitHub sources

Remote installs and links use the system **`gh`** CLI (authenticated session required — including for public repos).

## Formats

| Form | Example |
|------|---------|
| shorthand | `owner/repo` |
| shorthand + `@ref` | `owner/repo@v1.2.0` |
| shorthand + path | `owner/repo:skills/foo` |
| shorthand + `@ref:path` | `owner/repo@main:skills/foo` |
| HTTPS | `https://github.com/owner/repo` |
| HTTPS blob | `https://github.com/owner/repo/blob/main/skills/foo/SKILL.md` |
| HTTPS tree / commit / tag / SSH | See [github-source](/specs/features/github-source) |

For **`install`**, a Package `path` is required (`:path` or blob URL).  
For **`link`**, any Package `:path` is ignored; skli fetches repo-root `.skli/skli.json`.

## Auth

```bash
gh auth login
# or
export GH_TOKEN=...
```

If `gh` is missing or not authenticated, commands that need GitHub fail with a clear message.

## Debug

Pass `--debug` on install / link / update / restore / … to log `gh` invocations and HTTP status on stderr.
