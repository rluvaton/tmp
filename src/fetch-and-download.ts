import fsPromises from "node:fs/promises";
import path from "node:path";
import cliProgress, { type SingleBar } from "cli-progress";
import fastq, { type queueAsPromised } from "fastq";
import { loadCache, saveCache, saveCacheSync } from "./cache/index.js";
import { downloadPackage } from "./downloader/index.js";
import { doesDirectoryExists } from "./lib/fs-helpers.js";
import { PackagesGraph } from "./npm-graph/index.js";
import type { DependenciesType } from "./npm-graph/module.js";
import {
  type NeededPackage,
  getNumberOfPackagesToDownload,
  listenToNewPackages,
  removeNewPackageListener,
} from "./npm-graph/needed-packages.js";
import {
  doesRegistryAlreadyHave,
  loadRegistry,
} from "./remote-registry-cache.js";
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
  const progressBar = new cliProgress.MultiBar(
    {},
    cliProgress.Presets.shades_grey,
  );

  progressBar.update();

  if (!(await doesDirectoryExists(options.outputFolder))) {
    await fsPromises.mkdir(options.outputFolder, { recursive: false });
  }

  let currentMetadata: FetchAndDownloadMetadataProgressPayload = {
    pendingDownloads: 0,
    downloaded: 0,
    skippedAlreadyDownloaded: 0,
    alreadyInRegistry: 0,
  };

  const metadataProgressBar: SingleBar = progressBar.create(
    Number.POSITIVE_INFINITY,
    0,
    {
      ...currentMetadata,
    },
    {
      clearOnComplete: false,
      hideCursor: true,
      format: [
        "Pending downloads {pendingDownloads}",
        "Downloaded {downloaded}",
        "Already downloaded {skippedAlreadyDownloaded}",
        options.registryDataFilePath &&
          "Versions already in registry {alreadyInRegistry}",
      ]
        .filter(Boolean)
        .join(" | "),
    },
  );

  metadataProgressBar.start(Number.POSITIVE_INFINITY, 0, {
    ...currentMetadata,
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
    const currentMetadata = (
      metadataProgressBar as unknown as {
        payload: FetchAndDownloadMetadataProgressPayload;
      }
    ).payload;
    currentMetadata.pendingDownloads++;
    metadataProgressBar.update({
      ...currentMetadata,
    });
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

  const fetchProgressBar = progressBar.create(
    needed.length,
    0,
    {},
    {
      clearOnComplete: false,
      hideCursor: true,
      format: "Scanning {value}/{total} | {bar} | {package}@{range}",
    },
  );

  fetchProgressBar.start(needed.length, 0);

  cache.on("newPackage", (packageName, versionRange) => {
    fetchProgressBar.increment({
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
    await cache.addNewPackage(packageName, version);
  }

  fetchProgressBar.setTotal(fetchProgressBar.getProgress());
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
