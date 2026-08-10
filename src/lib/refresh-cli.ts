import type { Command } from "commander";
import { ensureGitignoreSectionEntries } from "./gitignore.js";
import { sourceRelativeToProject } from "./manifests.js";
import {
  isSinglePackageSelection,
  runRefresh,
  selectionFromArgs,
  type RefreshMode,
} from "./refresh-package.js";

type RefreshCliOptions = {
  all?: boolean;
  global?: boolean;
  debug?: boolean;
  version?: string;
  gitignore?: boolean;
};

export function registerRefreshCommand(
  program: Command,
  mode: RefreshMode,
): void {
  const description =
    mode === "update"
      ? "Upgrade installed repos Packages and linked manifests"
      : "Re-fetch repos Packages and linked manifests at pinned version";

  const cmd = program
    .command(mode)
    .description(description)
    .argument(
      "[args...]",
      "Optional: <ide> | <ide|all> <kind> | <ide|all> <kind> <id> | <install-path>",
    )
    .option(
      "--all",
      "Select all matching Packages (required unless a Package id or install path is given)",
    )
    .option("-g, --global", "Use the global Manifest and IDE home paths")
    .option("--debug", "Print diagnostic logs to stderr");

  if (mode === "update") {
    cmd
      .option(
        "--version <ref>",
        "Single Package only: fetch and pin this version ref",
      )
      .option(
        "--gitignore",
        "Project scope: add refreshed destinations to .gitignore",
      );
  }

  cmd.action(async (args: string[], options: RefreshCliOptions) => {
    const projectRoot = process.cwd();
    const global = Boolean(options.global);

    if (mode === "update" && options.gitignore && global) {
      console.error("Error: --gitignore cannot be combined with --global.");
      process.exitCode = 1;
      return;
    }

    const parsed = selectionFromArgs(args ?? [], {
      allFlag: Boolean(options.all),
      projectRoot,
      global,
    });
    if (!parsed.ok) {
      console.error(parsed.error);
      process.exitCode = 1;
      return;
    }

    const explicitVersion =
      mode === "update" ? options.version?.trim() : undefined;
    if (explicitVersion) {
      if (options.all || !isSinglePackageSelection(parsed.selection)) {
        console.error(
          "Error: --version requires a single Package target (<ide|all> <kind> <id> or <install-path>).",
        );
        process.exitCode = 1;
        return;
      }
    }

    try {
      const { results } = await runRefresh({
        mode,
        selection: parsed.selection,
        global,
        projectRoot,
        debug: options.debug,
        explicitVersion: explicitVersion || undefined,
      });

      if (results.length === 0) {
        console.log(`No repos Packages or links matched for ${mode}.`);
        return;
      }

      let changed = 0;
      let skipped = 0;
      const gitignoreDests: string[] = [];

      for (const r of results) {
        if (r.status === "skipped") {
          skipped += 1;
          console.log(
            `Skipped ${r.kind} "${r.id}"@${r.version} (${r.reason}).`,
          );
          if (mode === "update" && options.gitignore) {
            gitignoreDests.push(...r.destinations);
          }
          continue;
        }
        changed += 1;
        const verb = r.status === "updated" ? "Updated" : "Restored";
        const linked = r.linked ? " (linked)" : "";
        console.log(
          `${verb} ${r.kind} "${r.id}"@${r.version}${linked} → ${r.destinations.length} target(s).`,
        );
        if (mode === "update" && options.gitignore) {
          gitignoreDests.push(...r.destinations);
        }
      }

      if (mode === "update" && options.gitignore && gitignoreDests.length > 0) {
        const relative = gitignoreDests
          .map((d) => sourceRelativeToProject(projectRoot, d))
          .filter((p) => p.length > 0 && !p.startsWith(".."));
        const added = await ensureGitignoreSectionEntries(
          projectRoot,
          relative,
        );
        if (added.length > 0) {
          console.log(
            `Added ${added.length} path(s) to .gitignore (# Ignored AI IDEs références).`,
          );
        }
      }

      if (options.debug) {
        console.error(
          `[skli debug] ${mode} done changed=${changed} skipped=${skipped}`,
        );
      }
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });
}
