import fs from "node:fs/promises";
import path from "node:path";
import Arborist from "@npmcli/arborist";
import type { RequiredPackages } from "../fetch-and-download.js";
import { readJsonFile } from "../lib/fs-helpers.js";
import type { DependenciesType } from "../npm-graph/module.js";

export async function readFromPackageJson(
  packageJsonFilePath: string,
  include: DependenciesType,
): Promise<RequiredPackages> {
  // biome-ignore lint/suspicious/noExplicitAny: we don't know
  const packageFile: Record<string, any> = readJsonFile(packageJsonFilePath);
  const packages: RequiredPackages = {};

  if (include.dependencies) {
    for (const [packageName, version] of Object.entries(
      packageFile.dependencies || {},
    )) {
      addPackageAndVersion(packageName, version as string, packages);
    }

    // Add optional deps
    for (const [packageName, version] of Object.entries(
      packageFile.optionalDependencies || {},
    )) {
      addPackageAndVersion(packageName, version as string, packages);
    }
  }

  if (include.devDependencies) {
    for (const [packageName, version] of Object.entries(
      packageFile.devDependencies || {},
    )) {
      addPackageAndVersion(packageName, version as string, packages);
    }
  }

  if (include.peerDependencies) {
    for (const [packageName, version] of Object.entries(
      packageFile.peerDependencies || {},
    )) {
      addPackageAndVersion(packageName, version as string, packages);
    }
  }

  // Don't support override

  return packages;
}

export async function readFromLocal(
  rootFolder: string,
): Promise<RequiredPackages> {
  const arb = new Arborist({
    path: rootFolder,
  });

  try {
    // Loading from the package lock over node modules as package lock contain optional deps that were not downloaded
    // For example, `@biomejs/cli-win-32-x64` when on macOS, so only `@biomejs/cli-darwin-arm64`
    await arb.loadVirtual();
  } catch (e) {
    if ((e as { code: string }).code === "ENOLOCK") {
      return readFromPackageJson(path.join(rootFolder, "package.json"), {
        dependencies: true,
        peerDependencies: true,
        devDependencies: true,
      });
    }

    throw e;
  }

  // biome-ignore lint/style/noNonNullAssertion: we load the virtual tree before
  const tree = arb.virtualTree!;

  const allDeps = await tree.querySelectorAll("*");

  const packages: RequiredPackages = {};

  for (const dep of allDeps) {
    // Don't include current package
    if (dep.isRoot) {
      continue;
    }
    addPackageFromNode(dep, packages);
  }

  return packages;
}

function addPackageFromNode(node: Arborist.Node, packages: RequiredPackages) {
  const version = (node as unknown as { version: string }).version;

  addPackageAndVersion(node.name, version, packages);
}

function addPackageAndVersion(
  packageName: string,
  version: string,
  packages: RequiredPackages,
) {
  if (packages[packageName]) {
    packages[packageName].push(version);
  } else {
    packages[packageName] = [version];
  }
}
