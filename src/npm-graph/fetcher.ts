import type * as npm from "@npm/types";

export async function fetchPackage(
  packageName: string,
  signal?: AbortSignal,
): Promise<npm.Packument> {
  // Package info is what being returned from
  // https://registry.npmjs.org/@babel/generator/

  // This was faster from using undici request somehow

  // TODO - on timeout, retry
  const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
    method: "GET",
    signal,
  });

  if (response.status >= 400) {
    const responseBody = await response.text();

    console.error("Failed to fetch package", packageName, responseBody);
    throw new Error(`Failed to fetch ${packageName}`);
  }

  return (await response.json()) as npm.Packument;
}
