import path from "node:path";
import type { MultiBar } from "cli-progress";
import { doesFileExist } from "../lib/fs-helpers.js";
import type { NeededPackage } from "../npm-graph/needed-packages.js";
import { createFileNameFromPackage } from "../package-file-name.js";
import { downloadPackageUrl } from "./download.js";
import { fixPackage } from "./fix-package.js";

export async function downloadPackage(
  packageDetails: NeededPackage,
  folder: string,
  progressBar?: MultiBar,
) {
  const fileName = createFileNameFromPackage(packageDetails);
  const fullPath = path.join(folder, fileName);

  const downloadProgressBar = progressBar?.create(
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
  progressBar?.remove(downloadProgressBar!);
}
