import path from "node:path";
import {
  type RequiredPackages,
  fetchAndDownload,
} from "./fetch-and-download.js";
import { readJsonFile } from "./lib/fs-helpers.js";
import { readFromLocal } from "./package-finder/finder.js";
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

async function run() {
  // const progressBar = new cliProgress.MultiBar(
  //   {},
  //   cliProgress.Presets.shades_grey,
  // );
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

  const deps = await readFromLocal(ROOT_DIR);

  const requested = await readJsonFile<RequiredPackages>(
    path.join(ROOT_DIR, "requested.json"),
  );
  //
  // console.log(deps);

  await fetchAndDownload({
    packages: requested || {
      typeorm: ["latest"],
      // "@nestjs/cli": ["latest"],
      // fastify: ["latest"],
      // tap: ["^14.2.4"],
      // ...deps,
      // sigstore: ["2.3.1"],
      // "@sigstore/bundle": ["2.3.2"],
    },
    fetchConcurrency: 10,
    downloadConcurrency: 10,
    outputFolder,
    include: {
      devDependencies: false,
      dependencies: true,
      peerDependencies: true,
    },
    alsoFetchLatest: true,
    alwaysSaveCache: true,
    registryDataFilePath: "registry-data.json",
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
