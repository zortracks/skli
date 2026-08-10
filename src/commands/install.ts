import type { Command } from "commander";
import { parseGitHubSource } from "../lib/github-source.js";
import {
  parseIdeArgument,
  resolveInstallDirs,
  IDE_IDS,
} from "../lib/ide-targets.js";
import { ensureGitignoreSectionEntries } from "../lib/gitignore.js";
import { installPackage } from "../lib/install-package.js";
import {
  INSTALL_KINDS,
  isInstallKind,
  isVersioningMode,
  sourceRelativeToProject,
  VERSIONING_MODES,
  type VersioningMode,
} from "../lib/manifests.js";

type InstallOptions = {
  global?: boolean;
  debug?: boolean;
  versioning?: string;
  /**
   * Commander maps `--no-references` to `references: false` (default true).
   */
  references?: boolean;
  gitignore?: boolean;
};

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description(
      "Install a skill, rule, or agent from a local path or GitHub URL",
    )
    .argument(
      "<ide>",
      `Target IDE(s), comma-separated: ${IDE_IDS.join(", ")}`,
    )
    .argument("<kind>", "Install kind: skill | rule | agent")
    .argument("<source>", "Local path or GitHub URL")
    .option("-g, --global", "Install into the global user / IDE home paths")
    .option(
      "--versioning <mode>",
      `Package versioning mode: ${VERSIONING_MODES.join(" | ")}`,
      "tag",
    )
    .option(
      "--no-references",
      "Skill only: do not copy the skill references/ directory",
    )
    .option(
      "--gitignore",
      "Project scope: add install destinations to .gitignore",
    )
    .option("--debug", "Print diagnostic logs to stderr")
    .action(
      async (
        ideArg: string,
        kindArg: string,
        source: string,
        options: InstallOptions,
      ) => {
        // Commander --no-* sets `references` to false (default true).
        const noReferences = options.references === false;

        if (options.gitignore && options.global) {
          console.error(
            "Error: --gitignore cannot be combined with --global.",
          );
          process.exitCode = 1;
          return;
        }

        const ideParsed = parseIdeArgument(ideArg);
        if (!ideParsed.ok) {
          console.error(ideParsed.error);
          process.exitCode = 1;
          return;
        }

        if (!isInstallKind(kindArg)) {
          console.error(
            `Error: invalid kind "${kindArg}". Expected ${INSTALL_KINDS.join(", ")}.`,
          );
          process.exitCode = 1;
          return;
        }

        if (noReferences && kindArg !== "skill") {
          console.error(
            'Error: --no-references is only valid with kind "skill".',
          );
          process.exitCode = 1;
          return;
        }

        const versioningRaw = options.versioning ?? "tag";
        if (!isVersioningMode(versioningRaw)) {
          console.error(
            `Error: invalid --versioning "${versioningRaw}". Expected ${VERSIONING_MODES.join(", ")}.`,
          );
          process.exitCode = 1;
          return;
        }
        const versioning: VersioningMode = versioningRaw;

        const projectRoot = process.cwd();
        const dirs = resolveInstallDirs({
          ides: ideParsed.ides,
          kind: kindArg,
          global: Boolean(options.global),
          projectRoot,
        });

        if (options.debug) {
          console.error(
            `[skli debug] ides=${ideParsed.ides.join(",")} kind=${kindArg} scope=${options.global ? "global" : "project"} versioning=${versioning}` +
              (noReferences ? " no-references" : ""),
          );
          for (const d of dirs) {
            console.error(
              `[skli debug] target ide=${d.ide} kind=${d.kind} scope=${d.scope} dir=${d.dir}`,
            );
          }
          if (dirs.length === 0) {
            console.error(
              `[skli debug] no primary install dirs for ide=${ideParsed.ides.join(",")} kind=${kindArg}`,
            );
          }
        }

        const github = parseGitHubSource(source);
        if (!github && ideParsed.ides.length !== 1) {
          console.error(
            "Error: local Package install requires exactly one IDE (source=local uses a single `ide` field).",
          );
          process.exitCode = 1;
          return;
        }

        try {
          const result = await installPackage({
            kind: kindArg,
            source,
            versioning,
            global: Boolean(options.global),
            projectRoot,
            dirs,
            debug: options.debug,
            noReferences,
          });
          console.log(
            `Installed ${kindArg} "${result.id}"` +
              (result.entry.source === "repos"
                ? ` from ${result.entry.repos}@${result.entry.version}`
                : ` (local)`) +
              ` → ${result.destinations.length} target(s).`,
          );

          if (options.gitignore) {
            const relative = result.destinations
              .map((d) => sourceRelativeToProject(projectRoot, d))
              .filter((p) => p.length > 0 && !p.startsWith(".."));
            const added = await ensureGitignoreSectionEntries(
              projectRoot,
              relative,
            );
            if (added.length > 0) {
              console.log(
                `Added ${added.length} path(s) to .gitignore (# Ignored AI IDE references).`,
              );
            }
          }
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : err);
          process.exitCode = 1;
        }
      },
    );
}
