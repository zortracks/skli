import type { Command } from "commander";
import { selectionFromArgs } from "./refresh-package.js";
import { runRemove } from "./remove-package.js";

type RemoveCliOptions = {
  all?: boolean;
  global?: boolean;
  debug?: boolean;
  keepSources?: boolean;
  removeSources?: boolean;
};

export function registerRemoveCommand(program: Command): void {
  program
    .command("remove")
    .description(
      "Uninstall Packages from the Manifest (and optionally delete files)",
    )
    .argument(
      "[args...]",
      "Optional: <ide> | <ide|all> <kind> | <ide|all> <kind> <id> | <install-path>",
    )
    .option(
      "--all",
      "Select all matching Packages (required unless a Package id or install path is given)",
    )
    .option("-g, --global", "Use the global Manifest and IDE home paths")
    .option("--debug", "Print diagnostic logs to stderr")
    .option(
      "--keep-sources",
      "repos Packages: remove Manifest entry / ides but keep install destinations on disk",
    )
    .option(
      "--remove-sources",
      "local Packages: also delete the Package path on disk",
    )
    .action(async (args: string[], options: RemoveCliOptions) => {
      const projectRoot = process.cwd();
      const global = Boolean(options.global);
      const keepSources = Boolean(options.keepSources);
      const removeSources = Boolean(options.removeSources);

      if (keepSources && removeSources) {
        console.error(
          "Error: --keep-sources cannot be combined with --remove-sources.",
        );
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

      try {
        const { results } = await runRemove({
          selection: parsed.selection,
          global,
          projectRoot,
          debug: options.debug,
          keepSources,
          removeSources,
        });

        if (results.length === 0) {
          console.log("No Packages matched for remove.");
          return;
        }

        for (const r of results) {
          const ideList = r.removedIdes.join(",");
          if (r.status === "partial") {
            console.log(
              `Removed ${r.kind} "${r.id}" from IDE(s) ${ideList} (entry kept for remaining IDEs).`,
            );
          } else if (r.source === "local") {
            const disk =
              r.deletedPaths.length > 0
                ? ` Deleted ${r.deletedPaths.length} path(s).`
                : "";
            console.log(
              `Removed local ${r.kind} "${r.id}" from Manifest.${disk}`,
            );
          } else {
            const disk =
              r.deletedPaths.length > 0
                ? ` Deleted ${r.deletedPaths.length} destination(s).`
                : keepSources
                  ? " Kept install destinations on disk."
                  : "";
            console.log(
              `Removed ${r.kind} "${r.id}" from Manifest (IDE(s) ${ideList}).${disk}`,
            );
          }
        }

        if (options.debug) {
          console.error(`[skli debug] remove done count=${results.length}`);
        }
      } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });
}
