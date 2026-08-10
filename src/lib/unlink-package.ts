import fs from "node:fs/promises";
import { packageDestination } from "./copy-package.js";
import {
  ensureGhAuthenticated,
  ensureGhInstalled,
  fetchRemoteProjectManifest,
  type GhOptions,
} from "./gh.js";
import { parseGitHubSource } from "./github-source.js";
import { resolveInstallDirs, type IdeId } from "./ide-targets.js";
import {
  packageMapForKind,
  resolveIdsFromSelection,
} from "./link-package.js";
import {
  addProjectToIndex,
  getPackageEntry,
  getProjectLinks,
  PACKAGE_KINDS,
  projectManifestExists,
  readProjectManifest,
  writeProjectManifest,
  type LinkEntry,
  type PackageEntry,
  type PackageKind,
  type ProjectManifest,
} from "./manifests.js";

export type UnlinkOptions = {
  /** Raw CLI id: owner/repo or GitHub Source. */
  id: string;
  projectRoot: string;
  debug?: boolean;
  keepSources?: boolean;
};

export type UnlinkItemResult = {
  kind: PackageKind;
  id: string;
  removedIdes: IdeId[];
  deletedPaths: string[];
};

export type UnlinkRunResult = {
  linkKey: string;
  results: UnlinkItemResult[];
  keptSources: boolean;
};

function debugLog(debug: boolean | undefined, message: string): void {
  if (debug) {
    console.error(`[skli debug] ${message}`);
  }
}

/** Resolve CLI id to links map key `owner/repo`. */
export function resolveLinkKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Error: link id must not be empty.");
  }

  const github = parseGitHubSource(trimmed);
  if (github) {
    return `${github.owner}/${github.repo}`;
  }

  // Plain owner/repo (no URL) — parseGitHubSource already accepts shorthand;
  // if it returned null, reject.
  throw new Error(
    `Error: invalid link id "${raw}". Expected owner/repo or a GitHub URL.`,
  );
}

async function rmForce(target: string, debug?: boolean): Promise<boolean> {
  try {
    await fs.rm(target, { recursive: true, force: true });
    debugLog(debug, `removed ${target}`);
    return true;
  } catch (err) {
    debugLog(
      debug,
      `rm failed ${target}: ${err instanceof Error ? err.message : err}`,
    );
    return false;
  }
}

function collectLinkPackages(
  link: LinkEntry,
  remoteManifest: ProjectManifest,
): Array<{ kind: PackageKind; id: string; entry: PackageEntry }> {
  const out: Array<{ kind: PackageKind; id: string; entry: PackageEntry }> =
    [];
  for (const kind of PACKAGE_KINDS) {
    const kindSel =
      kind === "skill"
        ? link.skills
        : kind === "rule"
          ? link.rules
          : link.agents;
    const remoteMap = packageMapForKind(remoteManifest, kind);
    for (const id of resolveIdsFromSelection(kindSel, remoteMap)) {
      const entry = getPackageEntry(remoteManifest, kind, id);
      if (entry) {
        out.push({ kind, id, entry });
      }
    }
  }
  return out;
}

export async function runUnlink(
  options: UnlinkOptions,
): Promise<UnlinkRunResult> {
  if (!(await projectManifestExists(options.projectRoot))) {
    throw new Error(
      "Error: project manifest not found (.skli/skli.json). Run `npx @zortracks/skli init` first.",
    );
  }

  const linkKey = resolveLinkKey(options.id);
  const projectManifest = (await readProjectManifest(
    options.projectRoot,
  )) as ProjectManifest;
  const links = { ...getProjectLinks(projectManifest) };
  const link = links[linkKey];
  if (!link) {
    throw new Error(`Error: link "${linkKey}" is not in the ProjectManifest.`);
  }

  const keepFiles = Boolean(options.keepSources);
  const results: UnlinkItemResult[] = [];

  if (!keepFiles) {
    ensureGhInstalled({ debug: options.debug });
    ensureGhAuthenticated({ debug: options.debug });
    const ghOpts: GhOptions = { debug: options.debug };
    const [owner, repo] = link.repos.split("/");
    if (!owner || !repo) {
      throw new Error(`Error: invalid link repos "${link.repos}".`);
    }

    const { manifest: remoteManifest } = fetchRemoteProjectManifest(
      owner,
      repo,
      link.version,
      ghOpts,
    );

    const packages = collectLinkPackages(link, remoteManifest);
    debugLog(
      options.debug,
      `unlink linkKey=${linkKey} packages=${packages.length}`,
    );

    for (const pkg of packages) {
      const deletedPaths: string[] = [];
      const dirs = resolveInstallDirs({
        ides: link.ides,
        kind: pkg.kind,
        global: false,
        projectRoot: options.projectRoot,
      });
      const isDirectory = pkg.kind === "skill";
      for (const d of dirs) {
        const dest = packageDestination(
          pkg.entry.path,
          pkg.id,
          d.dir,
          isDirectory,
        );
        if (await rmForce(dest, options.debug)) {
          deletedPaths.push(dest);
        }
      }
      results.push({
        kind: pkg.kind,
        id: pkg.id,
        removedIdes: [...link.ides],
        deletedPaths,
      });
    }
  } else {
    debugLog(options.debug, `unlink linkKey=${linkKey} keepSources=true`);
  }

  const { [linkKey]: _removed, ...rest } = links;
  let nextManifest: ProjectManifest = {
    ...projectManifest,
    links: rest,
  };
  if (Object.keys(rest).length === 0) {
    const { links: _l, ...withoutLinks } = nextManifest;
    nextManifest = withoutLinks as ProjectManifest;
  }

  await writeProjectManifest(options.projectRoot, nextManifest);
  await addProjectToIndex(options.projectRoot);

  return { linkKey, results, keptSources: keepFiles };
}
