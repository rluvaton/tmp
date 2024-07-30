import path from "node:path";
import type { FetchAndDownloadMetadataProgressPayload } from "../fetch-and-download.js";
import { doesFileExist } from "../lib/fs-helpers.js";
import { createNumberFormatter } from "../multi-progress-bar/formatters.js";
import type { MultiProgressBar } from "../multi-progress-bar/multi-progress-bar.js";
import {
  kProgressBar,
  kTotal,
  kValue,
} from "../multi-progress-bar/predefined-variables.js";
import type { SingleProgressBar } from "../multi-progress-bar/single-bar.js";
import type { NeededPackage } from "../npm-graph/needed-packages.js";
import { createFileNameFromPackage } from "../package-file-name.js";
import { doesRegistryAlreadyHave } from "../remote-registry-cache.js";
import { downloadPackageUrl } from "./download.js";
import { fixPackage } from "./fix-package.js";

export interface DownloadPackageOptions {
  packageDetails: NeededPackage;
  folder: string;
  allDownloadsProgressBars?: MultiProgressBar;
  metadataProgressBar?: SingleProgressBar<FetchAndDownloadMetadataProgressPayload>;
}

export async function downloadPackage({
  packageDetails,
  folder,
  allDownloadsProgressBars,
  metadataProgressBar,
}: DownloadPackageOptions) {
  const currentMetadata = metadataProgressBar?.getPayload();

  if (currentMetadata) {
    currentMetadata.pendingDownloads--;
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    metadataProgressBar!.update({
      ...currentMetadata,
    });
  }

  if (doesRegistryAlreadyHave(packageDetails)) {
    if (currentMetadata) {
      currentMetadata.alreadyInRegistry++;
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      metadataProgressBar!.update({
        ...currentMetadata,
      });
    }
    return;
  }

  const fileName = createFileNameFromPackage(packageDetails);
  const fullPath = path.join(folder, fileName);

  const downloadProgressBar = allDownloadsProgressBars?.add({
    total: 3,
    value: 0,
    payload: {
      step: "Init",
    } as object,
    template: [
      {
        key: "step",
      },
      " | ",
      kProgressBar,
      " | ",
      `${packageDetails.name}@${packageDetails.version}`,
      " | ",
      kValue,
      "/",
      kTotal,
    ],
    formatters: {
      [kValue]: createNumberFormatter({
        maxFractionDigits: 2,
      }),
    },
  });

  if (!(await doesFileExist(fullPath))) {
    downloadProgressBar?.update({
      step: "Fetching",
    });

    await downloadPackageUrl(packageDetails, fullPath, downloadProgressBar);

    downloadProgressBar?.setTotal(4);
    downloadProgressBar?.setValue(2);
    downloadProgressBar?.update({
      step: "Downloaded",
    });
    if (currentMetadata) {
      currentMetadata.downloaded++;
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      metadataProgressBar!.update({
        ...currentMetadata,
      });
    }
  } else {
    if (currentMetadata) {
      currentMetadata.skippedAlreadyDownloaded++;
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      metadataProgressBar!.update({
        ...currentMetadata,
      });
    }
  }

  if (
    packageDetails.shouldRemoveCustomRegistry ||
    packageDetails.shouldRemoveProvenance
  ) {
    downloadProgressBar?.setValue(2);
    downloadProgressBar?.update({
      step: "Fixing",
    });
    await fixPackage(packageDetails, fullPath);
  }

  downloadProgressBar?.stop();

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  allDownloadsProgressBars?.remove(downloadProgressBar!);
}
