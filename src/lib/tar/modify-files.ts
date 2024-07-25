import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { Readable } from "node:stream";
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

export async function modifyFilesInTar(
  tarFile: string,
  filesToChange: FilesToChange,
) {
  const tmpOutputPath = `${tarFile}.tmp.tgz`;

  const uncompressedSizeInBytes = await getUncompressedTgzSizeInBytes(tarFile);

  const useInMemory = uncompressedSizeInBytes <= ONE_MB * 10;

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
  const pack = tarStream.pack();
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
      stream.on("end", () => pack.entry(header, newContent, next));

      // Must consume the data
      stream.resume();
    } else {
      try {
        // Need to do this as for some reason the stream does not have the Readable functionality
        const readable = Readable.from(stream);
        const fileContent = await readable.reduce(
          (acc: string, chunk: Buffer) => {
            return acc + chunk.toString();
          },
          "",
        );

        // biome-ignore lint/style/noNonNullAssertion: it must exists
        const replaced = newContent(fileContent!);

        if (replaced === null) {
          pack.entry(header, next);
        } else {
          pack.entry(header, replaced, next);
        }
      } catch (e) {
        next(e);
      }
    }

    // replace the content
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

  let f = false;

  extract.on("entry", (header, stream, next) => {
    if (f) {
      console.error("already finished");
    }
    bytes += header.size || 0;

    next();
  });

  await pipeline(input, gunzip, extract);
  f = true;
  return bytes;
}
