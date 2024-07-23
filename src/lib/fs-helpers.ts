import fsPromises from "node:fs/promises";

export const ONE_KB = 1024;
export const ONE_MB = ONE_KB * 1024;

export async function getFileSizeInBytes(filePath: string): Promise<number> {
    const stats = await fsPromises.stat(filePath);

    return stats.size;
}
