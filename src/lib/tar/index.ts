import fs from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import { minimatch } from "minimatch";
import tarStream from "tar-stream";

/**
 * Extracts a single file from .tgz archive
 * @param {string} tarFile tar file to extract from
 * @param {string} filePathGlob relative file path to extract from the tar root content
 */
export async function getFileContentFromTar(
  tarFile: string,
  filePathGlob: string,
): Promise<Promise<Record<string, Buffer>>> {
  const gunzip = zlib.createGunzip();
  const extract = tarStream.extract();

  const filesBuffers: Record<string, Buffer> = {};

  extract.on("entry", (header, stream, next) => {
    if (!minimatch(header.name, filePathGlob)) {
      stream.on("end", next);
      stream.resume();
      return;
    }

    const chunks: Buffer[] = [];
    stream.on("end", () => {
      filesBuffers[header.name] = Buffer.concat(chunks);
      next();
    });
    stream.on("data", (chunk) => {
      chunks.push(chunk);
    });
    // Need to do this as for some reason the stream does not have the Readable functionality
    // const readable = Readable.from(stream);
    //
    // filesBuffers[header.name] = Buffer.concat(await readable.toArray());

    // next();
  });

  await pipeline(
    fs.createReadStream(tarFile, { autoClose: true }),
    gunzip,
    extract,
  );

  return filesBuffers;
}

export async function getListOfFilesFromTar(
  tarFile: string,
  matchingGlobPatterns?: string,
): Promise<string[]> {
  const fileList: string[] = [];
  const gunzip = zlib.createGunzip();
  const extract = tarStream.extract();

  extract.on("entry", async (header, stream, next) => {
    if (!matchingGlobPatterns || minimatch(header.name, matchingGlobPatterns)) {
      fileList.push(header.name);
    }
    finished(stream, next);
    stream.on("data", () => undefined);
  });

  await pipeline(
    fs.createReadStream(tarFile, { autoClose: true }),
    gunzip,
    extract,
  );

  return fileList;
}
