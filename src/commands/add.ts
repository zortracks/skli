import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { IDE_IDS, isIdeId } from "../lib/ide-targets.js";
import {
  addPackageToManifest,
  isPackageKind,
  packageIdFromPath,
  projectManifestExists,
  readProjectManifest,
  sourceRelativeToProject,
  writeProjectManifest,
} from "../lib/manifests.js";

export function registerAddCommand(program: Command): void {
  program
    .command("add")
    .description(
      "Reference a local package in the project .skli/skli.json manifest",
    )
    .argument("<ide>", `Target IDE: ${IDE_IDS.join(", ")}`)
    .argument("<kind>", "Package kind: skill, rule, or agent")
    .argument("<path>", "Local path to the package (file or directory)")
    .action(async (ideArg: string, kindArg: string, inputPath: string) => {
      if (!isIdeId(ideArg)) {
        console.error(
          `Error: invalid ide "${ideArg}". Expected ${IDE_IDS.join(", ")}.`,
        );
        process.exitCode = 1;
        return;
      }

      if (!isPackageKind(kindArg)) {
        console.error(
          `Error: invalid kind "${kindArg}". Expected skill, rule, or agent.`,
        );
        process.exitCode = 1;
        return;
      }

      const projectRoot = process.cwd();
      const absolutePath = path.resolve(projectRoot, inputPath);

      try {
        await fs.stat(absolutePath);
      } catch {
        console.error(`Error: path does not exist: ${absolutePath}`);
        process.exitCode = 1;
        return;
      }

      if (!(await projectManifestExists(projectRoot))) {
        console.error(
          "Error: project manifest not found (.skli/skli.json). Run `npx @zortracks/skli init` first.",
        );
        process.exitCode = 1;
        return;
      }

      const id = packageIdFromPath(absolutePath);
      const pkgPath = sourceRelativeToProject(projectRoot, absolutePath);
      const manifest = await readProjectManifest(projectRoot);
      const next = addPackageToManifest(manifest, kindArg, id, {
        source: "local",
        path: pkgPath,
        versioning: "none",
        ide: ideArg,
      });
      await writeProjectManifest(projectRoot, next);

      console.log(`Added ${kindArg} "${id}" (${ideArg}) → ${pkgPath}`);
    });
}
