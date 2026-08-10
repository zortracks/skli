import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import type { ProjectManifest } from "./manifests.js";

export type GhOptions = {
  debug?: boolean;
};

function debugLog(debug: boolean | undefined, message: string): void {
  if (debug) {
    console.error(`[skli debug] ${message}`);
  }
}

function runGh(
  args: string[],
  opts?: GhOptions,
): SpawnSyncReturns<string> {
  debugLog(opts?.debug, `gh ${args.join(" ")}`);
  return spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function missingGhError(result: SpawnSyncReturns<string>): Error | null {
  if (result.error) {
    const err = result.error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return new Error(
        "GitHub CLI (gh) is not installed or not on PATH. Install it from https://cli.github.com/",
      );
    }
    return new Error(`Failed to run gh: ${err.message}`);
  }
  return null;
}

export function ensureGhInstalled(opts?: GhOptions): void {
  const result = runGh(["--version"], opts);
  const missing = missingGhError(result);
  if (missing) {
    throw missing;
  }
  if (result.status !== 0) {
    throw new Error(
      `GitHub CLI (gh) is not available (${result.stderr.trim() || "unknown error"}).`,
    );
  }
  debugLog(opts?.debug, (result.stdout || "").trim().split("\n")[0] ?? "gh ok");
}

export function ensureGhAuthenticated(opts?: GhOptions): void {
  const result = runGh(["auth", "status"], opts);
  const missing = missingGhError(result);
  if (missing) {
    throw missing;
  }
  debugLog(
    opts?.debug,
    `gh auth status exit=${result.status} stderr=${(result.stderr || "").trim()}`,
  );
  if (result.status !== 0) {
    throw new Error(
      "GitHub CLI is not authenticated. Run: gh auth login (or set GH_TOKEN).",
    );
  }
}

export type GhApiResult = {
  httpStatus: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

function toGhApiResult(
  result: SpawnSyncReturns<string>,
  opts?: GhOptions,
): GhApiResult {
  const missing = missingGhError(result);
  if (missing) {
    throw missing;
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stderr}\n${stdout}`;
  const statusMatch = combined.match(/\(HTTP\s+(\d+)\)/i);
  let httpStatus = statusMatch ? Number(statusMatch[1]) : 0;
  if (!httpStatus && result.status === 0) {
    httpStatus = 200;
  }

  debugLog(
    opts?.debug,
    `gh api status=${httpStatus} exit=${result.status} stderr=${stderr.trim()}`,
  );

  return {
    httpStatus,
    stdout,
    stderr,
    exitCode: result.status,
  };
}

export function ghApi(apiPath: string, opts?: GhOptions): GhApiResult {
  return toGhApiResult(runGh(["api", apiPath], opts), opts);
}

/** Run a GitHub GraphQL query via `gh api graphql`. */
export function ghGraphql(
  query: string,
  variables: Record<string, string>,
  opts?: GhOptions,
): GhApiResult {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-f", `${key}=${value}`);
  }
  return toGhApiResult(runGh(args, opts), opts);
}

function projectManifestContentsApiPath(
  owner: string,
  repo: string,
  ref: string | undefined,
): string {
  let apiPath = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/.skli/skli.json`;
  if (ref) {
    apiPath += `?ref=${encodeURIComponent(ref)}`;
  }
  return apiPath;
}

function throwGhHttpError(
  owner: string,
  repo: string,
  result: GhApiResult,
): never {
  if (result.httpStatus === 401 || result.httpStatus === 403) {
    throw new Error(
      `GitHub API returned HTTP ${result.httpStatus} for ${owner}/${repo}. ` +
        "Check access permissions, or run: gh auth login (or set GH_TOKEN).",
    );
  }

  const stderr = result.stderr.trim();
  const needsAuth =
    /gh auth login/i.test(stderr) || /GH_TOKEN/i.test(stderr);
  if (needsAuth) {
    throw new Error(
      "GitHub CLI is not authenticated. Run: gh auth login (or set GH_TOKEN).",
    );
  }

  if (result.httpStatus > 0) {
    throw new Error(
      `GitHub API returned HTTP ${result.httpStatus} for ${owner}/${repo}` +
        (stderr ? `: ${stderr}` : "."),
    );
  }
  throw new Error(
    `GitHub API request failed for ${owner}/${repo}` +
      (stderr ? `: ${stderr}` : "."),
  );
}

export function remoteProjectManifestExists(
  owner: string,
  repo: string,
  ref: string | undefined,
  opts?: GhOptions,
): { exists: boolean; httpStatus: number } {
  debugLog(
    opts?.debug,
    `probe ProjectManifest owner=${owner} repo=${repo} ref=${ref ?? "(default branch)"}`,
  );

  const result = ghApi(projectManifestContentsApiPath(owner, repo, ref), opts);

  if (result.httpStatus === 200) {
    return { exists: true, httpStatus: 200 };
  }
  if (result.httpStatus === 404) {
    return { exists: false, httpStatus: 404 };
  }
  throwGhHttpError(owner, repo, result);
}

/**
 * Download and parse remote `{repo}/.skli/skli.json` at optional ref
 * (default branch when ref omitted).
 */
export function fetchRemoteProjectManifest(
  owner: string,
  repo: string,
  ref: string | undefined,
  opts?: GhOptions,
): { manifest: ProjectManifest; httpStatus: number } {
  debugLog(
    opts?.debug,
    `fetch ProjectManifest owner=${owner} repo=${repo} ref=${ref ?? "(default branch)"}`,
  );

  const result = ghApi(projectManifestContentsApiPath(owner, repo, ref), opts);

  if (result.httpStatus === 404) {
    throw new Error(
      `No ProjectManifest (.skli/skli.json) found in ${owner}/${repo}` +
        (ref ? ` @${ref}` : " (default branch)") +
        ".",
    );
  }
  if (result.httpStatus !== 200) {
    throwGhHttpError(owner, repo, result);
  }

  const payload = JSON.parse(result.stdout) as {
    type?: string;
    encoding?: string;
    content?: string;
  };

  if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content) {
    throw new Error(
      `Unexpected GitHub contents payload for ${owner}/${repo}/.skli/skli.json`,
    );
  }

  const raw = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString(
    "utf8",
  );
  const manifest = JSON.parse(raw) as ProjectManifest;
  return { manifest, httpStatus: 200 };
}
