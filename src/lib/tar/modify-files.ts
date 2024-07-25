import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { PassThrough, type TransformCallback, finished } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import tarStream from "tar-stream";
import { ONE_MB } from "../fs-helpers.js";

interface FilesToChange {
  /**
   * Either a new content or a function to change the content
   */
  [filePathInTar: string]: string | ((content: string) => string | null);
}

const LIMIT_TO_USE_IN_MEMORY = ONE_MB * 10;

export async function modifyFilesInTar(
  tarFile: string,
  filesToChange: FilesToChange,
) {
  const tmpOutputPath = `${tarFile}.tmp.tgz`;

  const uncompressedSizeInBytes = await getUncompressedTgzSizeInBytes(tarFile);

  const useInMemory = uncompressedSizeInBytes <= LIMIT_TO_USE_IN_MEMORY;

  const { input: inputPipeline, output: outputPipeline } = getPipelines({
    inputFile: tarFile,
    outputFile: useInMemory ? tarFile : tmpOutputPath,
    filesToChange,
  });

  if (useInMemory) {
    // In memory should wait for read to finish to not override the file
    await inputPipeline();
    await outputPipeline();
  } else {
    await Promise.all([inputPipeline(), outputPipeline()]);
    await fsPromises.rename(tmpOutputPath, tarFile);
  }
}

function getPipelines({
  inputFile,
  outputFile,
  filesToChange,
}: {
  inputFile: string;
  outputFile: string;
  filesToChange: FilesToChange;
}) {
  const gunzip = zlib.createGunzip();
  const gzip = zlib.createGzip();
  const pack = tarStream.pack({
    // So we won't have back pressure issues when keeping the entire tar in memory
    highWaterMark: LIMIT_TO_USE_IN_MEMORY * 10,
  });
  const extract = tarStream.extract();

  extract.on("finish", () => {
    // all entries done - lets finalize it
    pack.finalize();
  });

  extract.on("entry", async (header, stream, next) => {
    const newContent = filesToChange[header.name];

    // If missing override, keep the original content
    if (filesToChange[header.name] == null) {
      stream.pipe(pack.entry(header, next));

      return;
    }

    // New content
    if (typeof newContent === "string") {
      let called = false;

      // Wait for both stream and pack to finish
      pack.entry({ ...header, size: newContent.length }, newContent, () => {
        if (!called) {
          called = true;
          return;
        }

        next();
      });

      // To call next on stream end, even though pipe should do that, it don't
      stream.on("end", () => {
        if (!called) {
          called = true;
          return;
        }

        next();
      });

      // Drain the stream
      stream.resume();
    } else {
      let fileContent = "";

      stream.on("end", () => {
        // biome-ignore lint/style/noNonNullAssertion: it must exists
        const replaced = newContent(fileContent!);

        if (replaced === null) {
          pack.entry(header, next);
        } else {
          pack.entry(header, replaced, next);
        }
      });

      stream.on("data", (chunk: Buffer) => {
        fileContent += chunk.toString();
      });

      stream.resume();
    }
  });

  return {
    input: () => {
      const input = fs.createReadStream(inputFile, { autoClose: true });

      return pipeline(input, gunzip, extract);
    },
    output: () => {
      const output = fs.createWriteStream(outputFile, { autoClose: true });

      return pipeline(pack, gzip, output);
    },
  };
}

async function getUncompressedTgzSizeInBytes(
  filePath: string,
): Promise<number> {
  let bytes = 0;
  const input = fs.createReadStream(filePath, { autoClose: true });
  const gunzip = zlib.createGunzip();
  const extract = tarStream.extract();

  extract.on("entry", (header, stream, next) => {
    bytes += header.size || 0;

    stream.on("end", next);

    stream.resume(); // just auto drain the stream
  });

  await pipeline(input, gunzip, extract);

  return bytes;
}
