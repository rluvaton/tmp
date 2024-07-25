import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { doesFileExist } from "../lib/fs-helpers.js";
import {
  type ModuleCache,
  getModuleInfoCache,
  loadModuleInfoCache,
} from "../npm-graph/module-cache/index.js";

interface CacheData {
  modulesInfo: {
    [name: string]: ModuleCache;
  };
}

export async function loadCache(cachedFilePath: string) {
  if (!(await doesFileExist(cachedFilePath))) {
    return;
  }

  let data: CacheData;

  try {
    data = JSON.parse((await fsPromises.readFile(cachedFilePath)).toString());
  } catch (e) {
    console.error("Failed to load cache", e);
    return;
  }

  loadModuleInfoCache(data.modulesInfo);
}

function buildCache(): CacheData {
  return {
    modulesInfo: getModuleInfoCache(),
  };
}

export async function saveCache(cachedFilePath: string) {
  await fsPromises.writeFile(cachedFilePath, JSON.stringify(buildCache()));
}

export function saveCacheSync(cachedFilePath: string) {
  fs.writeFileSync(cachedFilePath, JSON.stringify(buildCache()));
}
