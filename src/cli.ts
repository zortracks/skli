import { Command } from "commander";
import { registerAddCommand } from "./commands/add.js";
import { registerInitCommand } from "./commands/init.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerLinkCommand } from "./commands/link.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerRestoreCommand } from "./commands/restore.js";
import { registerUnlinkCommand } from "./commands/unlink.js";
import { registerUpdateCommand } from "./commands/update.js";

const program = new Command();

program
  .name("skli")
  .description(
    "Manage AI IDE skills, rules, and agents like packages",
  )
  // Use -V only so `update --version <ref>` can pin a Package version.
  .version("0.1.0", "-V");

registerInitCommand(program);
registerInstallCommand(program);
registerAddCommand(program);
registerLinkCommand(program);
registerUpdateCommand(program);
registerRestoreCommand(program);
registerRemoveCommand(program);
registerUnlinkCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
