import path from "node:path";
import { loadCache, saveCache, saveCacheSync } from "./cache/index.js";
import { fetchAndDownload } from "./fetch-and-download.js";
import { ROOT_DIR } from "./root-dir.js";

//
// await downloadPackage(
//   {
//     name: "@biomejs/cli-darwin-arm64",
//     version: "1.8.3",
//     url: "https://registry.npmjs.org/@biomejs/cli-darwin-arm64/-/cli-darwin-arm64-1.8.3.tgz",
//     shouldRemoveProvenance: false,
//     shouldRemoveCustomRegistry: false,
//     isLatest: false,
//   },
//   path.join(ROOT_DIR, "output"),
//   downloadProgressBar,
// );

const outputFolder = path.join(ROOT_DIR, "output");
const cacheFilePath = path.join(outputFolder, "cache.json");

const abort = new AbortController();

async function run() {
  // await downloadPackage(
  //   {
  //     name: "@sigstore/bundle@2.3.2",
  //     version: "2.3.2",
  //     isLatest: true,
  //     url: "https://registry.npmjs.org/@sigstore/bundle/-/bundle-2.3.2.tgz",
  //     shouldRemoveProvenance: true,
  //     shouldRemoveCustomRegistry: true,
  //   },
  //   "/Users/rluvaton/dev/open-source/rluvaton/bulk-npm-publish-2/output",
  // );

  await loadCache(cacheFilePath);

  await fetchAndDownload({
    packages: {
      tap: ["^14.2.4"],
      // "@sigstore/bundle": ["2.3.2"],
    },
    fetchConcurrency: 10,
    downloadConcurrency: 10,
    outputFolder,
    include: {
      bundledDependencies: false,
      bundleDependencies: false,
      devDependencies: false,
      dependencies: true,
      peerDependencies: true,
    },
    alsoFetchLatest: true,
    signal: abort.signal,
  }).catch(async (e) => {
    // Only in failure save cache
    await saveCache(cacheFilePath).catch((cacheError) =>
      console.error("Failed to save cache", cacheError),
    );

    throw e;
  });
}

run()
  .then(() => {
    console.log("finished");
  })
  .catch((e) => {
    console.error("Failed", e);
    process.exit(1);
  });

// On CTRL-C
process.on("SIGINT", () => {
  abort.abort(new Error("Received SIGINT"));

  console.log("Saving cache");
  // Only in failure save cache
  try {
    saveCacheSync(cacheFilePath);
    console.log("Cache saved successfully");
  } catch (e) {
    console.error("Failed to save cache", e);
  }

  process.exit(2 /* SIGINT */);
});
