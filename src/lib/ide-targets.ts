import path from "node:path";
import { getHomeDir } from "./paths.js";
import type { PackageKind } from "./manifests.js";

export const IDE_IDS = [
  "cursor",
  "claude",
  "codex",
  "copilot",
  "windsurf",
] as const;

export type IdeId = (typeof IDE_IDS)[number];

export function isIdeId(value: string): value is IdeId {
  return (IDE_IDS as readonly string[]).includes(value);
}

/** Primary install directories relative to project root or absolute under home. */
type IdePathLayout = {
  /** Relative to project root (or absolute if starts with ~ handled via home). */
  project: Partial<Record<PackageKind, string>>;
  global: Partial<Record<PackageKind, string>>;
};

/**
 * Primary PackageKind install directories per IdeId (project vs global).
 * Compat/secondary locations are documented in specs only.
 */
const IDE_PATHS: Record<IdeId, IdePathLayout> = {
  cursor: {
    project: {
      rule: ".cursor/rules",
      skill: ".cursor/skills",
      agent: ".cursor/agents",
    },
    global: {
      rule: ".cursor/rules",
      skill: ".cursor/skills",
      agent: ".cursor/agents",
    },
  },
  claude: {
    project: {
      rule: ".claude/rules",
      skill: ".claude/skills",
      agent: ".claude/agents",
    },
    global: {
      rule: ".claude/rules",
      skill: ".claude/skills",
      agent: ".claude/agents",
    },
  },
  codex: {
    project: {
      // AGENTS.md lives at project root; directory target is the project root.
      rule: ".",
      skill: ".agents/skills",
    },
    global: {
      rule: ".codex/rules",
      skill: ".agents/skills",
    },
  },
  copilot: {
    project: {
      skill: ".github/skills",
    },
    global: {
      skill: ".copilot/skills",
    },
  },
  windsurf: {
    project: {
      rule: ".windsurf/rules",
      skill: ".windsurf/skills",
    },
    global: {
      skill: path.join(".codeium", "windsurf", "skills"),
    },
  },
};

export type ParseIdeResult =
  | { ok: true; ides: IdeId[] }
  | { ok: false; error: string };

/** Parse CSV IdeId list (trim, dedupe). No special "all" value. */
export function parseIdeArgument(raw: string): ParseIdeResult {
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      ok: false,
      error: `Error: ide is required. Expected one or more of: ${IDE_IDS.join(", ")} (comma-separated).`,
    };
  }

  const ides: IdeId[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    if (!isIdeId(part)) {
      return {
        ok: false,
        error: `Error: invalid ide "${part}". Expected ${IDE_IDS.join(", ")} (comma-separated).`,
      };
    }
    if (!seen.has(part)) {
      seen.add(part);
      ides.push(part);
    }
  }

  return { ok: true, ides };
}

export type ResolvedInstallDir = {
  ide: IdeId;
  kind: PackageKind;
  scope: "project" | "global";
  dir: string;
};

function resolveSegment(
  segment: string,
  projectRoot: string,
  scope: "project" | "global",
): string {
  if (scope === "project") {
    return path.resolve(projectRoot, segment);
  }
  return path.resolve(getHomeDir(), segment);
}

export function resolveInstallDirs(options: {
  ides: IdeId[];
  kind: PackageKind;
  global: boolean;
  projectRoot: string;
}): ResolvedInstallDir[] {
  const scope = options.global ? "global" : "project";
  const results: ResolvedInstallDir[] = [];

  for (const ide of options.ides) {
    const layout = IDE_PATHS[ide];
    const map = options.global ? layout.global : layout.project;
    const segment = map[options.kind];
    if (!segment) {
      continue;
    }
    results.push({
      ide,
      kind: options.kind,
      scope,
      dir: resolveSegment(segment, options.projectRoot, scope),
    });
  }

  return results;
}

/** True if a CLI arg looks like an install-path (not an IdeId / kind token). */
export function looksLikeInstallPath(raw: string): boolean {
  return (
    raw.includes("/") ||
    raw.includes("\\") ||
    raw.startsWith(".") ||
    path.isAbsolute(raw)
  );
}

export type ResolvedInstallPath = {
  ide: IdeId;
  kind: PackageKind;
  id: string;
};

type InstallPathCandidate = ResolvedInstallPath & {
  specificity: number;
};

/**
 * Reverse-resolve a filesystem path under a primary IdeId layout to
 * `{ ide, kind, id }`. Prefers the longest layout segment match.
 */
export function resolveInstallPath(options: {
  rawPath: string;
  projectRoot: string;
  global: boolean;
}):
  | { ok: true; resolved: ResolvedInstallPath }
  | { ok: false; error: string } {
  const scope = options.global ? "global" : "project";
  const abs = options.global
    ? path.resolve(getHomeDir(), options.rawPath)
    : path.resolve(options.projectRoot, options.rawPath);

  const candidates: InstallPathCandidate[] = [];

  for (const ide of IDE_IDS) {
    const layout = IDE_PATHS[ide];
    const map = options.global ? layout.global : layout.project;
    for (const kind of ["skill", "rule", "agent"] as const) {
      const segment = map[kind];
      if (segment === undefined) {
        continue;
      }
      const dir = resolveSegment(segment, options.projectRoot, scope);
      const rel = path.relative(dir, abs);
      if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
        continue;
      }
      const parts = rel.split(path.sep).filter(Boolean);
      if (parts.length !== 1) {
        continue;
      }
      const id = path.parse(parts[0]).name;
      if (!id) {
        continue;
      }
      // Longer relative segments win; treat "." (project root) as least specific.
      const specificity =
        segment === "." ? 0 : segment.split(/[/\\]/).filter(Boolean).length;
      candidates.push({ ide, kind, id, specificity });
    }
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: `Error: path "${options.rawPath}" does not match any known IDE install layout.`,
    };
  }

  candidates.sort((a, b) => b.specificity - a.specificity);
  const best = candidates[0];
  const tied = candidates.filter((c) => c.specificity === best.specificity);
  if (tied.length > 1) {
    const distinct = new Set(
      tied.map((c) => `${c.ide}/${c.kind}/${c.id}`),
    );
    if (distinct.size > 1) {
      return {
        ok: false,
        error:
          `Error: path "${options.rawPath}" is ambiguous across IDE layouts: ` +
          [...distinct].join(", ") +
          ".",
      };
    }
  }

  return {
    ok: true,
    resolved: { ide: best.ide, kind: best.kind, id: best.id },
  };
}
