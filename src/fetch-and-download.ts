import fsPromises from "node:fs/promises";
import path from "node:path";
import fastq, { type queueAsPromised } from "fastq";
import { loadCache, saveCache, saveCacheSync } from "./cache/index.js";
import { downloadPackage } from "./downloader/index.js";
import { doesDirectoryExists } from "./lib/fs-helpers.js";
import { MultiProgressBar } from "./multi-progress-bar/multi-progress-bar.js";
import {
  kProgressBar,
  kTotal,
  kValue,
} from "./multi-progress-bar/predefined-variables.js";
import { doesPackageExist } from "./npm-graph/fetcher.js";
import { PackagesGraph } from "./npm-graph/index.js";
import type { DependenciesType } from "./npm-graph/module.js";
import {
  type NeededPackage,
  getNumberOfPackagesToDownload,
  listenToNewPackages,
  removeNewPackageListener,
} from "./npm-graph/needed-packages.js";
import { loadRegistry } from "./remote-registry-cache.js";
import { ROOT_DIR } from "./root-dir.js";

export interface RequiredPackages {
  // Package name to versions
  [packageName: string]: string[];
}

export interface FetchAndDownloadMetadataProgressPayload {
  pendingDownloads: number;
  downloaded: number;
  skippedAlreadyDownloaded: number;
  alreadyInRegistry: number;
}

export interface FetchAndDownloadOptions {
  include: DependenciesType;
  fetchConcurrency: number;
  alsoFetchLatest: boolean;
  downloadConcurrency: number;
  outputFolder: string;
  packages: RequiredPackages;
  alwaysSaveCache?: boolean;
  registryDataFilePath?: string;

  // Will only ignore missing packages that in the `packages` option, should support even in deps
  ignoreMissing?: boolean;
}

export async function fetchAndDownload(options: FetchAndDownloadOptions) {
  const outputFolder = path.join(ROOT_DIR, "output");
  const cacheFilePath = path.join(outputFolder, "cache.json");

  const abort = new AbortController();

  await loadCache(cacheFilePath);

  // On CTRL-C
  process.on("SIGINT", () => {
    abort.abort(new Error("Received SIGINT"));

    console.log("Saving cache");
    // Only in failure save cache
    try {
      saveCacheSync(cacheFilePath);
      console.log("Cache saved successfully");
    } catch (e) {
      console.error("Failed to save cache", e);
    }

    process.exit(2 /* SIGINT */);
  });

  // On CTRL-C
  process.on("unhandledRejection", (reason) => {
    console.error("unhandledRejection", reason);

    // Only in failure save cache
    try {
      saveCacheSync(cacheFilePath);
      console.log("Cache saved successfully");
    } catch (e) {
      console.error("Failed to save cache", e);
    }

    process.exit(1 /* SIGINT */);
  });

  await fetchAndDownloadImpl({ ...options, signal: abort.signal }).catch(
    async (e) => {
      // Only in failure save cache
      await saveCache(cacheFilePath).catch((cacheError) =>
        console.error("Failed to save cache", cacheError),
      );

      throw e;
    },
  );

  if (options.alwaysSaveCache) {
    await saveCache(cacheFilePath);
  }
}

async function fetchAndDownloadImpl(
  options: FetchAndDownloadOptions & {
    signal?: AbortSignal;
  },
) {
  const progressBar = new MultiProgressBar();

  if (!(await doesDirectoryExists(options.outputFolder))) {
    await fsPromises.mkdir(options.outputFolder, { recursive: false });
  }

  let currentMetadata: FetchAndDownloadMetadataProgressPayload = {
    pendingDownloads: 0,
    downloaded: 0,
    skippedAlreadyDownloaded: 0,
    alreadyInRegistry: 0,
  };

  const metadataProgressBar =
    progressBar.add<FetchAndDownloadMetadataProgressPayload>({
      total: Number.POSITIVE_INFINITY,
      value: 0,
      payload: currentMetadata,
      template: [
        "Pending downloads ",
        { key: "pendingDownloads" },
        " Downloaded ",
        { key: "downloaded" },
        " Already downloaded ",
        { key: "skippedAlreadyDownloaded" },

        !!options.registryDataFilePath && " Versions already in registry ",
        !!options.registryDataFilePath && {
          key: "alreadyInRegistry",
        },
      ],
    });

  if (options.registryDataFilePath) {
    await loadRegistry(options.registryDataFilePath);
  }

  const downloadQueue: queueAsPromised<NeededPackage> = fastq.promise(
    (neededPackage) =>
      downloadPackage({
        folder: options.outputFolder,
        packageDetails: neededPackage,
        allDownloadsProgressBars: progressBar,
        metadataProgressBar: metadataProgressBar,
      }),
    options.downloadConcurrency,
  );

  listenToNewPackages((neededPackage) => {
    const currentMetadata = metadataProgressBar.getPayload();

    if (currentMetadata) {
      currentMetadata.pendingDownloads++;
      metadataProgressBar.update({
        ...currentMetadata,
      });
    }
    downloadQueue.push(neededPackage);
  });

  const cache = new PackagesGraph({
    concurrency: options.fetchConcurrency,
    addLatest: options.alsoFetchLatest,
    include: options.include,
    signal: options.signal,
  });

  const needed: (readonly [name: string, version: string])[] = Object.entries(
    options.packages,
  ).flatMap(([packageName, versions]) =>
    versions.map((version) => [packageName, version] as const),
  );

  const fetchProgressBar = progressBar.add({
    total: needed.length,
    value: 0,
    template: [
      "Scanning ",
      kValue,
      "/",

      kTotal,
      " | ",
      kProgressBar,
      " | ",
      {
        key: "package",
      },
      "@",
      {
        key: "range",
      },
    ],
  });

  cache.on("newPackage", (packageName, versionRange) => {
    fetchProgressBar.increment();
    fetchProgressBar.update({
      package: packageName,
      range: versionRange,
    });
  });

  cache.on("morePackages", (more) => {
    fetchProgressBar.setTotal(fetchProgressBar.getTotal() + more);
  });

  options.signal?.addEventListener("abort", () => {
    fetchProgressBar.stop();
    progressBar.stop();

    console.log("Received abort signal");

    removeNewPackageListener();
    downloadQueue.kill();
  });

  for (const [packageName, version] of needed) {
    if (
      options.ignoreMissing &&
      !(await doesPackageExist(
        packageName,

        // TODO - fix this, there seem to be a memory leak in the fetch and abort listener
        options.signal ? AbortSignal.any([options.signal]) : undefined,
      ))
    ) {
      continue;
    }
    await cache.addNewPackage(packageName, version);
  }

  fetchProgressBar.setTotal(fetchProgressBar.getCurrent());
  fetchProgressBar.stop();

  await downloadQueue.drain();
  await downloadQueue.drained();

  currentMetadata = (
    metadataProgressBar as unknown as { payload: typeof currentMetadata }
  ).payload;

  fetchProgressBar.stop();
  metadataProgressBar.stop();
  progressBar.stop();

  console.log("Finished downloading all packages");
  console.log(`Requested ${needed.length} packages and versions`);

  // TODO - Print seperetly the number of already downloaded packages
  // TODO - Do not print those in the same list
  console.log(`Downloaded ${getNumberOfPackagesToDownload()}`);

  if (options.registryDataFilePath) {
    console.log(
      `Skipped ${currentMetadata.alreadyInRegistry} specific versions that already exists in registry`,
    );
  }

  console.log("All done");
}
