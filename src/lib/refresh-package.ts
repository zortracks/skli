import fs from "node:fs/promises";
import {
  copyPackageToTargets,
  packageDestination,
} from "./copy-package.js";
import {
  ensureGhAuthenticated,
  ensureGhInstalled,
  fetchRemoteProjectManifest,
  type GhOptions,
} from "./gh.js";
import { fetchGitHubPathToTemp } from "./fetch-github-path.js";
import {
  looksLikeInstallPath,
  parseIdeArgument,
  resolveInstallDirs,
  resolveInstallPath,
  type IdeId,
  type ResolvedInstallDir,
} from "./ide-targets.js";
import {
  copyLinkedPackage,
  packageMapForKind,
  resolveIdsFromSelection,
} from "./link-package.js";
import {
  addPackageToManifest,
  addProjectToIndex,
  getPackageEntry,
  getProjectLinks,
  isPackageKind,
  PACKAGE_KINDS,
  projectManifestExists,
  readGlobalManifest,
  readProjectManifest,
  writeGlobalManifest,
  writeProjectManifest,
  type LinkEntry,
  type PackageEntry,
  type PackageKind,
  type ProjectManifest,
  type SkliManifest,
  type VersioningMode,
} from "./manifests.js";
import {
  isGitTag,
  resolveCommitSha,
  resolveInstallRef,
} from "./resolve-version.js";

export type RefreshMode = "update" | "restore";

export type RefreshSelection = {
  /** null = all IDEs (no filter). */
  ideFilter: IdeId[] | null;
  /** null = all PackageKinds. */
  kindFilter: PackageKind | null;
  /** null = all matching ids. */
  id: string | null;
};

export type RefreshOptions = {
  mode: RefreshMode;
  selection: RefreshSelection;
  global: boolean;
  projectRoot: string;
  debug?: boolean;
  /** Update only: pin/fetch this ref instead of resolving latest. */
  explicitVersion?: string;
};

export type RefreshItemResult =
  | {
      status: "updated" | "restored";
      kind: PackageKind;
      id: string;
      version: string;
      destinations: string[];
      linked?: boolean;
    }
  | {
      status: "skipped";
      kind: PackageKind;
      id: string;
      version: string;
      reason: string;
      destinations: string[];
      linked?: boolean;
    };

export type RefreshRunResult = {
  results: RefreshItemResult[];
};

type Candidate = {
  kind: PackageKind;
  id: string;
  entry: PackageEntry;
  targetIdes: IdeId[];
};

type LinkPackageCandidate = {
  linkKey: string;
  link: LinkEntry;
  kind: PackageKind;
  id: string;
  targetIdes: IdeId[];
};

function debugLog(debug: boolean | undefined, message: string): void {
  if (debug) {
    console.error(`[skli debug] ${message}`);
  }
}

function parseReposOwnerRepo(
  repos: string,
): { owner: string; repo: string } {
  const parts = repos.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Error: invalid repos field "${repos}". Expected owner/repo.`,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

function kindsToScan(kindFilter: PackageKind | null): PackageKind[] {
  return kindFilter ? [kindFilter] : [...PACKAGE_KINDS];
}

function intersectIdes(
  entryIdes: IdeId[] | undefined,
  ideFilter: IdeId[] | null,
): IdeId[] {
  const listed = entryIdes ?? [];
  if (ideFilter === null) {
    return [...listed];
  }
  const want = new Set(ideFilter);
  return listed.filter((ide) => want.has(ide));
}

function selectionForKind(
  link: LinkEntry,
  kind: PackageKind,
): LinkEntry["skills"] {
  return link[kind === "skill" ? "skills" : kind === "rule" ? "rules" : "agents"];
}

function collectCandidates(
  manifest: SkliManifest,
  selection: RefreshSelection,
  explicitId: boolean,
): { candidates: Candidate[]; foundExplicit: boolean } {
  const out: Candidate[] = [];
  let foundExplicit = false;

  for (const kind of kindsToScan(selection.kindFilter)) {
    const map =
      kind === "skill"
        ? manifest.skills
        : kind === "rule"
          ? manifest.rules
          : manifest.agents;

    const ids = selection.id ? [selection.id] : Object.keys(map);

    for (const id of ids) {
      const entry = map[id];
      if (!entry) {
        continue;
      }
      if (explicitId) {
        foundExplicit = true;
      }

      if (entry.source !== "repos") {
        if (explicitId) {
          throw new Error(
            `Error: ${kind} "${id}" has source=local; update/restore only apply to source=repos.`,
          );
        }
        continue;
      }

      const targetIdes = intersectIdes(entry.ides, selection.ideFilter);
      if (targetIdes.length === 0) {
        if (explicitId) {
          throw new Error(
            `Error: ${kind} "${id}" is not installed for the selected IDE(s).`,
          );
        }
        continue;
      }

      out.push({ kind, id, entry, targetIdes });
    }
  }

  return { candidates: out, foundExplicit };
}

function collectLinkCandidates(
  links: Record<string, LinkEntry>,
  selection: RefreshSelection,
  remoteMaps: Record<
    string,
    Partial<Record<PackageKind, Record<string, PackageEntry>>>
  >,
  explicitId: boolean,
  packageCandidateIds: Set<string>,
): { candidates: LinkPackageCandidate[]; foundExplicit: boolean } {
  const out: LinkPackageCandidate[] = [];
  let foundExplicit = false;

  for (const [linkKey, link] of Object.entries(links)) {
    const targetIdes = intersectIdes(link.ides, selection.ideFilter);
    if (targetIdes.length === 0) {
      continue;
    }

    for (const kind of kindsToScan(selection.kindFilter)) {
      const kindSel = selectionForKind(link, kind);
      const remoteMap = remoteMaps[linkKey]?.[kind] ?? {};
      const ids = resolveIdsFromSelection(kindSel, remoteMap);
      const wanted = selection.id
        ? ids.filter((id) => id === selection.id)
        : ids;

      for (const id of wanted) {
        if (packageCandidateIds.has(`${kind}:${id}`)) {
          continue;
        }
        if (explicitId && selection.id === id) {
          foundExplicit = true;
        }
        out.push({ linkKey, link, kind, id, targetIdes });
      }
    }
  }

  return { candidates: out, foundExplicit };
}

async function readTargetManifest(
  global: boolean,
  projectRoot: string,
): Promise<SkliManifest> {
  if (global) {
    return readGlobalManifest();
  }
  return readProjectManifest(projectRoot);
}

async function writeTargetManifest(
  global: boolean,
  projectRoot: string,
  manifest: SkliManifest,
): Promise<void> {
  if (global) {
    await writeGlobalManifest(manifest);
  } else {
    await writeProjectManifest(projectRoot, manifest);
    await addProjectToIndex(projectRoot);
  }
}

function expectedPackageDestinations(
  kind: PackageKind,
  id: string,
  entry: PackageEntry,
  dirs: ResolvedInstallDir[],
): string[] {
  const isDirectory = kind === "skill";
  const localSource = entry.path ?? id;
  return dirs.map((d) =>
    packageDestination(localSource, id, d.dir, isDirectory),
  );
}

async function refreshOne(
  candidate: Candidate,
  options: RefreshOptions,
): Promise<RefreshItemResult> {
  const { kind, id, entry, targetIdes } = candidate;

  if (!entry.repos || !entry.path || !entry.version) {
    throw new Error(
      `Error: ${kind} "${id}" is missing repos, path, or version.`,
    );
  }

  const dirs = resolveInstallDirs({
    ides: targetIdes,
    kind,
    global: options.global,
    projectRoot: options.projectRoot,
  });

  if (dirs.length === 0) {
    throw new Error(
      `No install directories for kind "${kind}" and IDE(s) ${targetIdes.join(", ")}.`,
    );
  }

  const skipDestinations = expectedPackageDestinations(kind, id, entry, dirs);

  const { owner, repo } = parseReposOwnerRepo(entry.repos);
  let fetchRef: string;
  let nextVersion: string;

  if (options.mode === "update") {
    if (options.explicitVersion) {
      const pinned = resolveExplicitVersion({
        owner,
        repo,
        versioning: entry.versioning,
        explicitVersion: options.explicitVersion,
        debug: options.debug,
      });
      if (pinned.version === entry.version) {
        return {
          status: "skipped",
          kind,
          id,
          version: entry.version,
          reason: "already at requested version",
          destinations: skipDestinations,
        };
      }
      fetchRef = pinned.fetchRef;
      nextVersion = pinned.version;
    } else {
      const resolved = await resolveInstallRef({
        owner,
        repo,
        versioning: entry.versioning,
        debug: options.debug,
      });
      if (resolved.version === entry.version) {
        return {
          status: "skipped",
          kind,
          id,
          version: entry.version,
          reason: "already at resolved version",
          destinations: skipDestinations,
        };
      }
      fetchRef = resolved.fetchRef;
      nextVersion = resolved.version;
    }
  } else {
    fetchRef = entry.version;
    nextVersion = entry.version;
  }

  const fetched = await fetchGitHubPathToTemp({
    owner,
    repo,
    remotePath: entry.path,
    ref: fetchRef,
    debug: options.debug,
  });

  try {
    const noReferences =
      kind === "skill" && entry.includeReferences === false;
    const destinations = await copyPackageToTargets(
      fetched.localPath,
      id,
      dirs,
      {
        debug: options.debug,
        noReferences,
        emptyFirst: true,
      },
    );

    if (options.mode === "update") {
      const updatedEntry: PackageEntry = {
        ...entry,
        version: nextVersion,
      };
      const manifest = await readTargetManifest(
        options.global,
        options.projectRoot,
      );
      if (!getPackageEntry(manifest, kind, id)) {
        throw new Error(
          `Error: ${kind} "${id}" disappeared from the Manifest during update.`,
        );
      }
      await writeTargetManifest(
        options.global,
        options.projectRoot,
        addPackageToManifest(manifest, kind, id, updatedEntry),
      );
      return {
        status: "updated",
        kind,
        id,
        version: nextVersion,
        destinations,
      };
    }

    return {
      status: "restored",
      kind,
      id,
      version: nextVersion,
      destinations,
    };
  } finally {
    await fs
      .rm(fetched.tempDir, { recursive: true, force: true })
      .catch(() => {});
  }
}

async function refreshLinks(
  options: RefreshOptions,
  packageCandidateIds: Set<string>,
  foundPackageExplicit: boolean,
): Promise<{
  results: RefreshItemResult[];
  foundExplicit: boolean;
}> {
  if (options.global) {
    return { results: [], foundExplicit: false };
  }

  const projectManifest = (await readProjectManifest(
    options.projectRoot,
  )) as ProjectManifest;
  const links = getProjectLinks(projectManifest);
  if (Object.keys(links).length === 0) {
    return { results: [], foundExplicit: false };
  }

  const explicitId = options.selection.id !== null;
  const results: RefreshItemResult[] = [];
  let foundExplicit = false;
  const ghOpts: GhOptions = { debug: options.debug };

  for (const linkKey of Object.keys(links)) {
    const link = links[linkKey];
    const targetIdes = intersectIdes(link.ides, options.selection.ideFilter);
    if (targetIdes.length === 0) {
      continue;
    }

    const { owner, repo } = parseReposOwnerRepo(link.repos);
    let fetchRef: string;
    let nextVersion: string;
    let skipWholeLink = false;

    if (options.mode === "update") {
      if (options.explicitVersion) {
        const pinned = resolveExplicitVersion({
          owner,
          repo,
          versioning: link.versioning,
          explicitVersion: options.explicitVersion,
          debug: options.debug,
        });
        skipWholeLink = pinned.version === link.version;
        fetchRef = pinned.fetchRef;
        nextVersion = pinned.version;
      } else {
        const resolved = await resolveInstallRef({
          owner,
          repo,
          versioning: link.versioning,
          debug: options.debug,
        });
        skipWholeLink = resolved.version === link.version;
        fetchRef = resolved.fetchRef;
        nextVersion = resolved.version;
      }
    } else {
      fetchRef = link.version;
      nextVersion = link.version;
    }

    const { manifest: remoteManifest } = fetchRemoteProjectManifest(
      owner,
      repo,
      fetchRef,
      ghOpts,
    );

    const remoteMaps: Record<
      string,
      Partial<Record<PackageKind, Record<string, PackageEntry>>>
    > = {
      [linkKey]: {
        skill: packageMapForKind(remoteManifest, "skill"),
        rule: packageMapForKind(remoteManifest, "rule"),
        agent: packageMapForKind(remoteManifest, "agent"),
      },
    };

    const { candidates, foundExplicit: foundInLink } = collectLinkCandidates(
      { [linkKey]: link },
      options.selection,
      remoteMaps,
      explicitId,
      packageCandidateIds,
    );
    if (foundInLink) {
      foundExplicit = true;
    }

    if (candidates.length === 0) {
      continue;
    }

    let linkVersionWritten = false;

    for (const candidate of candidates) {
      const remoteEntry = getPackageEntry(
        remoteManifest,
        candidate.kind,
        candidate.id,
      );
      if (!remoteEntry) {
        if (explicitId) {
          throw new Error(
            `Error: linked ${candidate.kind} "${candidate.id}" is not in remote ProjectManifest ${linkKey}@${fetchRef}.`,
          );
        }
        continue;
      }

      const dirs = resolveInstallDirs({
        ides: candidate.targetIdes,
        kind: candidate.kind,
        global: false,
        projectRoot: options.projectRoot,
      });
      const skipDestinations = expectedPackageDestinations(
        candidate.kind,
        candidate.id,
        remoteEntry,
        dirs,
      );

      if (options.mode === "update" && skipWholeLink) {
        results.push({
          status: "skipped",
          kind: candidate.kind,
          id: candidate.id,
          version: link.version,
          reason: "already at resolved version",
          destinations: skipDestinations,
          linked: true,
        });
        continue;
      }

      const destinations = await copyLinkedPackage({
        kind: candidate.kind,
        id: candidate.id,
        entry: remoteEntry,
        linkRepos: link.repos,
        linkVersion: fetchRef,
        dirs,
        debug: options.debug,
        emptyFirst: true,
      });

      if (options.mode === "update" && !linkVersionWritten) {
        const current = (await readProjectManifest(
          options.projectRoot,
        )) as ProjectManifest;
        const currentLinks = getProjectLinks(current);
        const currentLink = currentLinks[linkKey];
        if (currentLink) {
          await writeProjectManifest(options.projectRoot, {
            ...current,
            links: {
              ...currentLinks,
              [linkKey]: { ...currentLink, version: nextVersion },
            },
          });
          await addProjectToIndex(options.projectRoot);
          linkVersionWritten = true;
        }
      }

      results.push({
        status: options.mode === "update" ? "updated" : "restored",
        kind: candidate.kind,
        id: candidate.id,
        version: nextVersion,
        destinations,
        linked: true,
      });
    }
  }

  if (explicitId && !foundPackageExplicit && !foundExplicit) {
    const kind = options.selection.kindFilter;
    const id = options.selection.id;
    throw new Error(
      `Error: ${kind} "${id}" is not in the Manifest or linked packages.`,
    );
  }

  return { results, foundExplicit };
}

export async function runRefresh(
  options: RefreshOptions,
): Promise<RefreshRunResult> {
  if (!options.global) {
    if (!(await projectManifestExists(options.projectRoot))) {
      throw new Error(
        "Error: project manifest not found (.skli/skli.json). Run `npx skli init` first.",
      );
    }
  }

  const manifest = await readTargetManifest(
    options.global,
    options.projectRoot,
  );
  const explicitId = options.selection.id !== null;
  const { candidates, foundExplicit: foundPackageExplicit } =
    collectCandidates(manifest, options.selection, explicitId);

  const packageCandidateIds = new Set(
    candidates.map((c) => `${c.kind}:${c.id}`),
  );

  debugLog(
    options.debug,
    `refresh mode=${options.mode} packageCandidates=${candidates.length}`,
  );

  let hasLinks = false;
  if (!options.global) {
    const projectManifest = (await readProjectManifest(
      options.projectRoot,
    )) as ProjectManifest;
    hasLinks = Object.keys(getProjectLinks(projectManifest)).length > 0;
  }

  if (candidates.length > 0 || hasLinks) {
    ensureGhInstalled({ debug: options.debug });
    ensureGhAuthenticated({ debug: options.debug });
  }

  const results: RefreshItemResult[] = [];
  for (const candidate of candidates) {
    results.push(await refreshOne(candidate, options));
  }

  const linkRefresh = await refreshLinks(
    options,
    packageCandidateIds,
    foundPackageExplicit,
  );
  results.push(...linkRefresh.results);

  if (
    explicitId &&
    candidates.length === 0 &&
    linkRefresh.results.length === 0 &&
    !foundPackageExplicit &&
    !linkRefresh.foundExplicit
  ) {
    const kind = options.selection.kindFilter;
    const id = options.selection.id;
    throw new Error(
      `Error: ${kind} "${id}" is not in the Manifest or linked packages.`,
    );
  }

  return { results };
}

function resolveExplicitVersion(options: {
  owner: string;
  repo: string;
  versioning: VersioningMode;
  explicitVersion: string;
  debug?: boolean;
}): { fetchRef: string; version: string } {
  const ref = options.explicitVersion.trim();
  if (!ref) {
    throw new Error("Error: --version must not be empty.");
  }
  const ghOpts = { debug: options.debug };

  switch (options.versioning) {
    case "tag": {
      if (!isGitTag(options.owner, options.repo, ref, ghOpts)) {
        throw new Error(
          `Error: --version "${ref}" is not a git tag on ${options.owner}/${options.repo}.`,
        );
      }
      return { fetchRef: ref, version: ref };
    }
    case "commit": {
      const sha = resolveCommitSha(options.owner, options.repo, ref, ghOpts);
      return { fetchRef: sha, version: sha };
    }
    case "branch":
    case "none":
      return { fetchRef: ref, version: ref };
    default: {
      const _exhaustive: never = options.versioning;
      throw new Error(`Unsupported versioning: ${_exhaustive}`);
    }
  }
}

/** Parse ide token: literal `all` → null filter; otherwise IdeId CSV. */
export function parseIdeSelector(
  raw: string,
): { ok: true; ideFilter: IdeId[] | null } | { ok: false; error: string } {
  if (raw === "all") {
    return { ok: true, ideFilter: null };
  }
  const parsed = parseIdeArgument(raw);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, ideFilter: parsed.ides };
}

export function parseKindArg(
  raw: string,
): { ok: true; kind: PackageKind } | { ok: false; error: string } {
  if (!isPackageKind(raw)) {
    return {
      ok: false,
      error: `Error: invalid kind "${raw}". Expected ${PACKAGE_KINDS.join(", ")}.`,
    };
  }
  return { ok: true, kind: raw };
}

export type SelectionFromArgsOptions = {
  allFlag: boolean;
  projectRoot: string;
  global: boolean;
};

export function selectionFromArgs(
  args: string[],
  options: SelectionFromArgsOptions,
):
  | { ok: true; selection: RefreshSelection }
  | { ok: false; error: string } {
  const allFlag = options.allFlag;

  if (args.length === 0) {
    if (!allFlag) {
      return {
        ok: false,
        error:
          "Error: specify --all, or <ide> --all, or <ide|all> <kind> --all, or <ide|all> <kind> <id>, or <install-path>.",
      };
    }
    return {
      ok: true,
      selection: { ideFilter: null, kindFilter: null, id: null },
    };
  }

  if (args.length === 1) {
    if (!allFlag && looksLikeInstallPath(args[0])) {
      const resolved = resolveInstallPath({
        rawPath: args[0],
        projectRoot: options.projectRoot,
        global: options.global,
      });
      if (!resolved.ok) {
        return resolved;
      }
      return {
        ok: true,
        selection: {
          ideFilter: [resolved.resolved.ide],
          kindFilter: resolved.resolved.kind,
          id: resolved.resolved.id,
        },
      };
    }
    if (allFlag && looksLikeInstallPath(args[0])) {
      return {
        ok: false,
        error: "Error: --all cannot be combined with an install path.",
      };
    }
    if (!allFlag) {
      return {
        ok: false,
        error:
          "Error: with a single argument, --all is required (e.g. skli update cursor --all), or pass an install path (e.g. .cursor/skills/foo).",
      };
    }
    const ide = parseIdeSelector(args[0]);
    if (!ide.ok) {
      return ide;
    }
    return {
      ok: true,
      selection: { ideFilter: ide.ideFilter, kindFilter: null, id: null },
    };
  }

  if (args.length === 2) {
    if (!allFlag) {
      return {
        ok: false,
        error:
          "Error: with <ide> <kind>, --all is required, or pass <id> as a third argument.",
      };
    }
    const ide = parseIdeSelector(args[0]);
    if (!ide.ok) {
      return ide;
    }
    const kind = parseKindArg(args[1]);
    if (!kind.ok) {
      return kind;
    }
    return {
      ok: true,
      selection: {
        ideFilter: ide.ideFilter,
        kindFilter: kind.kind,
        id: null,
      },
    };
  }

  if (args.length === 3) {
    if (allFlag) {
      return {
        ok: false,
        error: "Error: --all cannot be combined with a Package <id>.",
      };
    }
    const ide = parseIdeSelector(args[0]);
    if (!ide.ok) {
      return ide;
    }
    const kind = parseKindArg(args[1]);
    if (!kind.ok) {
      return kind;
    }
    const id = args[2].trim();
    if (!id) {
      return { ok: false, error: "Error: Package id must not be empty." };
    }
    return {
      ok: true,
      selection: {
        ideFilter: ide.ideFilter,
        kindFilter: kind.kind,
        id,
      },
    };
  }

  return {
    ok: false,
    error: `Error: too many arguments (${args.length}). Expected at most <ide|all> <kind> <id>, or a single <install-path>.`,
  };
}

/** True when selection targets exactly one Package id (kind + id set). */
export function isSinglePackageSelection(selection: RefreshSelection): boolean {
  return selection.id !== null && selection.kindFilter !== null;
}
