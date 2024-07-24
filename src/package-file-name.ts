import type { NeededPackage } from "./npm-graph/needed-packages.js";

export function createFileNameFromPackage(
  packageDetails: NeededPackage,
): string {
  return `${packageDetails.isLatest ? "latest" : "not-latest"}__${packageDetails.name}__${packageDetails.version}.${packageDetails.url.split(".").pop()}`;
}

export function parseFileNameFromPackage(fileName: string): {
  isLatest: boolean;
  name: string;
  version: string;
} {
  const withoutExtension = fileName.split(".").slice(0, -1).join(".");
  const [isLatest, name, version] = withoutExtension.split("__");

  return {
    isLatest: isLatest === "latest",
    name,
    version,
  };
}
