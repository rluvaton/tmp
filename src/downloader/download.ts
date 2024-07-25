import * as fs from "node:fs";
import fsPromises from "node:fs/promises";
import type { SingleBar } from "cli-progress";
import { Client } from "undici";
import { getContentSizeFromHeaders } from "../lib/undici-helpers.js";
import type { NeededPackage } from "../npm-graph/needed-packages.js";

export async function downloadPackageUrl(
  packageDetails: NeededPackage,
  outputPath: string,
  progressBar?: SingleBar,
): Promise<void> {
  const url = new URL(packageDetails.url);

  const client = new Client(url.origin);

  let dataWhenError = "";

  let requestFailed = false;

  let output: fs.WriteStream;
  let total = 0;

  await new Promise<void>((resolve, reject) => {
    client.dispatch(
      {
        path: packageDetails.url.slice(url.origin.length),
        method: "GET",
      },
      {
        onConnect() {},
        onError: reject,
        onHeaders: (statusCode, headers) => {
          requestFailed = statusCode >= 400;

          const contentSize = getContentSizeFromHeaders(headers);

          if (contentSize !== undefined) {
            total = contentSize;
            progressBar?.setTotal(100);
          }

          if (!requestFailed) {
            output = fs.createWriteStream(`${outputPath}.tmp`);

            progressBar?.update({
              packageWithVersion: `${packageDetails.name}@${packageDetails.version}`,
              step: "Downloading",
            });
          }

          return true;
        },
        onData: (chunk) => {
          progressBar?.increment((chunk.length / total) * 100);
          if (requestFailed) {
            dataWhenError += chunk.toString();
          } else {
            output.write(chunk);
          }

          return true;
        },
        onComplete: () => {
          resolve();

          if (!requestFailed) {
            output.close();
          }
        },
      },
    );
  }).finally(() => {
    client.close();
  });

  if (requestFailed) {
    console.error(
      "Failed to download file ",
      packageDetails.url,
      dataWhenError,
    );

    throw new Error(`Failed to download file ${packageDetails.url}`);
  }

  await fsPromises.rename(`${outputPath}.tmp`, outputPath);
}
