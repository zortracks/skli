import fs from "node:fs/promises";
import path from "node:path";
import type { ResolvedInstallDir } from "./ide-targets.js";

function referencesFilter(
  skillRoot: string,
): (src: string) => boolean {
  const referencesDir = path.resolve(skillRoot, "references");
  return (src: string) => {
    const resolved = path.resolve(src);
    if (
      resolved === referencesDir ||
      resolved.startsWith(referencesDir + path.sep)
    ) {
      return false;
    }
    return true;
  };
}

export function packageDestination(
  localSource: string,
  id: string,
  dir: string,
  isDirectory: boolean,
): string {
  return isDirectory
    ? path.join(dir, id)
    : path.join(dir, path.basename(localSource));
}

export async function copyPackageToTargets(
  localSource: string,
  id: string,
  dirs: ResolvedInstallDir[],
  options: {
    debug?: boolean;
    noReferences?: boolean;
    /** When true, remove destination path before copy. */
    emptyFirst?: boolean;
  },
): Promise<string[]> {
  const stat = await fs.stat(localSource);
  const written: string[] = [];
  const filter =
    options.noReferences && stat.isDirectory()
      ? referencesFilter(localSource)
      : undefined;

  for (const d of dirs) {
    await fs.mkdir(d.dir, { recursive: true });
    const dest = packageDestination(
      localSource,
      id,
      d.dir,
      stat.isDirectory(),
    );

    const samePath = path.resolve(localSource) === path.resolve(dest);
    if (options.debug) {
      console.error(
        `[skli debug] copy ${localSource} → ${dest}` +
          (samePath ? " (skip, identical path)" : "") +
          (options.noReferences ? " (no-references)" : "") +
          (options.emptyFirst ? " (empty-first)" : ""),
      );
    }

    if (!samePath) {
      if (options.emptyFirst) {
        await fs.rm(dest, { recursive: true, force: true });
      }
      await fs.cp(localSource, dest, {
        recursive: true,
        force: true,
        filter,
      });
    } else if (options.noReferences && stat.isDirectory()) {
      await fs
        .rm(path.join(dest, "references"), { recursive: true, force: true })
        .catch(() => {});
    }
    written.push(dest);
  }

  return written;
}
