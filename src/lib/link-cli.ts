import type { Command } from "commander";
import { IDE_IDS, parseIdeArgument } from "./ide-targets.js";
import {
  isVersioningMode,
  VERSIONING_MODES,
  type VersioningMode,
} from "./manifests.js";
import { runLink } from "./link-package.js";

type LinkCliOptions = {
  all?: boolean;
  allSkills?: boolean;
  allRules?: boolean;
  allAgents?: boolean;
  versioning?: string;
  gitignore?: boolean;
  debug?: boolean;
};

export function registerLinkCommand(program: Command): void {
  program
    .command("link")
    .description(
      "Link a remote ProjectManifest and copy selected packages into IDE dirs",
    )
    .argument(
      "<ide>",
      `Target IDE(s), comma-separated: ${IDE_IDS.join(", ")}`,
    )
    .argument("<source>", "GitHub repository Source (owner/repo[@ref] or URL)")
    .option("--all", "Select all skills, rules, and agents (no prompt)")
    .option("--all-skills", "Select all remote skills")
    .option("--all-rules", "Select all remote rules")
    .option("--all-agents", "Select all remote agents")
    .option(
      "--versioning <mode>",
      `Link versioning mode: ${VERSIONING_MODES.join(" | ")}`,
      "tag",
    )
    .option(
      "--gitignore",
      "Project scope: add copy destinations to .gitignore",
    )
    .option("--debug", "Print diagnostic logs to stderr")
    .action(
      async (ideArg: string, source: string, options: LinkCliOptions) => {
        const ideParsed = parseIdeArgument(ideArg);
        if (!ideParsed.ok) {
          console.error(ideParsed.error);
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

        try {
          const result = await runLink({
            ides: ideParsed.ides,
            source,
            versioning,
            projectRoot: process.cwd(),
            debug: options.debug,
            gitignore: Boolean(options.gitignore),
            kindFlags: {
              all: Boolean(options.all),
              allSkills: Boolean(options.allSkills),
              allRules: Boolean(options.allRules),
              allAgents: Boolean(options.allAgents),
            },
          });

          console.log(
            `Linked "${result.linkKey}"@${result.entry.version}` +
              ` (${result.copied.length} package(s)` +
              `, IDE(s) ${result.entry.ides.join(",")}).`,
          );
          for (const c of result.copied) {
            console.log(
              `  ${c.kind} "${c.id}" → ${c.destinations.length} target(s)`,
            );
          }
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : err);
          process.exitCode = 1;
        }
      },
    );
}
