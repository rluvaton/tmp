import fsPromises from "node:fs/promises";
import cliProgress from "cli-progress";
import fastq, { type queueAsPromised } from "fastq";
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

export interface FetchAndDownloadOptions {
  include: DependenciesType;
  fetchConcurrency: number;
  alsoFetchLatest: boolean;
  downloadConcurrency: number;
  outputFolder: string;
  packages: Record<string, string[]>;
  signal?: AbortSignal;
}

export async function fetchAndDownload(options: FetchAndDownloadOptions) {
  const progressBar = new cliProgress.MultiBar(
    {},
    cliProgress.Presets.shades_grey,
  );

  if (!(await doesDirectoryExists(options.outputFolder))) {
    await fsPromises.mkdir(options.outputFolder, { recursive: false });
  }

  const downloadQueue: queueAsPromised<NeededPackage> = fastq.promise(
    (neededPackage) =>
      downloadPackage(neededPackage, options.outputFolder, progressBar),
    options.downloadConcurrency,
  );

  listenToNewPackages(downloadQueue.push.bind(downloadQueue));

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

  fetchProgressBar.stop();
  progressBar.stop();

  console.log("Finished downloading all packages");
  console.log(`Requested ${needed.length} packages and versions`);
  console.log(`Downloaded ${getNumberOfPackagesToDownload()}`);

  console.log("All done");
}
