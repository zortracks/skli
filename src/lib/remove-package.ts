import fs from "node:fs/promises";
import path from "node:path";
import { packageDestination } from "./copy-package.js";
import {
  resolveInstallDirs,
  type IdeId,
  type ResolvedInstallDir,
} from "./ide-targets.js";
import {
  addPackageToManifest,
  addProjectToIndex,
  PACKAGE_KINDS,
  projectManifestExists,
  readGlobalManifest,
  readProjectManifest,
  removePackageFromManifest,
  writeGlobalManifest,
  writeProjectManifest,
  type PackageEntry,
  type PackageKind,
  type PackageSourceOrigin,
  type SkliManifest,
} from "./manifests.js";
import type { RefreshSelection } from "./refresh-package.js";

export type RemoveOptions = {
  selection: RefreshSelection;
  global: boolean;
  projectRoot: string;
  debug?: boolean;
  keepSources?: boolean;
  removeSources?: boolean;
};

export type RemoveItemResult = {
  status: "removed" | "partial";
  kind: PackageKind;
  id: string;
  source: PackageSourceOrigin;
  removedIdes: IdeId[];
  deletedPaths: string[];
  entryDeleted: boolean;
};

export type RemoveRunResult = {
  results: RemoveItemResult[];
};

type Candidate = {
  kind: PackageKind;
  id: string;
  entry: PackageEntry;
  targetIdes: IdeId[];
};

function debugLog(debug: boolean | undefined, message: string): void {
  if (debug) {
    console.error(`[skli debug] ${message}`);
  }
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

function localIdeMatches(
  entryIde: IdeId | undefined,
  ideFilter: IdeId[] | null,
): entryIde is IdeId {
  if (!entryIde) {
    return false;
  }
  if (ideFilter === null) {
    return true;
  }
  return ideFilter.includes(entryIde);
}

function collectCandidates(
  manifest: SkliManifest,
  selection: RefreshSelection,
  explicitId: boolean,
): Candidate[] {
  const out: Candidate[] = [];

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
        if (explicitId) {
          throw new Error(`Error: ${kind} "${id}" is not in the Manifest.`);
        }
        continue;
      }

      if (entry.source === "repos") {
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
        continue;
      }

      if (!localIdeMatches(entry.ide, selection.ideFilter)) {
        if (explicitId) {
          throw new Error(
            `Error: ${kind} "${id}" is not installed for the selected IDE(s).`,
          );
        }
        continue;
      }
      out.push({ kind, id, entry, targetIdes: [entry.ide!] });
    }
  }

  return out;
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

function resolveLocalSourcePath(
  projectRoot: string,
  entryPath: string,
): string {
  return path.isAbsolute(entryPath)
    ? entryPath
    : path.resolve(projectRoot, entryPath);
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

export async function runRemove(
  options: RemoveOptions,
): Promise<RemoveRunResult> {
  if (options.keepSources && options.removeSources) {
    throw new Error(
      "Error: --keep-sources cannot be combined with --remove-sources.",
    );
  }

  if (!options.global) {
    if (!(await projectManifestExists(options.projectRoot))) {
      throw new Error(
        "Error: project manifest not found (.skli/skli.json). Run `npx @zortracks/skli init` first.",
      );
    }
  }

  let manifest = await readTargetManifest(
    options.global,
    options.projectRoot,
  );
  const explicitId = options.selection.id !== null;
  const candidates = collectCandidates(
    manifest,
    options.selection,
    explicitId,
  );

  debugLog(
    options.debug,
    `remove candidates=${candidates.length} keepSources=${Boolean(options.keepSources)} removeSources=${Boolean(options.removeSources)}`,
  );

  if (candidates.length === 0) {
    return { results: [] };
  }

  if (explicitId) {
    for (const c of candidates) {
      if (options.keepSources && c.entry.source === "local") {
        throw new Error(
          `Error: --keep-sources does not apply to source=local (${c.kind} "${c.id}").`,
        );
      }
      if (options.removeSources && c.entry.source === "repos") {
        throw new Error(
          `Error: --remove-sources does not apply to source=repos (${c.kind} "${c.id}").`,
        );
      }
    }
  }

  const results: RemoveItemResult[] = [];

  for (const candidate of candidates) {
    const { kind, id, entry, targetIdes } = candidate;
    const deletedPaths: string[] = [];

    if (entry.source === "repos") {
      const keepFiles = Boolean(options.keepSources);
      if (!keepFiles) {
        const dirs = resolveInstallDirs({
          ides: targetIdes,
          kind,
          global: options.global,
          projectRoot: options.projectRoot,
        });
        const destinations = expectedPackageDestinations(
          kind,
          id,
          entry,
          dirs,
        );
        for (const dest of destinations) {
          if (await rmForce(dest, options.debug)) {
            deletedPaths.push(dest);
          }
        }
      }

      const remainingIdes = (entry.ides ?? []).filter(
        (ide) => !targetIdes.includes(ide),
      );
      const entryDeleted = remainingIdes.length === 0;

      if (entryDeleted) {
        manifest = removePackageFromManifest(manifest, kind, id);
      } else {
        const updated: PackageEntry = { ...entry, ides: remainingIdes };
        manifest = addPackageToManifest(manifest, kind, id, updated);
      }

      results.push({
        status: entryDeleted ? "removed" : "partial",
        kind,
        id,
        source: "repos",
        removedIdes: targetIdes,
        deletedPaths,
        entryDeleted,
      });
      continue;
    }

    const removeDisk = Boolean(options.removeSources);
    if (removeDisk) {
      const sourcePath = resolveLocalSourcePath(
        options.projectRoot,
        entry.path,
      );
      if (await rmForce(sourcePath, options.debug)) {
        deletedPaths.push(sourcePath);
      }
    }

    manifest = removePackageFromManifest(manifest, kind, id);
    results.push({
      status: "removed",
      kind,
      id,
      source: "local",
      removedIdes: targetIdes,
      deletedPaths,
      entryDeleted: true,
    });
  }

  await writeTargetManifest(options.global, options.projectRoot, manifest);
  return { results };
}
