import crypto, { randomInt } from "node:crypto";
import { execa } from "execa";
import type { NpmOptions } from "../../src/lib/npm/registry.js";
import { createTmpTgzFile } from "./tar-files.js";

export function getLocalNpmRegistry() {
  return `http://localhost:${getVerdaccioEnv().VERDACCIO_RANDOM_PORT}`;
}

function getVerdaccioEnv() {
  return JSON.parse(process.env.VERDACCIO_ENV || "{}");
}

export function getNpmOptions(): NpmOptions {
  return {
    registry: getLocalNpmRegistry(),
    cwd: process.env.CWD_WITH_VERDACCIO_TOKEN,
  };
}

export async function createTmpPackage({
  packageName,
  version,
}: {
  packageName?: string;
  version?: string;
} = {}): Promise<{ name: string; version: string; tarFilePath: string }> {
  packageName ??= crypto.randomUUID();

  // We hope that this package version will not be published by us manually
  version ??= `${randomInt(1000, 100000)}.28.53`;

  const packagePath = await createTmpTgzFile({
    "package/package.json": JSON.stringify({
      name: packageName,
      version,
      publishConfig: {
        // So we won't publish to the real registry by mistake
        registry: getLocalNpmRegistry(),
      },
    }),
  });

  return {
    name: packageName,
    version,
    tarFilePath: packagePath,
  };
}

export async function publishTmpPackage({
  distTag = "latest",
  ...options
}: {
  packageName?: string;
  version?: string;
  distTag?: string | null;
} = {}): Promise<{ name: string; version: string }> {
  const { tarFilePath, name, version } = await createTmpPackage(options);

  if (distTag === null) {
    distTag = `${name}@${version}`;
  }

  await execa({
    env: getVerdaccioEnv(),
    cwd: process.env.CWD_WITH_VERDACCIO_TOKEN,
  })`npm publish --tag ${distTag} ${tarFilePath}`;

  return {
    name,
    version,
  };
}
