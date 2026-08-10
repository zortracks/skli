export type GitHubSource = {
  owner: string;
  repo: string;
  ref?: string;
  /** Package path inside the repository (from `owner/repo@ref:path`). */
  path?: string;
};

function stripGitSuffix(repo: string): string {
  return repo.replace(/\.git$/i, "");
}

function isLocalPath(source: string): boolean {
  if (
    source.startsWith(".") ||
    source.startsWith("/") ||
    source.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(source)
  ) {
    return true;
  }
  if (source.includes("\\")) {
    return true;
  }
  return false;
}

function splitRefAndPath(afterAt: string): { ref?: string; path?: string } {
  const colonIdx = afterAt.indexOf(":");
  if (colonIdx === -1) {
    return { ref: afterAt || undefined };
  }
  const ref = afterAt.slice(0, colonIdx);
  const pathPart = afterAt.slice(colonIdx + 1);
  return {
    ref: ref || undefined,
    path: pathPart || undefined,
  };
}

/** Strip trailing SKILL.md so blob links resolve to the skill directory. */
function normalizePackagePath(pkgPath: string | undefined): string | undefined {
  if (!pkgPath) {
    return undefined;
  }
  const trimmed = pkgPath.replace(/\/+$/, "");
  if (!trimmed) {
    return undefined;
  }
  if (/^SKILL\.md$/i.test(trimmed)) {
    return undefined;
  }
  if (/\/SKILL\.md$/i.test(trimmed)) {
    const parent = trimmed.replace(/\/SKILL\.md$/i, "");
    return parent || undefined;
  }
  return trimmed;
}

function withNormalizedPath(source: GitHubSource): GitHubSource {
  const path = normalizePackagePath(source.path);
  if (path === source.path) {
    return source;
  }
  return { ...source, path };
}

function parseHttpsGitHub(url: string): GitHubSource | null {
  const rest = url.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
  if (!rest) {
    return null;
  }

  const hasTree = rest.includes("/tree/");
  const hasBlob = rest.includes("/blob/");
  const hasCommit = /\/commit\//i.test(rest);
  const hasReleaseTag = /\/releases\/tag\//i.test(rest);

  if (
    !hasTree &&
    !hasBlob &&
    !hasCommit &&
    !hasReleaseTag &&
    rest.includes("@")
  ) {
    const atIdx = rest.lastIndexOf("@");
    const before = rest.slice(0, atIdx);
    const afterAt = rest.slice(atIdx + 1);
    const parts = before.split("/").filter(Boolean);
    if (parts.length !== 2 || !afterAt) {
      return null;
    }
    const { ref, path: pkgPath } = splitRefAndPath(afterAt);
    return withNormalizedPath({
      owner: parts[0],
      repo: stripGitSuffix(parts[1]),
      ref,
      path: pkgPath,
    });
  }

  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const owner = parts[0];
  const repo = stripGitSuffix(parts[1]);
  if (!owner || !repo) {
    return null;
  }

  if (parts.length === 2) {
    return { owner, repo };
  }

  const kind = parts[2];
  if (kind === "blob" && parts.length >= 5) {
    // First segment after blob is ref (single-segment). Multi-segment refs: use shorthand.
    const ref = parts[3];
    const pkgPath = parts.slice(4).join("/");
    if (!ref || !pkgPath) {
      return null;
    }
    return withNormalizedPath({ owner, repo, ref, path: pkgPath });
  }
  if (kind === "tree" && parts.length >= 4) {
    // Full remainder is ref (branches may contain '/'). Use blob URL or shorthand :path for packages.
    return { owner, repo, ref: parts.slice(3).join("/") };
  }
  if (kind === "commit" && parts.length >= 4) {
    return { owner, repo, ref: parts[3] };
  }
  if (kind === "releases" && parts[3] === "tag" && parts.length >= 5) {
    return { owner, repo, ref: parts.slice(4).join("/") };
  }

  return null;
}

function parseShorthand(trimmed: string): GitHubSource | null {
  const m = trimmed.match(
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?(.*)$/,
  );
  if (!m) {
    return null;
  }
  const owner = m[1];
  const repo = stripGitSuffix(m[2]);
  const suffix = m[3] ?? "";

  if (!suffix) {
    return { owner, repo };
  }

  if (suffix.startsWith("@")) {
    const { ref, path: pkgPath } = splitRefAndPath(suffix.slice(1));
    if (!ref && !pkgPath) {
      return null;
    }
    return { owner, repo, ref, path: pkgPath };
  }

  if (suffix.startsWith(":")) {
    const pkgPath = suffix.slice(1);
    if (!pkgPath) {
      return null;
    }
    return { owner, repo, path: pkgPath };
  }

  return null;
}

/**
 * Parse a GitHub Source string into owner/repo/ref/path.
 * Returns null for local paths or unrecognized non-GitHub inputs.
 */
export function parseGitHubSource(source: string): GitHubSource | null {
  const trimmed = source.trim();
  if (!trimmed || isLocalPath(trimmed)) {
    return null;
  }

  const sshMatch = trimmed.match(
    /^git@github\.com:([^/]+)\/([^@:]+?)(?:\.git)?(?:@([^:]+))?(?::(.+))?$/i,
  );
  if (sshMatch) {
    return withNormalizedPath({
      owner: sshMatch[1],
      repo: stripGitSuffix(sshMatch[2]),
      ref: sshMatch[3] || undefined,
      path: sshMatch[4] || undefined,
    });
  }

  if (/^https?:\/\/github\.com\//i.test(trimmed)) {
    return parseHttpsGitHub(trimmed);
  }

  if (trimmed.includes("://")) {
    return null;
  }

  const shorthand = parseShorthand(trimmed);
  return shorthand ? withNormalizedPath(shorthand) : null;
}
