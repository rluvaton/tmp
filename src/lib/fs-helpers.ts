import fs from "node:fs/promises";

export const ONE_KB = 1024;
export const ONE_MB = ONE_KB * 1024;

export async function doesFileExist(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
}

export async function doesDirectoryExists(
  directoryPath: string,
): Promise<boolean> {
  try {
    const stats = await fs.stat(directoryPath);

    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  return JSON.parse((await fs.readFile(filePath)).toString());
}

export async function writeJsonFile(
  filePath: string,
  data: unknown,
  pretty = false,
): Promise<void> {
  const str = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

  await fs.writeFile(filePath, str);
}
