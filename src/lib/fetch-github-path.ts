import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ghApi, type GhOptions } from "./gh.js";

type ContentItem = {
  type: string;
  name: string;
  path: string;
  content?: string;
  encoding?: string;
  download_url?: string | null;
};

function contentsApiPath(
  owner: string,
  repo: string,
  filePath: string,
  ref?: string,
): string {
  const encodedPath = filePath
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
  let apiPath = `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
  if (ref) {
    apiPath += `?ref=${encodeURIComponent(ref)}`;
  }
  return apiPath;
}

function parseContentsPayload(stdout: string): ContentItem | ContentItem[] {
  return JSON.parse(stdout) as ContentItem | ContentItem[];
}

async function writeFileFromContent(
  destFile: string,
  item: ContentItem,
): Promise<void> {
  await fs.mkdir(path.dirname(destFile), { recursive: true });
  if (item.encoding === "base64" && item.content) {
    const buf = Buffer.from(item.content.replace(/\n/g, ""), "base64");
    await fs.writeFile(destFile, buf);
    return;
  }
  throw new Error(`Unsupported file encoding for ${item.path}`);
}

async function downloadContents(
  owner: string,
  repo: string,
  remotePath: string,
  destRoot: string,
  ref: string | undefined,
  opts?: GhOptions,
): Promise<void> {
  const result = ghApi(contentsApiPath(owner, repo, remotePath, ref), opts);
  if (result.httpStatus === 404) {
    throw new Error(
      `GitHub path not found: ${owner}/${repo}:${remotePath}` +
        (ref ? `@${ref}` : ""),
    );
  }
  if (result.httpStatus !== 200) {
    throw new Error(
      `Failed to fetch ${owner}/${repo}:${remotePath}` +
        (result.stderr.trim() ? `: ${result.stderr.trim()}` : "."),
    );
  }

  const payload = parseContentsPayload(result.stdout);

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const childDest = path.join(destRoot, item.name);
      if (item.type === "dir") {
        await fs.mkdir(childDest, { recursive: true });
        await downloadContents(owner, repo, item.path, childDest, ref, opts);
      } else if (item.type === "file") {
        const fileResult = ghApi(
          contentsApiPath(owner, repo, item.path, ref),
          opts,
        );
        if (fileResult.httpStatus !== 200) {
          throw new Error(`Failed to download file ${item.path}`);
        }
        const fileItem = parseContentsPayload(fileResult.stdout) as ContentItem;
        await writeFileFromContent(childDest, fileItem);
      }
    }
    return;
  }

  if (payload.type === "file") {
    const base = path.basename(payload.name);
    await writeFileFromContent(path.join(destRoot, base), payload);
    return;
  }

  throw new Error(`Unexpected GitHub contents type for ${remotePath}`);
}

export async function resolveDefaultBranch(
  owner: string,
  repo: string,
  opts?: GhOptions,
): Promise<string> {
  const result = ghApi(
    `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    opts,
  );
  if (result.httpStatus !== 200) {
    throw new Error(
      `Failed to resolve default branch for ${owner}/${repo}` +
        (result.stderr.trim() ? `: ${result.stderr.trim()}` : "."),
    );
  }
  const body = JSON.parse(result.stdout) as { default_branch?: string };
  if (!body.default_branch) {
    throw new Error(`No default_branch for ${owner}/${repo}`);
  }
  return body.default_branch;
}

/**
 * Download a file or directory from GitHub into a fresh temp directory.
 * Returns the temp root and the local path of the downloaded package root.
 */
export async function fetchGitHubPathToTemp(options: {
  owner: string;
  repo: string;
  remotePath: string;
  ref?: string;
  debug?: boolean;
}): Promise<{ tempDir: string; localPath: string; resolvedRef: string }> {
  const ghOpts: GhOptions = { debug: options.debug };
  const resolvedRef =
    options.ref ??
    (await resolveDefaultBranch(options.owner, options.repo, ghOpts));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skli-fetch-"));
  const destRoot = path.join(tempDir, "pkg");
  await fs.mkdir(destRoot, { recursive: true });

  await downloadContents(
    options.owner,
    options.repo,
    options.remotePath.replace(/^\/+/, ""),
    destRoot,
    resolvedRef,
    ghOpts,
  );

  const entries = await fs.readdir(destRoot);
  if (entries.length === 1) {
    return {
      tempDir,
      localPath: path.join(destRoot, entries[0]),
      resolvedRef,
    };
  }
  return { tempDir, localPath: destRoot, resolvedRef };
}
