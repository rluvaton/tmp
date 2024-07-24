import os from "node:os";

import { runServer } from "verdaccio";

import fs from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import fsExtra from "fs-extra";

let portNumber: number | undefined;
let verdaccioInstance: Server | undefined;
let verdaccioDataFolder: string | undefined;
let tmpFolderWithToken: string | undefined;

async function createUniqueFolder() {
  const testOutputFolder = path.join(os.tmpdir(), "verdaccio-example");
  const doesPathExist = await fsExtra.pathExists(testOutputFolder);
  if (!doesPathExist) {
    await fsExtra.mkdir(testOutputFolder, { recursive: true });
  }
  return await fsExtra.mkdtemp(`${testOutputFolder}${path.sep}`);
}

function getNpmEnvironmentVariables(port: number) {
  return {
    // This is used in the .npmrc file
    VERDACCIO_RANDOM_PORT: port.toString(),

    // This is to require the npm operations to use our local registry
    // some_user:some_password exists as we must have token, so we can publish
    // https://github.com/verdaccio/verdaccio/issues/212#issuecomment-308578500
    npm_config_registry: `http://localhost:${port}/`,
  };
}

async function getTmpFolderWithToken(port: number) {
  if (!tmpFolderWithToken) {
    const testOutputFolder = path.join(os.tmpdir(), "token-folder");
    const doesPathExist = await fsExtra.pathExists(testOutputFolder);
    if (!doesPathExist) {
      await fsExtra.mkdir(testOutputFolder, { recursive: true });
    }

    const tmpFolderPath = await fsExtra.mkdtemp(
      `${testOutputFolder}${path.sep}`,
    );

    // Must have token, so we can publish
    // https://github.com/verdaccio/verdaccio/issues/212#issuecomment-308578500
    await fs.writeFile(
      path.join(tmpFolderPath, ".npmrc"),
      `//localhost:${port}/:_authToken="e2e-verdaccio-cli-test-fake-token"`,
    );

    tmpFolderWithToken = tmpFolderPath;
  }

  return tmpFolderWithToken;
}

export async function setupVerdaccio() {
  if (verdaccioInstance) {
    if (portNumber === undefined || verdaccioDataFolder === undefined) {
      throw new Error("verdaccio initiated but no port or data folder exist");
    }

    return {
      npmEnvironmentVars: getNpmEnvironmentVariables(portNumber),
      tmpFolderWithToken: await getTmpFolderWithToken(portNumber),
    };
  }

  verdaccioDataFolder = await createUniqueFolder();

  const config = {
    // Where verdaccio will store its data
    // biome-ignore lint/style/noNonNullAssertion: it can't be null
    storage: path.join(verdaccioDataFolder!, "storage"),

    // biome-ignore lint/style/noNonNullAssertion: it can't be null
    self_path: verdaccioDataFolder!,

    packages: {
      // Making our application only go to verdaccio registry and not to the default one,
      // which also prevent it from being published to npm

      "@*/*": {
        access: ["$all"],

        // Allowing the package to be published without user
        publish: ["$anonymous"],
      },
      "**": {
        access: ["$all"],

        // Allowing the package to be published without user
        publish: ["$anonymous"],
      },
    },

    logs: {
      type: "stdout",
      format: "pretty",

      // For debugging, you may want to change this to `http`
      level: "fatal",
    },

    security: null,
  };
  // @ts-expect-error the types for run server does not match the docs
  verdaccioInstance = (await runServer(config)) as Server;

  // Don't hold the verdaccio server as what keeping the process alive
  verdaccioInstance.unref();

  portNumber = await new Promise<number>((resolve, reject) => {
    // Port 0 means any available local port
    // biome-ignore lint/style/noNonNullAssertion: it can't be null
    const result = verdaccioInstance!.listen(0, () =>
      resolve((result.address() as AddressInfo).port),
    );
    result.on("error", reject);
  });

  return {
    npmEnvironmentVars: getNpmEnvironmentVariables(portNumber),
    tmpFolderWithToken: await getTmpFolderWithToken(portNumber),
  };
}

export async function teardownVerdaccio() {
  if (verdaccioInstance) {
    await verdaccioInstance.close();
    verdaccioInstance = undefined;
  }

  if (verdaccioDataFolder) {
    await fsExtra.remove(verdaccioDataFolder);
    verdaccioDataFolder = undefined;
  }

  portNumber = undefined;
}
