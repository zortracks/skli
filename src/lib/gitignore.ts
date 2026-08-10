import fs from "node:fs/promises";
import path from "node:path";

/** Exact section header written under project `.gitignore`. */
export const GITIGNORE_AI_IDES_SECTION = "# Ignored AI IDEs références";

function toPosixRelative(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Ensure `relativePaths` appear under `# Ignored AI IDEs références` in
 * `{projectRoot}/.gitignore`. Creates the file and/or section if needed.
 * Skips duplicates. Paths should already be project-relative (posix `/`).
 */
export async function ensureGitignoreSectionEntries(
  projectRoot: string,
  relativePaths: string[],
): Promise<string[]> {
  const wanted = [
    ...new Set(
      relativePaths
        .map((p) => toPosixRelative(p.trim()))
        .filter((p) => p.length > 0 && !p.startsWith("#")),
    ),
  ];
  if (wanted.length === 0) {
    return [];
  }

  const gitignorePath = path.join(projectRoot, ".gitignore");
  let raw = "";
  try {
    raw = await fs.readFile(gitignorePath, "utf8");
  } catch {
    raw = "";
  }

  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.length === 0 ? [] : raw.split(/\r?\n/);

  // Drop a single trailing empty line from split so we can re-join cleanly.
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  let sectionIndex = lines.findIndex(
    (line) => line.trim() === GITIGNORE_AI_IDES_SECTION,
  );

  if (sectionIndex === -1) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(GITIGNORE_AI_IDES_SECTION);
    sectionIndex = lines.length - 1;
    for (const entry of wanted) {
      lines.push(entry);
    }
    await fs.writeFile(gitignorePath, lines.join(eol) + eol, "utf8");
    return wanted;
  }

  let end = sectionIndex + 1;
  const existing = new Set<string>();
  while (end < lines.length) {
    const line = lines[end];
    if (line.trimStart().startsWith("#")) {
      break;
    }
    const trimmed = line.trim();
    if (trimmed) {
      existing.add(trimmed);
    }
    end += 1;
  }

  const missing = wanted.filter((p) => !existing.has(p));
  if (missing.length === 0) {
    return [];
  }

  lines.splice(end, 0, ...missing);
  await fs.writeFile(gitignorePath, lines.join(eol) + eol, "utf8");
  return missing;
}
