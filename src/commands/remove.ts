import type { Command } from "commander";
import { registerRemoveCommand as register } from "../lib/remove-cli.js";

export function registerRemoveCommand(program: Command): void {
  register(program);
}
