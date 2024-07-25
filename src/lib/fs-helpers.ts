import fsPromises from "node:fs/promises";

export const ONE_KB = 1024;
export const ONE_MB = ONE_KB * 1024;

export async function doesFileExist(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);

    return true;
  } catch {
    return false;
  }
}

export async function doesDirectoryExists(
  directoryPath: string,
): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(directoryPath);

    return stats.isDirectory();
  } catch {
    return false;
  }
}
