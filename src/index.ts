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

async function run() {
	// await cache.addNewPackage('react');
	// await cache.addNewPackage('lodash');
	// tap:^14.2.4
	console.time("add tap@^14.2.4");
	await cache.addNewPackage("tap", "^14.2.4");
	console.timeEnd("add tap@^14.2.4");
}

run()
	.then(() => {
		console.log("finished");
	})
	.catch((e) => {
		console.error("Failed", e);
	})
	.finally(() => {
		const neededPackages = getAllNeededPackages();
		console.log("packagesNeeded:");
		console.log(neededPackages);

		const totalPackageVersions = neededPackages.length;

		console.log("Total of packages needed:", totalPackageVersions);
	});
