# GitHub Source via gh

| Field | Value |
|-------|--------|
| Slug | `github-source` |
| Status | implemented |
| Last review | 2026-08-10 |

## Summary

Resolve a GitHub **Source** (owner, repo, optional ref) and read remotely via the system **`gh`** CLI, reusing user credentials (`gh auth login` / `GH_TOKEN`). Used to detect/fetch a remote ProjectManifest `.skli/skli.json` at the repository root (at a given ref or on the default branch), and to download Package paths for install / link / refresh.

**Note:** `gh api` rejects anonymous calls (including for public repos); an authenticated `gh` session is always required.

## User flows

### Flow-01 — Parse GitHub Source

**Persona:** skli CLI.  
**Preconditions:** `source` string provided.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | Parse `source` | `{ owner, repo, ref?, path? }` if GitHub form recognized; otherwise `null` (local path / non-GitHub) | Malformed GitHub form → parse error |

### Flow-02 — Probe / fetch remote ProjectManifest

**Persona:** developer / CLI.  
**Preconditions:** GitHub Source parsed; `gh` installed and authenticated.

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | Check `gh` installed | OK | `gh` missing → message to install GitHub CLI |
| 2 | `gh auth status` | Valid session | Not authenticated → invite `gh auth login` / `GH_TOKEN` |
| 3 | `gh api` contents `.skli/skli.json` (+ `?ref=` if ref) | HTTP 200 → present (existence probe or download+parse) | 404 → absent; 401/403 → permissions / auth |

### Flow-03 — Debug

| Step | Action | Expected result | Error |
|------|--------|-----------------|-------|
| 1 | `--debug` option active | stderr logs: `gh` command, owner/repo/ref, HTTP status, raw stderr | — |

## Data model

No persistence. In-memory resolved structure:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `owner` | string | yes | GitHub owner |
| `repo` | string | yes | Repository name (without `.git`) |
| `ref` | string | no | Branch, tag, or commit; absent ⇒ repository default branch |
| `path` | string | no | Package path inside the repo (`owner/repo@ref:path` or `owner/repo:path`) |

## CLI

Options consumed by commands that use this feature (e.g. `install`, `link`):

```
--debug      Diagnostic logs (stderr)
```

Accepted GitHub Source formats:

| Form | Example | `ref` / `path` |
|------|---------|----------------|
| shorthand | `owner/repo` | default / — |
| shorthand + `@ref` | `owner/repo@v1.2.0` | ref / — |
| shorthand + path | `owner/repo:skills/foo` | default / `skills/foo` |
| shorthand + `@ref:path` | `owner/repo@main:skills/foo` | `main` / `skills/foo` |
| HTTPS | `https://github.com/owner/repo` (+ `.git`) | default / — |
| HTTPS + `@ref` | `https://github.com/owner/repo@main` | ref / — |
| HTTPS tree | `https://github.com/owner/repo/tree/feature/x` | `feature/x` / — (entire remainder is `ref`; package path via shorthand or blob URL) |
| HTTPS blob | `https://github.com/owner/repo/blob/main/skills/foo/SKILL.md` | `main` / `skills/foo` (first segment after `blob` = ref; trailing `SKILL.md` stripped) |
| HTTPS commit | `https://github.com/owner/repo/commit/<sha>` | sha / — |
| HTTPS tag | `https://github.com/owner/repo/releases/tag/v1.0.0` | `v1.0.0` / — |
| SSH | `git@github.com:owner/repo.git` (+ optional `@ref` / `:path`) | default or ref / optional path |

For Package install, `path` is **required** (CLI enforces). For ProjectManifest fetch / link, `path` is ignored; the API targets repo-root `.skli/skli.json`.

API:

```
gh api repos/{owner}/{repo}/contents/.skli/skli.json
gh api repos/{owner}/{repo}/contents/.skli/skli.json?ref={ref}
```

## Business rules

| Id | Rule |
|----|------|
| BR-github-source-001 | Runtime: system `gh` binary via process; no npm `gh` dependency. |
| BR-github-source-002 | No credentials stored by skli; user session only. |
| BR-github-source-003 | Before any `gh api` call: `gh auth status` required; fail if not authenticated (`gh auth login` / `GH_TOKEN`). |
| BR-github-source-004 | `gh api` does not accept anonymous; 401/403 ⇒ permissions / auth message (no dedicated flag). |
| BR-github-source-005 | Missing `ref` ⇒ omit API `ref` parameter (GitHub default branch). |
| BR-github-source-006 | Remote ProjectManifest is always `.skli/skli.json` at the repository **root**; Package `path` is ignored for probe/fetch. |
| BR-github-source-009 | Shorthand Package path: `owner/repo[@ref]:path` — first `:` after optional `@ref` starts `path`. |
| BR-github-source-010 | HTTPS `/blob/<ref>/<path…>`: first path segment after `blob` is `ref` (single-segment); remainder is Package `path`. Multi-segment refs use shorthand. |
| BR-github-source-011 | Trailing `SKILL.md` on a Package `path` (any GitHub form) is stripped so the skill directory is the Package root. |
| BR-github-source-007 | HTTP 200 = manifest present; HTTP 404 = absent. |
| BR-github-source-008 | `--debug`: diagnostic logs on stderr only. |
| BR-github-source-012 | Fetch+parse helper returns a ProjectManifest / SkliManifest for consumers (`link`, `update`/`restore` links, `unlink`). |

## User scenarios

After `gh auth login`: `npx @zortracks/skli link cursor owner/repo@main --all --debug` fetches the remote ProjectManifest at ref `main` and links selected packages.

## Dependencies

- [`domain-glossary`](domain-glossary.md) — Source, ProjectManifest.
- [`cmd-install`](cmd-install.md), [`cmd-link`](cmd-link.md), [`cmd-update`](cmd-update.md), [`cmd-restore`](cmd-restore.md), [`cmd-unlink`](cmd-unlink.md) — consumers.

## Out of scope

- Clone / sparse-checkout / archive download.
- Full archive / sparse-clone strategies beyond `gh api` contents download (used by install).
- Octokit / token stored in skli Manifests.
- Anonymous REST fallback (`curl` / `fetch`) without `gh`.
- Local paths (filesystem) — outside this feature.

## Acceptance criteria

- [x] Parse shorthand, HTTPS (tree/blob/commit/tag/@ref), SSH (+ `@ref`) formats.
- [x] Parse `owner/repo@ref:path` / `owner/repo:path` into `path`.
- [x] HTTPS blob URLs resolve `ref` + `path`; trailing `SKILL.md` stripped from `path`.
- [x] `ensureGhInstalled` / `ensureGhAuthenticated` / contents probe via `gh api`.
- [x] Fetch+parse remote ProjectManifest helper for link / refresh / unlink.
- [x] Missing auth ⇒ clear failure before probe (`gh auth login` / `GH_TOKEN`).
- [x] 401/403 ⇒ permissions / auth message, without `--private` flag.
- [x] `--debug` logs owner/repo/ref and HTTP status.

## Terminology

See [`domain-glossary`](domain-glossary.md). Concrete GitHub Source formats are defined here; the **Source** term stays in the glossary.

## Implementation notes

- `src/lib/github-source.ts` — parse.
- `src/lib/gh.ts` — spawn `gh`, auth, API contents, remote ProjectManifest fetch.
