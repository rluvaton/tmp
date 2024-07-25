import assert from "node:assert";
import path from "node:path";
import type { NeededPackage } from "./npm-graph/needed-packages.js";

export function createFileNameFromPackage(
  packageDetails: NeededPackage,
): string {
  // not-latest__@npm__types__1.0.0.tgz
  return `${packageDetails.isLatest ? "latest" : "not-latest"}__${packageDetails.name.replace("/", "__")}__${packageDetails.version}.${packageDetails.url.split(".").pop()}`;
}

export function parseFileNameFromPackage(filePath: string): {
  isLatest: boolean;
  name: string;
  version: string;
} {
  const fileName = path.basename(filePath);
  const withoutExtension = fileName.split(".").slice(0, -1).join(".");
  const parts = withoutExtension.split("__");

  assert.strictEqual(
    parts.length <= 4,
    true,
    `Invalid package file name: ${fileName}`,
  );
  assert.strictEqual(
    parts.length >= 3,
    true,
    `Invalid package file name: ${fileName}`,
  );

  // biome-ignore lint/style/noNonNullAssertion: must exists
  const isLatest = parts.shift()!;
  // biome-ignore lint/style/noNonNullAssertion: must exists
  const version = parts.pop()!;
  const name = parts.join("/");

  return {
    isLatest: isLatest === "latest",
    name,
    version,
  };
}
