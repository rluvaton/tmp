import type * as npm from "@npm/types";

export interface LightModuleVersionInfo {
  version: string;
  publishConfig: npm.PackumentVersion["publishConfig"];
  dist: Pick<npm.PackumentVersion["dist"], "tarball">;

  // Deps
  bundleDependencies?: Pick<npm.PackumentVersion, "bundleDependencies">;
  bundledDependencies?: Pick<npm.PackumentVersion, "bundledDependencies">;
  dependencies?: Pick<npm.PackumentVersion, "dependencies">;
  devDependencies?: Pick<npm.PackumentVersion, "devDependencies">;
  peerDependencies?: Pick<npm.PackumentVersion, "peerDependencies">;
}

export interface LightModuleInfo {
  "dist-tags"?: npm.Packument["dist-tags"];
  versions: {
    [version: string]: LightModuleVersionInfo;
  };
}

export function convertToLightModuleInfo(info: npm.Packument): LightModuleInfo {
  return {
    "dist-tags": info["dist-tags"],
    versions: Object.fromEntries(
      Object.entries(info.versions || {}).map(([version, versionInfo]) => [
        version,
        {
          version,
          publishConfig: versionInfo.publishConfig,
          dist: {
            tarball: versionInfo.dist.tarball,
          },
          bundleDependencies: versionInfo.bundleDependencies,
          bundledDependencies: versionInfo.bundledDependencies,
          dependencies: versionInfo.dependencies,
          devDependencies: versionInfo.devDependencies,
          peerDependencies: versionInfo.peerDependencies,
        } satisfies LightModuleVersionInfo,
      ]),
    ),
  };
}
