import type * as npm from "@npm/types";
import semver from "semver";
import { getModuleCache } from "./module-cache.js";
import {
  getAlreadyNeededPackageVersions,
  hasNeededPackage,
} from "./needed-packages.js";

export interface DependenciesType {
  dependencies?: boolean;
  devDependencies?: boolean;
  peerDependencies?: boolean;
  bundleDependencies?: boolean;
  bundledDependencies?: boolean;
}

export function getBasedOnDistTag(
  packageName: string,
  distTag: string,
): npm.PackumentVersion | undefined {
  const packageInfo = getModuleCache(packageName)?.info;

  if (!packageInfo) {
    return;
  }

  const underlyingVersion = packageInfo["dist-tags"]?.[distTag];

  if (!underlyingVersion) {
    return;
  }

  return packageInfo.versions?.[underlyingVersion];
}

export function getSpecificPackageVersion(
  packageName: string,
  versionRangeOrDistTag: string,
  options: { preferAlreadyDownloaded?: boolean } = {},
): npm.PackumentVersion | undefined {
  const packageInfo = getModuleCache(packageName);

  if (!packageInfo) {
    return;
  }

  return (
    getBasedOnDistTag(packageName, versionRangeOrDistTag) ||
    getBasedOnVersionRange(packageName, versionRangeOrDistTag, options)
  );
}

export function getBasedOnVersionRange(
  packageName: string,
  versionRange: string,
  {
    preferAlreadyDownloaded = false,
  }: { preferAlreadyDownloaded?: boolean } = {},
): npm.PackumentVersion | undefined {
  const packageInfo = getModuleCache(packageName);

  if (!packageInfo) {
    return;
  }

  const exactVersion = packageInfo.info.versions?.[versionRange];

  if (exactVersion) {
    return exactVersion;
  }

  let matchingVersion: string | undefined;

  if (preferAlreadyDownloaded && hasNeededPackage(packageName)) {
    const alreadyDownloadedVersions =
      getAlreadyNeededPackageVersions(packageName);

    matchingVersion = findTopMatchingVersion(
      versionRange,
      alreadyDownloadedVersions,
    );
  }

  if (!matchingVersion) {
    matchingVersion = findTopMatchingVersion(
      versionRange,
      packageInfo.versions,
    );
  }

  if (!matchingVersion) {
    return undefined;
  }

  return packageInfo.info.versions[matchingVersion];
}

export function getPackageDependencies(
  packageName: string,
  versionRangeOrDistTag: string,
  include: DependenciesType = {},
): npm.Dependencies | undefined {
  const version = getSpecificPackageVersion(packageName, versionRangeOrDistTag);

  if (!version) {
    return undefined;
  }

  return getSpecificPackageDependencies(version, include);
}

export function getSpecificPackageDependencies(
  specificPackageVersion: npm.PackumentVersion,
  {
    bundleDependencies = true,
    bundledDependencies = true,
    dependencies = true,
    devDependencies = true,
    peerDependencies = true,
  }: DependenciesType = {},
): npm.Dependencies | undefined {
  const deps: npm.Dependencies = {};

  if (bundleDependencies) {
    let bundleDependenciesObj = specificPackageVersion.bundleDependencies;
    if (Array.isArray(specificPackageVersion.bundleDependencies)) {
      bundleDependenciesObj = specificPackageVersion.bundleDependencies.reduce(
        (all, item) => {
          all[item] = "*";
          return all;
        },
        {},
      );
    }
    Object.assign(deps, bundleDependenciesObj || {});
  }

  if (bundledDependencies) {
    Object.assign(deps, specificPackageVersion.bundledDependencies || {});
  }

  if (dependencies) {
    Object.assign(deps, specificPackageVersion.dependencies || {});
  }

  if (devDependencies) {
    Object.assign(deps, specificPackageVersion.devDependencies || {});
  }

  if (peerDependencies) {
    Object.assign(deps, specificPackageVersion.peerDependencies || {});
  }

  return Object.fromEntries(
    Object.entries(deps).map(([packageName, version]) =>
      formatDependency(packageName, version),
    ),
  );
}

function formatDependency(
  packageName: string,
  version: string,
): [packageName: string, version: string] {
  if (version.startsWith("npm:")) {
    return formatNpmDependenciesVersion(packageName, version);
  }

  if (version === "") {
    return [packageName, "*"];
  }

  if (
    [
      "git:",
      "git+ssh:",
      "git+http:",
      "git+https:",
      "git+file:",
      "file:",
      "http:",
      "https:",
    ].some((prefix) => version.startsWith(prefix))
  ) {
    const warningMessage = `Unsupported version ${version} (the value of ${packageName})`;
    console.warn(warningMessage);
  }

  return [packageName, version];
}

function findTopMatchingVersion(
  versionRange: string,
  versions: string[],
): string | undefined {
  return semver.maxSatisfying(versions, versionRange) ?? undefined;
}

function formatNpmDependenciesVersion(
  packageName: string,
  version: string,
): [packageName: string, version: string] {
  // This means a map between package name and actual package name and version
  const withoutNpmPrefix = version.split("npm:")[1];

  const splitted = withoutNpmPrefix.split("@");

  // No exact version and not in a scope, similar to <package name>: *
  if (splitted.length === 1) {
    return [splitted[0], "*"];
  }

  // If 3 this means @org/package_name@specific_version
  if (splitted.length === 3) {
    if (splitted[0].length) {
      console.warn(`weird format, first @ is not at the start ${version}`);

      // keep as is
      return [packageName, version];
    }

    return [
      // the org name and package name
      `@${splitted[1]}`,
      splitted[2],
    ];
  }

  if (splitted.length === 2) {
    // Can be either @org/package_name that inherent * or package_name@version

    // If no string before '@', this means that we have org with package name
    if (!splitted[0].length) {
      return [withoutNpmPrefix, "*"];
    }

    return [splitted[0], splitted[1]];
  }

  console.warn(`weird format, too many @ ${version}`);

  // keep as is
  return [packageName, version];
}
