import fs from "node:fs";
import path from "node:path";

/** Walk up from startDir until a `.git` entry (file or directory) is found. */
export function findGitRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const gitPath = path.join(current, ".git");
    try {
      fs.statSync(gitPath);
      return current;
    } catch {
      // keep walking
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
