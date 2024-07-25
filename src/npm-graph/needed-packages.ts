import { EventEmitter } from "node:events";
import { getLatestVersionForPackage } from "./module-cache/index.js";
import type { LightModuleVersionInfo } from "./module-cache/light-module-info.js";

interface SingleNeededPackageVersion {
  url: string;
  isLatest: boolean;
  shouldRemoveProvenance: boolean;
  shouldRemoveCustomRegistry: boolean;
}

export interface NeededPackage extends SingleNeededPackageVersion {
  name: string;
  version: string;
}

interface NeededPackages {
  [version: string]: SingleNeededPackageVersion;
}

const neededPackagesEmitter = new EventEmitter<{
  newPackage: [NeededPackage];
}>();

// Package name to versions
const neededPackages: Map<string, NeededPackages> = new Map();

export function getAllNeededPackages(): NeededPackage[] {
  return Array.from(neededPackages.entries()).flatMap(([name, versions]) =>
    Object.entries(versions).map(([version, info]) => ({
      name,
      version,
      ...info,
    })),
  );
}

export function getNumberOfPackagesToDownload(): number {
  return Array.from(neededPackages.entries()).reduce(
    (acc, [, versions]) => acc + Object.keys(versions).length,
    0,
  );
}

export function hasNeededPackageVersion(
  name: string,
  version: string,
): boolean {
  return !!neededPackages.get(name)?.[version];
}

export function hasNeededPackage(name: string): boolean {
  return !!neededPackages.get(name);
}

export function getAlreadyNeededPackageVersions(name: string) {
  return Object.keys(neededPackages.get(name) || {});
}

export function addNewNeededPackage(
  name: string,
  packageVersion: LightModuleVersionInfo,
): void {
  const isLatest = getLatestVersionForPackage(name) === packageVersion.version;

  let neededPackage: NeededPackages | undefined = neededPackages.get(name);

  if (!neededPackage) {
    neededPackage = {};
    neededPackages.set(name, neededPackage);
  } else if (neededPackage[packageVersion.version]) {
    // Already exists
    return;
  }

  neededPackage[packageVersion.version] = {
    isLatest,
    url: packageVersion.dist.tarball,
    shouldRemoveProvenance: !!packageVersion.publishConfig?.provenance,
    shouldRemoveCustomRegistry: !!packageVersion.publishConfig?.registry,
  };

  neededPackagesEmitter.emit("newPackage", {
    name,
    version: packageVersion.version,
    ...neededPackage[packageVersion.version],
  });
}

export function listenToNewPackages(
  fn: (neededPackage: NeededPackage) => void,
) {
  neededPackagesEmitter.addListener("newPackage", fn);
}

export function removeNewPackageListener() {
  neededPackagesEmitter.removeAllListeners("newPackage");
}
