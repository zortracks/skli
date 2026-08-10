import fs from "node:fs/promises";
import path from "node:path";
import { copyPackageToTargets } from "./copy-package.js";
import {
  ensureGhAuthenticated,
  ensureGhInstalled,
  type GhOptions,
} from "./gh.js";
import { parseGitHubSource } from "./github-source.js";
import { fetchGitHubPathToTemp } from "./fetch-github-path.js";
import { resolveInstallRef } from "./resolve-version.js";
import type { IdeId, ResolvedInstallDir } from "./ide-targets.js";
import {
  addPackageToManifest,
  addProjectToIndex,
  getPackageEntry,
  packageIdFromPath,
  projectManifestExists,
  readGlobalManifest,
  readProjectManifest,
  sourceRelativeToProject,
  writeGlobalManifest,
  writeProjectManifest,
  type PackageEntry,
  type PackageKind,
  type SkliManifest,
  type VersioningMode,
} from "./manifests.js";

export type InstallPackageOptions = {
  kind: PackageKind;
  source: string;
  versioning: VersioningMode;
  global: boolean;
  projectRoot: string;
  dirs: ResolvedInstallDir[];
  debug?: boolean;
  /** When true (skill only), skip copying `references/` at skill root. */
  noReferences?: boolean;
};

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function uniqueIdes(dirs: ResolvedInstallDir[]): IdeId[] {
  const seen = new Set<string>();
  const out: IdeId[] = [];
  for (const d of dirs) {
    if (!seen.has(d.ide)) {
      seen.add(d.ide);
      out.push(d.ide);
    }
  }
  return out;
}

async function readTargetManifest(
  options: InstallPackageOptions,
): Promise<SkliManifest> {
  if (options.global) {
    return readGlobalManifest();
  }
  return readProjectManifest(options.projectRoot);
}

export async function installPackage(
  options: InstallPackageOptions,
): Promise<{ id: string; entry: PackageEntry; destinations: string[] }> {
  if (options.dirs.length === 0) {
    throw new Error(
      `No install directories for kind "${options.kind}" and the selected IDE(s).`,
    );
  }

  if (!options.global) {
    if (!(await projectManifestExists(options.projectRoot))) {
      throw new Error(
        "Error: project manifest not found (.skli/skli.json). Run `npx skli init` first.",
      );
    }
  }

  const ghOpts: GhOptions = { debug: options.debug };
  const github = parseGitHubSource(options.source);
  const includeReferences =
    options.kind === "skill" ? !options.noReferences : undefined;
  const ides = uniqueIdes(options.dirs);

  let entry: PackageEntry;
  let tempDir: string | undefined;
  let id: string;
  let localPath: string;

  try {
    if (github) {
      if (!github.path) {
        throw new Error(
          "Error: GitHub Package Source requires a path. Use owner/repo@ref:path or owner/repo:path.",
        );
      }
      id = packageIdFromPath(github.path);
    } else {
      localPath = path.resolve(options.projectRoot, options.source);
      if (!(await pathExists(localPath))) {
        throw new Error(`Error: path does not exist: ${localPath}`);
      }
      id = packageIdFromPath(localPath);
    }

    const existingManifest = await readTargetManifest(options);
    if (getPackageEntry(existingManifest, options.kind, id)) {
      throw new Error(
        `Error: ${options.kind} "${id}" is already installed. Use \`skli restore\` to refresh.`,
      );
    }

    if (github) {
      ensureGhInstalled(ghOpts);
      ensureGhAuthenticated(ghOpts);

      const resolved = await resolveInstallRef({
        owner: github.owner,
        repo: github.repo,
        sourceRef: github.ref,
        versioning: options.versioning,
        debug: options.debug,
      });

      const fetched = await fetchGitHubPathToTemp({
        owner: github.owner,
        repo: github.repo,
        remotePath: github.path,
        ref: resolved.fetchRef,
        debug: options.debug,
      });
      tempDir = fetched.tempDir;
      localPath = fetched.localPath;

      entry = {
        source: "repos",
        repos: `${github.owner}/${github.repo}`,
        path: github.path.split(path.sep).join("/"),
        versioning: options.versioning,
        version: resolved.version,
        ides,
        ...(includeReferences !== undefined
          ? { includeReferences }
          : {}),
      };
    } else {
      // localPath assigned in the non-github branch above
      const resolvedLocal = localPath!;
      const rel = sourceRelativeToProject(options.projectRoot, resolvedLocal);
      entry = {
        source: "local",
        path: rel,
        versioning: options.versioning,
        ide: ides[0],
        ...(includeReferences !== undefined
          ? { includeReferences }
          : {}),
      };
      localPath = resolvedLocal;
    }

    const destinations = await copyPackageToTargets(
      localPath,
      id,
      options.dirs,
      {
        debug: options.debug,
        noReferences: options.kind === "skill" && options.noReferences,
      },
    );

    if (options.global) {
      const manifest = await readGlobalManifest();
      await writeGlobalManifest(
        addPackageToManifest(manifest, options.kind, id, entry),
      );
    } else {
      const manifest = await readProjectManifest(options.projectRoot);
      await writeProjectManifest(
        options.projectRoot,
        addPackageToManifest(manifest, options.kind, id, entry),
      );
      await addProjectToIndex(options.projectRoot);
    }

    return { id, entry, destinations };
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
