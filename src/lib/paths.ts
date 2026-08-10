import os from "node:os";
import path from "node:path";

export function getHomeDir(): string {
  return os.homedir();
}

export function getGlobalSkliDir(): string {
  return path.join(getHomeDir(), ".skli");
}

export function getGlobalManifestPath(): string {
  return path.join(getGlobalSkliDir(), "skli.json");
}

export function getProjectsIndexPath(): string {
  return path.join(getGlobalSkliDir(), "projects.json");
}

export function getProjectManifestPath(projectRoot: string): string {
  return path.join(projectRoot, ".skli", "skli.json");
}

export function resolveProjectPath(input: string): string {
  return path.resolve(input);
}
