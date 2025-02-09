import { getListOfFilesFromTar } from "../tar/index.js";

export async function getPackageJsonPathFromTarFile(
  packagePath: string,
): Promise<string> {
  const packageJsonPaths = await getListOfFilesFromTar(
    packagePath,
    "**/package.json",
  );

  if (packageJsonPaths.length === 0) {
    const tarFileList = await getListOfFilesFromTar(packagePath);

    throw new Error(
      `No package.json found in the tar file\nThe files are:\n${tarFileList.map((item) => `- ${item}`).join("\n")}`,
    );
  }

  let packageJsonPathInsideTar = packageJsonPaths[0];

  if (packageJsonPaths.length > 1) {
    const minimumPathsWithSameSize = new Set(packageJsonPathInsideTar);
    // The smallest path length is the top level unless there are multiple in the same level
    for (const pathInFile of packageJsonPaths) {
      if (pathInFile.length < packageJsonPathInsideTar.length) {
        minimumPathsWithSameSize.clear();
        minimumPathsWithSameSize.add(pathInFile);
        packageJsonPathInsideTar = pathInFile;
        continue;
      }

      if (pathInFile.length === packageJsonPathInsideTar.length) {
        minimumPathsWithSameSize.add(pathInFile);
      }

      // larger so ignore
    }

    if (minimumPathsWithSameSize.size > 1) {
      // TODO - ask the user which one to use
      throw new Error(
        "Multiple package.json files found in the tar file no top level package json",
      );
    }
  }

  return packageJsonPathInsideTar;
}
