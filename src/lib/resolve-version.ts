import { ghApi, ghGraphql, type GhOptions } from "./gh.js";
import { resolveDefaultBranch } from "./fetch-github-path.js";
import type { VersioningMode } from "./manifests.js";

function debugLog(debug: boolean | undefined, message: string): void {
  if (debug) {
    console.error(`[skli debug] ${message}`);
  }
}

function tagRefApiPath(owner: string, repo: string, tag: string): string {
  const encodedTag = tag
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/tags/${encodedTag}`;
}

/** True if `ref` is an existing git tag on the repository. */
export function isGitTag(
  owner: string,
  repo: string,
  ref: string,
  opts?: GhOptions,
): boolean {
  const result = ghApi(tagRefApiPath(owner, repo, ref), opts);
  return result.httpStatus === 200;
}

/** Latest tag by tag-commit date (GraphQL TAG_COMMIT_DATE DESC). */
export function resolveLatestTag(
  owner: string,
  repo: string,
  opts?: GhOptions,
): string {
  const query =
    "query($owner:String!,$name:String!){repository(owner:$owner,name:$name){refs(refPrefix:\"refs/tags/\",first:1,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){nodes{name}}}}";

  const result = ghGraphql(query, { owner, name: repo }, opts);
  if (result.exitCode !== 0 && result.httpStatus !== 200) {
    throw new Error(
      `Failed to list tags for ${owner}/${repo}` +
        (result.stderr.trim() ? `: ${result.stderr.trim()}` : "."),
    );
  }

  let body: {
    data?: {
      repository?: { refs?: { nodes?: Array<{ name?: string }> } } | null;
    };
    errors?: Array<{ message?: string }>;
  };
  try {
    body = JSON.parse(result.stdout) as typeof body;
  } catch {
    throw new Error(`Failed to parse tags response for ${owner}/${repo}.`);
  }

  if (body.errors?.length) {
    throw new Error(
      `Failed to list tags for ${owner}/${repo}: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }

  if (!body.data?.repository) {
    throw new Error(`Repository not found: ${owner}/${repo}`);
  }

  const name = body.data.repository.refs?.nodes?.[0]?.name;
  if (!name) {
    throw new Error(
      `Error: no git tags found on ${owner}/${repo}. Cannot install with --versioning tag.`,
    );
  }

  debugLog(opts?.debug, `latest tag ${owner}/${repo}=${name}`);
  return name;
}

export function resolveCommitSha(
  owner: string,
  repo: string,
  ref: string,
  opts?: GhOptions,
): string {
  const apiPath = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`;
  const result = ghApi(apiPath, opts);
  if (result.httpStatus !== 200) {
    throw new Error(
      `Failed to resolve commit for ${owner}/${repo}@${ref}` +
        (result.stderr.trim() ? `: ${result.stderr.trim()}` : "."),
    );
  }
  const body = JSON.parse(result.stdout) as { sha?: string };
  if (!body.sha) {
    throw new Error(`No sha in commits response for ${owner}/${repo}@${ref}`);
  }
  return body.sha;
}

export type ResolvedInstallRef = {
  fetchRef: string;
  version: string;
};

/**
 * Resolve fetch ref and Manifest `version` from VersioningMode + optional source ref.
 */
export async function resolveInstallRef(options: {
  owner: string;
  repo: string;
  sourceRef?: string;
  versioning: VersioningMode;
  debug?: boolean;
}): Promise<ResolvedInstallRef> {
  const opts: GhOptions = { debug: options.debug };
  const { owner, repo, sourceRef, versioning } = options;

  debugLog(
    options.debug,
    `resolveInstallRef versioning=${versioning} sourceRef=${sourceRef ?? "(none)"}`,
  );

  switch (versioning) {
    case "tag": {
      if (sourceRef && isGitTag(owner, repo, sourceRef, opts)) {
        debugLog(options.debug, `using explicit tag ${sourceRef}`);
        return { fetchRef: sourceRef, version: sourceRef };
      }
      const latest = resolveLatestTag(owner, repo, opts);
      return { fetchRef: latest, version: latest };
    }
    case "branch": {
      const branch =
        sourceRef ?? (await resolveDefaultBranch(owner, repo, opts));
      return { fetchRef: branch, version: branch };
    }
    case "commit": {
      const base =
        sourceRef ?? (await resolveDefaultBranch(owner, repo, opts));
      const sha = resolveCommitSha(owner, repo, base, opts);
      return { fetchRef: sha, version: sha };
    }
    case "none": {
      const ref =
        sourceRef ?? (await resolveDefaultBranch(owner, repo, opts));
      return { fetchRef: ref, version: ref };
    }
    default: {
      const _exhaustive: never = versioning;
      throw new Error(`Unsupported versioning: ${_exhaustive}`);
    }
  }
}
