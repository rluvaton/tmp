import { glob } from "glob";
import {
  type NpmOptions,
  isPackagePublished,
  isPublishedPackageLatest,
  markPublishedPackageAsLatest,
  publishPackage,
} from "../lib/npm/registry.js";
import { parseFileNameFromPackage } from "../package-file-name.js";
import type { UploadStat } from "../upload-packages.js";

// TODO - add progress bar and concurrent upload

const EMPTY_UPLOAD_STATS: UploadStat = {
  uploaded: 0,
  markedExistingPackageAsLatest: 0,
  processed: 0,
  skippedAsAlreadyLatest: 0,
  total: 0,
};

export async function uploadPackage(
  filePath: string,
  options: NpmOptions,
  stats: UploadStat = EMPTY_UPLOAD_STATS,
) {
  stats.processed++;
  const parsed = parseFileNameFromPackage(filePath);

  const isPublished = await isPackagePublished({
    packageName: parsed.name,
    version: parsed.version,
    options,
  });

  if (isPublished) {
    const isLatest = await isPublishedPackageLatest({
      packageName: parsed.name,
      version: parsed.version,
      options,
    });

    if (isLatest) {
      stats.skippedAsAlreadyLatest++;
      return;
    }

    // Set package version to be the latest
    await markPublishedPackageAsLatest({
      packageName: parsed.name,
      version: parsed.version,
      options,
    });

    stats.markedExistingPackageAsLatest++;

    return;
  }

  await publishPackage({
    packageName: parsed.name,
    version: parsed.version,
    tarFilePath: filePath,
    setLatest: parsed.isLatest,
    options,
  });

  stats.uploaded++;
}

export async function getAllPackagesPath(dir: string): Promise<string[]> {
  return glob("**/*.tgz", {
    cwd: dir,
    nodir: true,
    absolute: true,
  });
}
