import type { Command } from "commander";
import { registerUnlinkCommand as register } from "../lib/unlink-cli.js";

export function registerUnlinkCommand(program: Command): void {
  register(program);
}
