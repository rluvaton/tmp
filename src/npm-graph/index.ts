import { EventEmitter } from "node:events";
import { PromisePool } from "../lib/promise-pool.js";
import {
  fetchModuleInfoToCache,
  isModuleFetchingInProgress,
  isModuleInCache,
} from "./module-cache/index.js";
import {
  type DependenciesType,
  getSpecificPackageDependencies,
  getSpecificPackageVersion,
} from "./module.js";
import {
  addNewNeededPackage,
  hasNeededPackageVersion,
} from "./needed-packages.js";

export class PackagesGraph extends EventEmitter<{
  newPackage: [packageName: string, versionRange: string];
  morePackages: [morePackages: number];
}> {
  private fetchDataPool: PromisePool<unknown>;
  private include: DependenciesType;
  private addLatest: boolean;
  private signal: AbortSignal | undefined;

  constructor({
    concurrency,
    include,
    addLatest,
    signal,
  }: {
    concurrency: number;
    include: DependenciesType;
    addLatest: boolean;
    signal?: AbortSignal;
  }) {
    super();
    this.signal = signal;
    this.fetchDataPool = new PromisePool({ concurrency, signal });
    this.include = include;
    this.addLatest = addLatest;
  }

  async addNewPackage(packageName: string, versionRangeOrDistTag = "latest") {
    if (this.signal?.aborted) {
      return;
    }

    const promises: Promise<void>[] = [];

    promises.push(
      this.processSinglePackage({
        packageName,
        versionRangeOrDistTag,
      }),
    );

    if (versionRangeOrDistTag !== "latest" && this.addLatest) {
      promises.push(
        this.processSinglePackage({
          packageName,
          versionRangeOrDistTag: "latest",
        }),
      );
    }

    await Promise.all(promises);
  }

  // Allow to continue after failure

  private async processSinglePackage({
    packageName,
    versionRangeOrDistTag,
  }: {
    packageName: string;
    versionRangeOrDistTag: string;
  }): Promise<void> {
    if (this.signal?.aborted) {
      return;
    }
    const prefix = `[${packageName}:${versionRangeOrDistTag}]`;

    // TODO - add some progress bar for overall packages download
    if (
      !isModuleInCache(packageName) &&
      isModuleFetchingInProgress(packageName)
    ) {
      // Don't add to pool, so we won't take the pool by duplicate requests
      await fetchModuleInfoToCache(packageName);
    } else if (!isModuleInCache(packageName)) {
      await this.fetchDataPool.add(() =>
        fetchModuleInfoToCache(packageName, this.signal),
      );
    }

    if (this.signal?.aborted) {
      return;
    }

    this.emit("newPackage", packageName, versionRangeOrDistTag);

    const version = getSpecificPackageVersion(
      packageName,
      versionRangeOrDistTag,
      {
        preferAlreadyDownloaded: versionRangeOrDistTag !== "latest",
      },
    );

    if (!version) {
      console.warn(`${prefix} missing`);
      return;
    }

    // Already processed
    if (hasNeededPackageVersion(packageName, version.version)) {
      return;
    }

    addNewNeededPackage(packageName, version);

    const deps = getSpecificPackageDependencies(version, this.include) || {};

    const allDepsProcessData = Object.entries(deps).flatMap(
      ([depName, depVersion]) =>
        [
          {
            packageName: depName,
            versionRangeOrDistTag: depVersion,
          },
          this.addLatest && {
            packageName: depName,
            versionRangeOrDistTag: "latest",
          },
        ].filter(Boolean),
    );

    this.emit("morePackages", allDepsProcessData.length);

    // TODO - maybe do in parallel, but fetch only once, so if already in progress of fetching
    await Promise.all(
      allDepsProcessData.map((data) => data && this.processSinglePackage(data)),
    );

    // console.log(`${prefix} finished`);

    // What about if dependency failed to add or something
  }
}
