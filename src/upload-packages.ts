import fsPromises from "node:fs/promises";
import cliProgress from "cli-progress";
import fastq, { type queueAsPromised } from "fastq";
import { doesDirectoryExists } from "./lib/fs-helpers.js";
import { getAllPackagesPath, uploadPackage } from "./uploader/index.js";

export interface UploadOptions {
  concurrency: number;
  outputFolder: string;
  registry?: string;
  removeFilesAfterUpload: boolean;
}

export interface UploadStat {
  total: number;
  processed: number;
  markedExistingPackageAsLatest: number;
  skippedAsAlreadyLatest: number;
  uploaded: number;
}

export async function uploadPackages(options: UploadOptions) {
  const progressBar = new cliProgress.SingleBar(
    {
      format: "Uploading | {bar} | {value}/{total}",
    },
    cliProgress.Presets.shades_grey,
  );

  if (!(await doesDirectoryExists(options.outputFolder))) {
    throw new Error(`Output folder does not exist: ${options.outputFolder}`);
  }

  console.log("Scanning");

  const packagesPaths = await getAllPackagesPath(options.outputFolder);
  progressBar.start(packagesPaths.length, 0);

  const stats: UploadStat = {
    total: packagesPaths.length,
    processed: 0,
    uploaded: 0,
    skippedAsAlreadyLatest: 0,
    markedExistingPackageAsLatest: 0,
  };

  const uploadQueue: queueAsPromised<string> = fastq.promise(
    async (filePath) => {
      await uploadPackage(
        filePath,
        {
          registry: options?.registry,
          cwd: options.outputFolder,
        },
        stats,
      );

      stats.processed++;

      progressBar.increment();

      if (options.removeFilesAfterUpload) {
        await fsPromises.rm(filePath).catch(() => undefined);
      }
    },
    options.concurrency,
  );

  await Promise.all(packagesPaths.map((item) => uploadQueue.push(item)));

  await uploadQueue.drain();
  await uploadQueue.drained();

  progressBar.stop();

  console.log("Uploaded all packages");
  console.log(`Total packages: ${stats.total}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Uploaded: ${stats.uploaded}`);
  console.log(`Skipped as already latest: ${stats.skippedAsAlreadyLatest}`);
  console.log(
    `Marked existing packages as latest: ${stats.markedExistingPackageAsLatest}`,
  );

  console.log("All done");
}
