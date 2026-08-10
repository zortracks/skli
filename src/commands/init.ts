import path from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import type { Command } from "commander";
import { findGitRoot } from "../lib/git.js";
import {
  addProjectToIndex,
  emptyProjectManifest,
  isVersioningMode,
  normalizeTags,
  projectManifestExists,
  readProjectManifest,
  VERSIONING_MODES,
  type ProjectManifest,
  type ProjectMeta,
  type VersioningMode,
  writeProjectManifest,
} from "../lib/manifests.js";
import { getProjectManifestPath } from "../lib/paths.js";

type InitOptions = {
  name?: string;
  description?: string;
  versioning?: string;
  tag?: string[];
  tags?: string;
  yes?: boolean;
  force?: boolean;
};

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

function parseTagsFromOptions(options: InitOptions): string[] | undefined {
  const parts: string[] = [];
  if (options.tag) {
    parts.push(...options.tag);
  }
  if (options.tags !== undefined) {
    parts.push(...options.tags.split(","));
  }
  if (options.tag === undefined && options.tags === undefined) {
    return undefined;
  }
  return normalizeTags(parts);
}

async function collectMeta(
  gitRoot: string,
  options: InitOptions,
): Promise<ProjectMeta | null> {
  const defaultName = path.basename(gitRoot);
  const defaultDescription = "";
  const defaultVersioning: VersioningMode = "tag";
  const defaultTags: string[] = [];

  const flagsProvided = {
    name: options.name !== undefined,
    description: options.description !== undefined,
    versioning: options.versioning !== undefined,
    tags: options.tag !== undefined || options.tags !== undefined,
  };

  if (options.versioning !== undefined && !isVersioningMode(options.versioning)) {
    console.error(
      `Error: invalid versioning "${options.versioning}". Expected ${VERSIONING_MODES.join(", ")}.`,
    );
    return null;
  }

  const needsPrompt =
    !options.yes &&
    (!flagsProvided.name ||
      !flagsProvided.description ||
      !flagsProvided.versioning ||
      !flagsProvided.tags);

  if (needsPrompt && !process.stdin.isTTY) {
    console.error(
      "Error: missing init options in non-interactive mode. Pass flags or use -y/--yes.",
    );
    return null;
  }

  let name = options.name ?? defaultName;
  let description = options.description ?? defaultDescription;
  let versioning: VersioningMode =
    options.versioning !== undefined
      ? (options.versioning as VersioningMode)
      : defaultVersioning;
  let tags = parseTagsFromOptions(options) ?? defaultTags;

  if (needsPrompt) {
    if (!flagsProvided.name) {
      name = await input({
        message: "Project name",
        default: defaultName,
      });
    }
    if (!flagsProvided.description) {
      description = await input({
        message: "Project description",
        default: defaultDescription,
      });
    }
    if (!flagsProvided.versioning) {
      versioning = await select({
        message: "Versioning",
        choices: VERSIONING_MODES.map((mode) => ({
          name: mode,
          value: mode,
        })),
        default: defaultVersioning,
      });
    }
    if (!flagsProvided.tags) {
      const raw = await input({
        message: "Tags (comma-separated)",
        default: "",
      });
      tags = normalizeTags(raw.split(","));
    }
  }

  name = name.trim();
  if (!name) {
    console.error("Error: project name cannot be empty.");
    return null;
  }

  return {
    name,
    description,
    versioning,
    tags,
  };
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a project .skli/skli.json manifest")
    .option("--name <name>", "Project name")
    .option("--description <text>", "Project description")
    .option(
      "--versioning <mode>",
      `Versioning mode: ${VERSIONING_MODES.join(", ")}`,
    )
    .option(
      "--tag <tag>",
      "Project tag (repeatable)",
      (value: string, previous: string[] | undefined) =>
        previous ? previous.concat(value) : [value],
    )
    .option("--tags <list>", "Comma-separated project tags")
    .option("-y, --yes", "Use defaults for missing fields; auto-confirm git parent")
    .option("-f, --force", "Overwrite project metadata if manifest already exists")
    .action(async (options: InitOptions) => {
      const cwd = process.cwd();
      const gitRoot = findGitRoot(cwd);

      if (!gitRoot) {
        console.error(
          "Error: no git repository found in this directory or any parent.",
        );
        process.exitCode = 1;
        return;
      }

      if (!samePath(cwd, gitRoot)) {
        let allowed = Boolean(options.yes);
        if (!allowed) {
          if (!process.stdin.isTTY) {
            console.error(
              `Error: current directory is not the git root (${gitRoot}). Re-run from the root, pass -y, or use a TTY to confirm.`,
            );
            process.exitCode = 1;
            return;
          }
          allowed = await confirm({
            message: `Create project manifest at git root ${gitRoot}?`,
            default: true,
          });
        }
        if (!allowed) {
          console.log("Init cancelled.");
          return;
        }
      }

      const exists = await projectManifestExists(gitRoot);
      if (exists && !options.force) {
        console.error(
          `Error: project manifest already exists (${getProjectManifestPath(gitRoot)}). Use --force to overwrite metadata.`,
        );
        process.exitCode = 1;
        return;
      }

      const meta = await collectMeta(gitRoot, options);
      if (!meta) {
        process.exitCode = 1;
        return;
      }

      let manifest: ProjectManifest = emptyProjectManifest(meta);

      if (exists && options.force) {
        try {
          const previous = await readProjectManifest(gitRoot);
          manifest = {
            ...manifest,
            skills: previous.skills ?? {},
            rules: previous.rules ?? {},
            agents: previous.agents ?? {},
          };
        } catch {
          // keep empty maps
        }
      }

      await writeProjectManifest(gitRoot, manifest);
      await addProjectToIndex(gitRoot);

      console.log(`Initialized project manifest at ${getProjectManifestPath(gitRoot)}`);
    });
}
