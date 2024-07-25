import path from "node:path";
import type { SingleBar } from "cli-progress";
import { getPackageJsonPathFromTarFile } from "../lib/npm/package-tar.js";
import { writeFileInTar } from "../lib/tar/modify-files.js";
import type { NeededPackage } from "../npm-graph/needed-packages.js";

export async function fixPackage(
  packageDetails: NeededPackage,
  packagePath: string,
  downloadBar?: SingleBar,
) {
  if (
    !packageDetails.shouldRemoveCustomRegistry &&
    !packageDetails.shouldRemoveProvenance
  ) {
    return;
  }
  const prettyPath = path.basename(packagePath);

  downloadBar?.setTotal(4);
  downloadBar?.update(2, {
    step: "Fetch Package JSON",
  });

  let packageJsonPath: string;
  try {
    packageJsonPath = await getPackageJsonPathFromTarFile(packagePath);
  } catch (e) {
    if ((e as { code: string }).code === "TAR_BAD_ARCHIVE") {
      console.error(`${prettyPath} is not a valid tar file`, e);
    } else {
      console.error(`Failed to get package.json for ${prettyPath}`);
    }
    throw e;
  }

  downloadBar?.increment({
    step: "Update file",
  });

  await writeFileInTar(packagePath, {
    [packageJsonPath]: (content) => {
      const packageJson = JSON.parse(content);

      fixPackageJson(packageJson, packageDetails, downloadBar);

      return JSON.stringify(packageJson, null, 2);
    },
  });
}

function fixPackageJson(
  packageJson: Record<string, unknown>,
  packageDetails: NeededPackage,
  downloadBar?: SingleBar,
) {
  const removeKeys: string[] = [];
  const publishConfig = packageJson.publishConfig as Record<
    string,
    string | undefined
  >;

  if (packageDetails.shouldRemoveCustomRegistry) {
    removeKeys.push("registry");
    publishConfig.registry = undefined;
  }

  if (packageDetails.shouldRemoveProvenance) {
    removeKeys.push("provenance");
    publishConfig.provenance = undefined;
  }

  downloadBar?.increment({
    step: `Removing ${removeKeys.join(", ")}`,
  });
}
