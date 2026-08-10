import type { Command } from "commander";
import { runUnlink } from "./unlink-package.js";

type UnlinkCliOptions = {
  debug?: boolean;
  keepSources?: boolean;
};

export function registerUnlinkCommand(program: Command): void {
  program
    .command("unlink")
    .description(
      "Remove a ProjectManifest link by owner/repo or GitHub URL",
    )
    .argument(
      "<id>",
      "Link key owner/repo, or GitHub Source URL / shorthand",
    )
    .option("--debug", "Print diagnostic logs to stderr")
    .option(
      "--keep-sources",
      "Remove link metadata but keep install destinations on disk",
    )
    .action(async (id: string, options: UnlinkCliOptions) => {
      const projectRoot = process.cwd();

      try {
        const result = await runUnlink({
          id,
          projectRoot,
          debug: options.debug,
          keepSources: Boolean(options.keepSources),
        });

        if (result.keptSources) {
          console.log(
            `Unlinked "${result.linkKey}". Kept install destinations on disk.`,
          );
          return;
        }

        if (result.results.length === 0) {
          console.log(
            `Unlinked "${result.linkKey}". No destinations to delete.`,
          );
          return;
        }

        let deleted = 0;
        for (const r of result.results) {
          deleted += r.deletedPaths.length;
          console.log(
            `  ${r.kind} "${r.id}" — deleted ${r.deletedPaths.length} destination(s) (IDE(s) ${r.removedIdes.join(",")}).`,
          );
        }
        console.log(
          `Unlinked "${result.linkKey}". Deleted ${deleted} destination(s).`,
        );

        if (options.debug) {
          console.error(
            `[skli debug] unlink done packages=${result.results.length}`,
          );
        }
      } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : err);
        process.exitCode = 1;
      }
    });
}
