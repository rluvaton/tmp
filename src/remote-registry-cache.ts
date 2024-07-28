import fs from "node:fs/promises";
import fastq, { type queueAsPromised } from "fastq";
import { glob } from "glob";
import { downloadPackage } from "./downloader/index.js";
import { readJsonFile, writeJsonFile } from "./lib/fs-helpers.js";
import type { NeededPackage } from "./npm-graph/needed-packages.js";

export interface BuildRegistryOptions {
  verdaccioLocalRegistryData: string;
  outputFile: string;
  concurrency: number;
}

// the string is the pkgId - e.g. @babel/generator@7.15.0
export type RegistryData = Set<string>;

let registryData: RegistryData = new Set<string>();

export async function buildRegistryFromAll(
  allPath: string,
  outputPath: string,
) {
  let registryData: string[] = [];
  const current: Record<string, { latest: string; versions: string[] }> =
    await readJsonFile(allPath);

  for (const [name, { versions }] of Object.entries(current)) {
    registryData = registryData.concat(versions.map((ver) => `${name}@${ver}`));
  }

  await writeJsonFile(outputPath, registryData);
}

export async function buildRegistry(options: BuildRegistryOptions) {
  let registryData: string[] = [];
  const allPackagesPath = await getAllPackagesPathForVerdaccio(
    options.verdaccioLocalRegistryData,
  );

  const parseQueue: queueAsPromised<string> = fastq.promise(
    async (packageJsonFilePath) => {
      const fileContent = (await fs.readFile(packageJsonFilePath)).toString();
      const parsed = JSON.parse(fileContent);

      const versions = Object.keys(parsed.versions || {});

      registryData = registryData.concat(
        versions.map((ver) => `${parsed.name}@${ver}`),
      );
    },
    options.concurrency,
  );

  await Promise.all(allPackagesPath.map((item) => parseQueue.push(item)));

  await parseQueue.drained();

  await fs.writeFile(options.outputFile, JSON.stringify(registryData));
}

export async function getAllPackagesPathForVerdaccio(
  verdaccioRegistryDataPath: string,
) {
  return glob.glob("**/package.json", {
    cwd: verdaccioRegistryDataPath,
    nodir: true,
    absolute: true,
  });
}

export async function loadRegistry(
  registryDataFilePath: string,
): Promise<void> {
  const allPackages: string[] = JSON.parse(
    (await fs.readFile(registryDataFilePath)).toString(),
  );

  registryData = new Set(allPackages);
}

export function doesRegistryAlreadyHave(
  packageDetails: NeededPackage,
): boolean {
  return registryData.has(`${packageDetails.name}@${packageDetails.version}`);
}
