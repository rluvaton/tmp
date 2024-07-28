import path from "node:path";
import type { MultiBar, SingleBar } from "cli-progress";
import type { FetchAndDownloadMetadataProgressPayload } from "../fetch-and-download.js";
import { doesFileExist } from "../lib/fs-helpers.js";
import type { NeededPackage } from "../npm-graph/needed-packages.js";
import { createFileNameFromPackage } from "../package-file-name.js";
import { doesRegistryAlreadyHave } from "../remote-registry-cache.js";
import { downloadPackageUrl } from "./download.js";
import { fixPackage } from "./fix-package.js";

export interface DownloadPackageOptions {
  packageDetails: NeededPackage;
  folder: string;
  allDownloadsProgressBars?: MultiBar;
  metadataProgressBar?: SingleBar;
}

export async function downloadPackage({
  packageDetails,
  folder,
  allDownloadsProgressBars,
  metadataProgressBar,
}: DownloadPackageOptions) {
  const currentMetadata = (
    metadataProgressBar as unknown as {
      payload: FetchAndDownloadMetadataProgressPayload;
    }
  ).payload;

  currentMetadata.pendingDownloads--;
  metadataProgressBar?.update({
    ...currentMetadata,
  });

  if (doesRegistryAlreadyHave(packageDetails)) {
    currentMetadata.alreadyInRegistry++;
    metadataProgressBar?.update({
      ...currentMetadata,
    });
    return;
  }

  const fileName = createFileNameFromPackage(packageDetails);
  const fullPath = path.join(folder, fileName);

  const downloadProgressBar = allDownloadsProgressBars?.create(
    3,
    0,
    {},
    {
      clearOnComplete: false,
      stopOnComplete: false,
      hideCursor: true,
      format: `{step} | {bar} | ${packageDetails.name}@${packageDetails.version} | {value}/{total}`,

      formatValue: (value, options, type) => {
        // noinspection SuspiciousTypeOfGuard
        if (typeof value === "number") {
          return value % 1 === 0 ? value.toString() : value.toFixed(2);
        }
        return value;
      },
    },
  );

  downloadProgressBar?.start(3, 0);

  if (!(await doesFileExist(fullPath))) {
    downloadProgressBar?.update({
      step: "Fetching",
    });

    await downloadPackageUrl(packageDetails, fullPath, downloadProgressBar);

    downloadProgressBar?.setTotal(4);
    downloadProgressBar?.update(2, {
      step: "Downloaded",
    });
    currentMetadata.downloaded++;
    metadataProgressBar?.update({
      ...currentMetadata,
    });
  } else {
    currentMetadata.skippedAlreadyDownloaded++;
    metadataProgressBar?.update({
      ...currentMetadata,
    });
  }

  if (
    packageDetails.shouldRemoveCustomRegistry ||
    packageDetails.shouldRemoveProvenance
  ) {
    downloadProgressBar?.update(2, {
      step: "Fixing",
    });
    await fixPackage(packageDetails, fullPath);
  }

  downloadProgressBar?.stop();

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  allDownloadsProgressBars?.remove(downloadProgressBar!);
}
