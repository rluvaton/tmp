import type * as npm from "@npm/types";
import { fetchPackage } from "../fetcher.js";
import {
  type LightModuleInfo,
  convertToLightModuleInfo,
} from "./light-module-info.js";

export interface ModuleCache {
  info: LightModuleInfo;

  // All versions of the package
  versions: string[];
}

let cache: Map<string, ModuleCache> = new Map();
const fetchCache: Map<string, Promise<unknown>> = new Map();

// TODO - allow saving cache to disk

export function getModuleCache(name: string): ModuleCache | undefined {
  return cache.get(name);
}

export function isModuleInCache(name: string): boolean {
  return cache.has(name);
}

export function haveModuleInfoCache(): boolean {
    return cache.size > 0;

}

export function addNewModule(name: string, moduleInfo: npm.Packument): void {
  if (cache.has(name)) {
    return;
  }

  cache.set(name, {
    info: convertToLightModuleInfo(moduleInfo),
    versions: Object.keys(moduleInfo.versions),
  });
}
export function addNewLightModule(
  name: string,
  moduleInfo: LightModuleInfo,
): void {
  if (cache.has(name)) {
    return;
  }

  cache.set(name, {
    info: moduleInfo,
    versions: Object.keys(moduleInfo.versions),
  });
}

export function loadModuleInfoCache(data: Record<string, ModuleCache>) {
  cache = new Map(Object.entries(data));
}

export function getModuleInfoCache(): Record<string, ModuleCache> {
  return Object.fromEntries(cache);
}

export function isModuleFetchingInProgress(name: string): boolean {
  return cache.has(name) || fetchCache.has(name);
}

export async function fetchModuleInfoToCache(
  packageName: string,
  signal?: AbortSignal,
): Promise<LightModuleInfo | undefined> {
  const prefix = `[${packageName}]`;

  if (cache.has(packageName)) {
    // console.log(`${prefix} Already fetched`);
    // biome-ignore lint/style/noNonNullAssertion:
    return cache.get(packageName)!.info;
  }

  if (fetchCache.has(packageName)) {
    // console.log(
    //   `${prefix} fetch already in progress, waiting for it to finish`,
    // );
    await fetchCache.get(packageName);

    if (signal?.aborted) {
      return;
    }

    // biome-ignore lint/style/noNonNullAssertion:
    return cache.get(packageName)!.info;
  }

  // TODO - add some progress bar for overall packages download
  // console.log(`${prefix} FETCHING`);
  const fetchPackagePromise = fetchPackage(packageName, signal).then(
    (packageInfo) => {
      const lightMode = convertToLightModuleInfo(packageInfo);

      if (!signal?.aborted) {
        addNewLightModule(packageName, lightMode);
      }

      return lightMode;
    },
  );

  fetchCache.set(packageName, fetchPackagePromise);
  const packageInfo = await fetchPackagePromise;
  fetchCache.delete(packageName);

  return packageInfo;
}

export function getLatestVersionForPackage(
  packageName: string,
): string | undefined {
  return cache.get(packageName)?.info?.["dist-tags"]?.latest;
}
