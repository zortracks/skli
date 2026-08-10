import fs from "node:fs/promises";
import { checkbox } from "@inquirer/prompts";
import { copyPackageToTargets } from "./copy-package.js";
import { fetchGitHubPathToTemp } from "./fetch-github-path.js";
import {
  ensureGhAuthenticated,
  ensureGhInstalled,
  fetchRemoteProjectManifest,
  type GhOptions,
} from "./gh.js";
import { parseGitHubSource } from "./github-source.js";
import { ensureGitignoreSectionEntries } from "./gitignore.js";
import {
  resolveInstallDirs,
  type IdeId,
  type ResolvedInstallDir,
} from "./ide-targets.js";
import {
  addProjectToIndex,
  emptyLinkResourceSelection,
  getPackageEntry,
  getProjectLinks,
  PACKAGE_KINDS,
  packageIdFromPath,
  projectManifestExists,
  readProjectManifest,
  sourceRelativeToProject,
  writeProjectManifest,
  type LinkEntry,
  type LinkResourceSelection,
  type PackageEntry,
  type PackageKind,
  type ProjectManifest,
  type SkliManifest,
  type VersioningMode,
} from "./manifests.js";
import { resolveInstallRef } from "./resolve-version.js";

const KIND_MAP: Record<
  PackageKind,
  keyof Pick<SkliManifest, "skills" | "rules" | "agents">
> = {
  skill: "skills",
  rule: "rules",
  agent: "agents",
};

export type LinkKindFlags = {
  all?: boolean;
  allSkills?: boolean;
  allRules?: boolean;
  allAgents?: boolean;
};

export type LinkOptions = {
  ides: IdeId[];
  source: string;
  versioning: VersioningMode;
  projectRoot: string;
  debug?: boolean;
  gitignore?: boolean;
  kindFlags: LinkKindFlags;
};

export type LinkCopiedPackage = {
  kind: PackageKind;
  id: string;
  destinations: string[];
};

export type LinkRunResult = {
  linkKey: string;
  entry: LinkEntry;
  copied: LinkCopiedPackage[];
};

function debugLog(debug: boolean | undefined, message: string): void {
  if (debug) {
    console.error(`[skli debug] ${message}`);
  }
}

export function linkKeyFromRepos(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function packageMapForKind(
  manifest: SkliManifest,
  kind: PackageKind,
): Record<string, PackageEntry> {
  return manifest[KIND_MAP[kind]];
}

export function resolveIdsFromSelection(
  selection: LinkResourceSelection,
  remoteMap: Record<string, PackageEntry>,
): string[] {
  if (selection.includeAll) {
    return Object.keys(remoteMap);
  }
  return selection.includes.filter((id) => Boolean(remoteMap[id]));
}

export async function selectKindResources(options: {
  kind: PackageKind;
  remoteIds: string[];
  forceAll: boolean;
}): Promise<LinkResourceSelection> {
  if (options.forceAll) {
    return emptyLinkResourceSelection(true);
  }

  if (options.remoteIds.length === 0) {
    return emptyLinkResourceSelection(false);
  }

  const selected = await checkbox({
    message: `Select ${options.kind}s to link`,
    choices: [
      { name: "all", value: "__all__" },
      { name: "skip", value: "__skip__" },
      ...options.remoteIds.map((id) => ({ name: id, value: id })),
    ],
  });

  if (selected.includes("__skip__") && selected.length === 1) {
    return emptyLinkResourceSelection(false);
  }
  if (selected.includes("__all__")) {
    return emptyLinkResourceSelection(true);
  }

  const includes = selected.filter(
    (v) => v !== "__all__" && v !== "__skip__",
  );
  return { includeAll: false, includes };
}

/**
 * Resolve fetch owner/repo/ref/path for a package listed in a remote ProjectManifest.
 * Local entries are treated as paths inside the linked repository.
 */
export function resolveLinkedPackageFetch(
  linkRepos: string,
  linkVersion: string,
  entry: PackageEntry,
): { owner: string; repo: string; ref: string; remotePath: string } {
  if (entry.source === "repos") {
    if (!entry.repos || !entry.path) {
      throw new Error(
        "Error: remote Package entry with source=repos is missing repos or path.",
      );
    }
    const [owner, repo] = entry.repos.split("/");
    if (!owner || !repo) {
      throw new Error(`Error: invalid repos field "${entry.repos}".`);
    }
    return {
      owner,
      repo,
      ref: entry.version ?? linkVersion,
      remotePath: entry.path,
    };
  }

  const [owner, repo] = linkRepos.split("/");
  if (!owner || !repo) {
    throw new Error(`Error: invalid link repos "${linkRepos}".`);
  }
  return {
    owner,
    repo,
    ref: linkVersion,
    remotePath: entry.path,
  };
}

export async function copyLinkedPackage(options: {
  kind: PackageKind;
  id: string;
  entry: PackageEntry;
  linkRepos: string;
  linkVersion: string;
  dirs: ResolvedInstallDir[];
  debug?: boolean;
  emptyFirst?: boolean;
}): Promise<string[]> {
  if (options.dirs.length === 0) {
    throw new Error(
      `No install directories for kind "${options.kind}" and the selected IDE(s).`,
    );
  }

  const fetch = resolveLinkedPackageFetch(
    options.linkRepos,
    options.linkVersion,
    options.entry,
  );
  const ghOpts: GhOptions = { debug: options.debug };

  const fetched = await fetchGitHubPathToTemp({
    owner: fetch.owner,
    repo: fetch.repo,
    remotePath: fetch.remotePath,
    ref: fetch.ref,
    debug: options.debug,
  });

  try {
    const id = options.id || packageIdFromPath(fetch.remotePath);
    return await copyPackageToTargets(fetched.localPath, id, options.dirs, {
      debug: options.debug,
      emptyFirst: options.emptyFirst,
    });
  } finally {
    await fs.rm(fetched.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function forceAllForKind(
  kind: PackageKind,
  flags: LinkKindFlags,
): boolean {
  if (flags.all) {
    return true;
  }
  if (kind === "skill") {
    return Boolean(flags.allSkills);
  }
  if (kind === "rule") {
    return Boolean(flags.allRules);
  }
  return Boolean(flags.allAgents);
}

export async function runLink(options: LinkOptions): Promise<LinkRunResult> {
  if (!(await projectManifestExists(options.projectRoot))) {
    throw new Error(
      "Error: project manifest not found (.skli/skli.json). Run `npx @zortracks/skli init` first.",
    );
  }

  const github = parseGitHubSource(options.source);
  if (!github) {
    throw new Error(
      "Error: link requires a GitHub Source (owner/repo[@ref] or URL).",
    );
  }

  const linkKey = linkKeyFromRepos(github.owner, github.repo);
  const projectManifest = (await readProjectManifest(
    options.projectRoot,
  )) as ProjectManifest;
  const existingLinks = getProjectLinks(projectManifest);
  if (existingLinks[linkKey]) {
    throw new Error(
      `Error: link "${linkKey}" already exists. Use \`skli unlink\` first.`,
    );
  }

  const ghOpts: GhOptions = { debug: options.debug };
  ensureGhInstalled(ghOpts);
  ensureGhAuthenticated(ghOpts);

  const resolved = await resolveInstallRef({
    owner: github.owner,
    repo: github.repo,
    sourceRef: github.ref,
    versioning: options.versioning,
    debug: options.debug,
  });

  debugLog(
    options.debug,
    `link resolve ${linkKey} version=${resolved.version} fetchRef=${resolved.fetchRef}`,
  );

  const { manifest: remoteManifest } = fetchRemoteProjectManifest(
    github.owner,
    github.repo,
    resolved.fetchRef,
    ghOpts,
  );

  const selections: Record<PackageKind, LinkResourceSelection> = {
    skill: emptyLinkResourceSelection(false),
    rule: emptyLinkResourceSelection(false),
    agent: emptyLinkResourceSelection(false),
  };

  for (const kind of PACKAGE_KINDS) {
    const remoteIds = Object.keys(packageMapForKind(remoteManifest, kind));
    selections[kind] = await selectKindResources({
      kind,
      remoteIds,
      forceAll: forceAllForKind(kind, options.kindFlags),
    });
  }

  const hasAny =
    selections.skill.includeAll ||
    selections.skill.includes.length > 0 ||
    selections.rule.includeAll ||
    selections.rule.includes.length > 0 ||
    selections.agent.includeAll ||
    selections.agent.includes.length > 0;

  if (!hasAny) {
    throw new Error("Error: nothing selected to link.");
  }

  const linkEntry: LinkEntry = {
    repos: linkKey,
    versioning: options.versioning,
    version: resolved.version,
    ides: [...options.ides],
    skills: selections.skill,
    rules: selections.rule,
    agents: selections.agent,
  };

  const copied: LinkCopiedPackage[] = [];
  const allDestinations: string[] = [];

  for (const kind of PACKAGE_KINDS) {
    const remoteMap = packageMapForKind(remoteManifest, kind);
    const ids = resolveIdsFromSelection(selections[kind], remoteMap);
    if (ids.length === 0) {
      continue;
    }

    const dirs = resolveInstallDirs({
      ides: options.ides,
      kind,
      global: false,
      projectRoot: options.projectRoot,
    });

    for (const id of ids) {
      const entry = getPackageEntry(remoteManifest, kind, id);
      if (!entry) {
        throw new Error(
          `Error: remote ${kind} "${id}" missing from ProjectManifest.`,
        );
      }
      const destinations = await copyLinkedPackage({
        kind,
        id,
        entry,
        linkRepos: linkKey,
        linkVersion: resolved.fetchRef,
        dirs,
        debug: options.debug,
      });
      copied.push({ kind, id, destinations });
      allDestinations.push(...destinations);
    }
  }

  const nextManifest: ProjectManifest = {
    ...projectManifest,
    links: {
      ...existingLinks,
      [linkKey]: linkEntry,
    },
  };
  await writeProjectManifest(options.projectRoot, nextManifest);
  await addProjectToIndex(options.projectRoot);

  if (options.gitignore && allDestinations.length > 0) {
    const relative = allDestinations
      .map((d) => sourceRelativeToProject(options.projectRoot, d))
      .filter((p) => p.length > 0 && !p.startsWith(".."));
    const added = await ensureGitignoreSectionEntries(
      options.projectRoot,
      relative,
    );
    if (added.length > 0) {
      console.log(
        `Added ${added.length} path(s) to .gitignore (# Ignored AI IDE references).`,
      );
    }
  }

  return { linkKey, entry: linkEntry, copied };
}
