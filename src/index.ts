import path from "node:path";
import cliProgress, { MultiBar } from "cli-progress";
import { loadCache, saveCache, saveCacheSync } from "./cache/index.js";
import { downloadPackage } from "./downloader/index.js";
import { fetchAndDownload } from "./fetch-and-download.js";
import { ROOT_DIR } from "./root-dir.js";
import { uploadPackages } from "./upload-packages.js";
import { uploadPackage } from "./uploader/index.js";

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

async function run() {
  const progressBar = new cliProgress.MultiBar(
    {},
    cliProgress.Presets.shades_grey,
  );
  //
  // await downloadPackage(
  //   {
  //     name: "@sigstore/tuf@2.3.4",
  //     version: "2.3.4",
  //     isLatest: true,
  //     url: "https://registry.npmjs.org/@sigstore/tuf/-/tuf-2.3.4.tgz",
  //     shouldRemoveProvenance: true,
  //     shouldRemoveCustomRegistry: false,
  //   },
  //   outputFolder,
  //   progressBar,
  // );
  //
  // progressBar.stop();

  // TODO - fix provenance for sigstore@2.3.1

  // await uploadPackages({
  //   concurrency: 10,
  //   registry: "http://localhost:4873",
  //   outputFolder,
  //   removeFilesAfterUpload: true,
  // });

  await fetchAndDownload({
    packages: {
      // tap: ["^14.2.4"],
      sigstore: ["2.3.1"],
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
    alwaysSaveCache: true,
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
