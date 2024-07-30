import type * as npm from "@npm/types";
import createFetchRetry from "fetch-retry";

const fetchWithRetry = createFetchRetry(fetch);

export async function fetchPackage(
  packageName: string,
  signal?: AbortSignal,
): Promise<npm.Packument> {
  // Package info is what being returned from
  // https://registry.npmjs.org/@babel/generator/

  // This was faster from using undici request somehow

  const response = await fetchWithRetry(
    `https://registry.npmjs.org/${packageName}`,
    {
      method: "GET",
      // For some reason there is a memory leak if using the same signal, so we just create a new one
      signal: signal ? AbortSignal.any([signal]) : signal,

      retries: 3,
      retryDelay: 1000,
    },
  ).catch((e) => {
    console.error("Failed to fetch package", packageName, e);

    throw e;
  });

  if (response.status >= 400) {
    const responseBody = await response.text();

    console.error("Failed to fetch package", packageName, responseBody);
    throw new Error(`Failed to fetch ${packageName}`);
  }

  return (await response.json()) as npm.Packument;
}

export async function fetchSpecificVersionPackage(
  packageName: string,
  version: string,
  signal?: AbortSignal,
): Promise<npm.PackumentVersion> {
  // Package info is what being returned from for latest version
  // https://registry.npmjs.org/@babel/generator/latest

  // This was faster from using undici request somehow

  const response = await fetchWithRetry(
    `https://registry.npmjs.org/${packageName}/${version}`,
    {
      method: "GET",
      signal,

      retries: 3,
      retryDelay: 1000,
    },
  ).catch((e) => {
    console.error("Failed to fetch package", packageName, e);

    throw e;
  });

  if (response.status >= 400) {
    const responseBody = await response.text();

    console.error("Failed to fetch package", packageName, responseBody);
    throw new Error(`Failed to fetch ${packageName}`);
  }

  return (await response.json()) as npm.PackumentVersion;
}

export async function doesPackageExist(
  packageName: string,
  signal?: AbortSignal,
): Promise<boolean> {
  // This was faster from using undici request somehow

  const response = await fetchWithRetry(
    `https://registry.npmjs.org/${packageName}`,
    {
      method: "HEAD",
      signal,

      retries: 3,
      retryDelay: 1000,
    },
  ).catch((e) => {
    console.error("Failed to fetch package", packageName, e);

    throw e;
  });

  // Must consume the body
  const responseBody = await response.text();

  if (response.status !== 404 && response.status >= 400) {
    console.error("Failed to fetch package", packageName, responseBody);
    throw new Error(`Failed to fetch ${packageName}`);
  }

  return response.status !== 404;
}
