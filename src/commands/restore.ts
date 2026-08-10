import type { Command } from "commander";
import { registerRefreshCommand } from "../lib/refresh-cli.js";

export function registerRestoreCommand(program: Command): void {
  registerRefreshCommand(program, "restore");
}
