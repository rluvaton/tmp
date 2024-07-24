import { PackagesGraph } from "./npm-graph/index.js";
import { getAllNeededPackages } from "./npm-graph/needed-packages.js";

const cache = new PackagesGraph({
  concurrency: 10,
  addLatest: true,
  include: {
    bundledDependencies: false,
    bundleDependencies: false,
    devDependencies: false,
    dependencies: true,
    peerDependencies: true,
  },
});

async function addPackages() {
  // await cache.addNewPackage('react');
  // await cache.addNewPackage('lodash');
  // tap:^14.2.4
  console.time("add tap@^14.2.4");
  await cache.addNewPackage("tap", "^14.2.4");
  console.timeEnd("add tap@^14.2.4");
}

async function run() {
  try {
    await addPackages();
  } catch (e) {
    console.error("Failed to add packages", e);

    // TODO - save cache to disk so next time can continue from there

    throw e;
  }
}

run()
  .then(() => {
    console.log("finished");
  })
  .catch((e) => {
    console.error("Failed", e);
    process.exit(1);
  })
  .finally(() => {
    const neededPackages = getAllNeededPackages();
    console.log("packagesNeeded:");
    console.log(neededPackages);

    const totalPackageVersions = neededPackages.length;

    console.log("Total of packages needed:", totalPackageVersions);
  });
