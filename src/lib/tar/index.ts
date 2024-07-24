import fs from "node:fs";
import { finished } from "node:stream/promises";
import { minimatch } from "minimatch";
import * as tar from "tar";
import { InMemoryWritable } from "../streams-helper.js";

/**
 * Extracts a single file from .tgz archive
 * @param {string} tarFile tar file to extract from
 * @param {string} filePathGlob relative file path to extract from the tar root content
 */
export async function getFileContentFromTar(
  tarFile: string,
  filePathGlob: string,
): Promise<Promise<Record<string, Buffer>>> {
  const filesBuffers: Record<string, Buffer | InMemoryWritable> = {};

  await tar.extract({
    file: tarFile,
    filter: (path) => minimatch(path, filePathGlob),
    transform(entry) {
      filesBuffers[entry.path] = new InMemoryWritable();

      return filesBuffers[entry.path];
    },
  });

  for (const key of Object.keys(filesBuffers)) {
    filesBuffers[key] = Buffer.concat(
      (filesBuffers[key] as InMemoryWritable).internalData,
    );
  }

  return filesBuffers as Record<string, Buffer>;
}

/**
 *
 * @param {string} tarFile
 * @return {Promise<string[]>}
 */
export async function getListOfFilesFromTar(
  tarFile: string,
): Promise<string[]> {
  const fileList: string[] = [];

  await finished(
    fs
      .createReadStream(tarFile)
      .pipe(tar.t())
      .on("entry", (entry) => fileList.push(entry.path)),
  );

  return fileList;
}
