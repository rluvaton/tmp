import {
  type NpmOptions,
  isPackagePublished,
  isPublishedPackageLatest,
  markPublishedPackageAsLatest,
  publishPackage,
} from "../lib/npm/registry.js";
import { parseFileNameFromPackage } from "../package-file-name.js";

// TODO - add progress bar and concurrent upload

export async function uploadPackage(filePath: string, options: NpmOptions) {
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
      console.log("Package is already published and is the latest version");
      return;
    }

    // Set package version to be the latest
    await markPublishedPackageAsLatest({
      packageName: parsed.name,
      version: parsed.version,
      options,
    });

    return;
  }

  await publishPackage({
    packageName: parsed.name,
    version: parsed.version,
    tarFilePath: filePath,
    setLatest: parsed.isLatest,
    options,
  });
}
