import fs from "node:fs/promises";
import path from "node:path";
import type { IdeId } from "./ide-targets.js";
import {
  getGlobalManifestPath,
  getProjectManifestPath,
  getProjectsIndexPath,
} from "./paths.js";

export const MANIFEST_SCHEMA_VERSION = 1;

/** Canonical ProjectManifest JSON Schema URL (IDE tooling via `$schema`). */
export const PROJECT_MANIFEST_SCHEMA_URL =
  "https://raw.githubusercontent.com/zortracks/skli/main/schemas/skli.project.schema.json";

export const PACKAGE_KINDS = ["skill", "rule", "agent"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

/** Alias of PackageKind — historical CLI name for `skli install` kind. */
export const INSTALL_KINDS = PACKAGE_KINDS;
export type InstallKind = PackageKind;

export const VERSIONING_MODES = ["tag", "commit", "branch", "none"] as const;
export type VersioningMode = (typeof VERSIONING_MODES)[number];

export const PACKAGE_SOURCE_ORIGINS = ["local", "repos"] as const;
export type PackageSourceOrigin = (typeof PACKAGE_SOURCE_ORIGINS)[number];

export type PackageEntry = {
  source: PackageSourceOrigin;
  path: string;
  versioning: VersioningMode;
  /** Present only when source is `repos` — currently installed version. */
  version?: string;
  /** Present only when source is `repos` — `owner/repo`. */
  repos?: string;
  /** Present only when source is `local` — single target IDE. */
  ide?: IdeId;
  /** Present only when source is `repos` — IDEs the package was installed into. */
  ides?: IdeId[];
  /**
   * Skill installs only. Whether `references/` was included (default true).
   * Written explicitly on `skli install … skill`.
   */
  includeReferences?: boolean;
};

export type SkliManifest = {
  version: number;
  skills: Record<string, PackageEntry>;
  rules: Record<string, PackageEntry>;
  agents: Record<string, PackageEntry>;
};

export type LinkResourceSelection = {
  includeAll: boolean;
  includes: string[];
};

export type LinkEntry = {
  repos: string;
  versioning: VersioningMode;
  version: string;
  ides: IdeId[];
  skills: LinkResourceSelection;
  rules: LinkResourceSelection;
  agents: LinkResourceSelection;
};

export type ProjectMeta = {
  name: string;
  description: string;
  versioning: VersioningMode;
  tags: string[];
};

export type ProjectManifest = SkliManifest &
  ProjectMeta & {
    $schema?: string;
    /** Project-only map of linked remote ProjectManifests (key = owner/repo). */
    links?: Record<string, LinkEntry>;
  };

export function emptyLinkResourceSelection(
  includeAll = false,
): LinkResourceSelection {
  return { includeAll, includes: [] };
}

export function getProjectLinks(
  manifest: SkliManifest | ProjectManifest,
): Record<string, LinkEntry> {
  const links = (manifest as ProjectManifest).links;
  return links ?? {};
}

const KIND_TO_MAP: Record<
  PackageKind,
  keyof Pick<SkliManifest, "skills" | "rules" | "agents">
> = {
  skill: "skills",
  rule: "rules",
  agent: "agents",
};

export function isPackageKind(value: string): value is PackageKind {
  return (PACKAGE_KINDS as readonly string[]).includes(value);
}

export function isInstallKind(value: string): value is InstallKind {
  return isPackageKind(value);
}

export function isVersioningMode(value: string): value is VersioningMode {
  return (VERSIONING_MODES as readonly string[]).includes(value);
}

export function packageIdFromPath(inputPath: string): string {
  return path.parse(inputPath).name;
}

export function sourceRelativeToProject(
  projectRoot: string,
  absolutePath: string,
): string {
  const rel = path.relative(projectRoot, absolutePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return absolutePath;
  }
  return rel.split(path.sep).join("/");
}

export function normalizeTags(tags: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

export type ProjectsIndex = {
  version: number;
  projects: string[];
};

export function emptyManifest(): SkliManifest {
  return {
    version: MANIFEST_SCHEMA_VERSION,
    skills: {},
    rules: {},
    agents: {},
  };
}

export function emptyProjectManifest(meta: ProjectMeta): ProjectManifest {
  return {
    $schema: PROJECT_MANIFEST_SCHEMA_URL,
    version: MANIFEST_SCHEMA_VERSION,
    name: meta.name,
    description: meta.description,
    versioning: meta.versioning,
    tags: meta.tags,
    skills: {},
    rules: {},
    agents: {},
  };
}

export function emptyProjectsIndex(): ProjectsIndex {
  return {
    version: MANIFEST_SCHEMA_VERSION,
    projects: [],
  };
}

async function ensureDirFor(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile<T>(
  filePath: string,
  fallback: () => T,
): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return fallback();
    }
    throw err;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDirFor(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function readProjectsIndex(): Promise<ProjectsIndex> {
  return readJsonFile(getProjectsIndexPath(), emptyProjectsIndex);
}

export async function writeProjectsIndex(index: ProjectsIndex): Promise<void> {
  await writeJsonFile(getProjectsIndexPath(), index);
}

export async function addProjectToIndex(projectRoot: string): Promise<boolean> {
  const normalized = path.resolve(projectRoot);
  const index = await readProjectsIndex();
  if (index.projects.includes(normalized)) {
    return false;
  }
  index.projects.push(normalized);
  await writeProjectsIndex(index);
  return true;
}

export async function ensureProjectManifest(
  projectRoot: string,
): Promise<{ path: string; created: boolean }> {
  const manifestPath = getProjectManifestPath(projectRoot);
  try {
    await fs.access(manifestPath);
    return { path: manifestPath, created: false };
  } catch {
    await writeJsonFile(manifestPath, emptyManifest());
    return { path: manifestPath, created: true };
  }
}

export async function projectManifestExists(
  projectRoot: string,
): Promise<boolean> {
  try {
    await fs.access(getProjectManifestPath(projectRoot));
    return true;
  } catch {
    return false;
  }
}

export async function readProjectManifest(
  projectRoot: string,
): Promise<SkliManifest> {
  const manifestPath = getProjectManifestPath(projectRoot);
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw) as SkliManifest;
}

export async function writeProjectManifest(
  projectRoot: string,
  manifest: SkliManifest | ProjectManifest,
): Promise<void> {
  await writeJsonFile(getProjectManifestPath(projectRoot), manifest);
}

export function getPackageEntry(
  manifest: SkliManifest,
  kind: PackageKind,
  id: string,
): PackageEntry | undefined {
  return manifest[KIND_TO_MAP[kind]][id];
}

export function addPackageToManifest(
  manifest: SkliManifest,
  kind: PackageKind,
  id: string,
  entry: PackageEntry,
): SkliManifest {
  const mapKey = KIND_TO_MAP[kind];
  return {
    ...manifest,
    [mapKey]: {
      ...manifest[mapKey],
      [id]: entry,
    },
  };
}

export function removePackageFromManifest(
  manifest: SkliManifest,
  kind: PackageKind,
  id: string,
): SkliManifest {
  const mapKey = KIND_TO_MAP[kind];
  const { [id]: _removed, ...rest } = manifest[mapKey];
  return {
    ...manifest,
    [mapKey]: rest,
  };
}

export async function readGlobalManifest(): Promise<SkliManifest> {
  return readJsonFile(getGlobalManifestPath(), emptyManifest);
}

export async function writeGlobalManifest(
  manifest: SkliManifest,
): Promise<void> {
  await writeJsonFile(getGlobalManifestPath(), manifest);
}
