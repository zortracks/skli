import type { Command } from "commander";
import { registerRefreshCommand } from "../lib/refresh-cli.js";

export function registerUpdateCommand(program: Command): void {
  registerRefreshCommand(program, "update");
}
