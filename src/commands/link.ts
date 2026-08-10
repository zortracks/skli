import type { Command } from "commander";
import { registerLinkCommand as register } from "../lib/link-cli.js";

export function registerLinkCommand(program: Command): void {
  register(program);
}
