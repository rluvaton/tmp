import type * as npm from "@npm/types";
import { fetchPackage } from "./fetcher.js";

interface ModuleCache {
	info: npm.Packument;

	// All versions of the package
	versions: string[];
}

const cache: Map<string, ModuleCache> = new Map();
const fetchCache: Map<string, Promise<unknown>> = new Map();

// TODO - allow saving cache to disk

export function getModuleCache(name: string): ModuleCache | undefined {
	return cache.get(name);
}

export function isModuleInCache(name: string): boolean {
	return cache.has(name);
}

export function addNewModule(name: string, moduleInfo: npm.Packument): void {
	if (cache.has(name)) {
		return;
	}

	cache.set(name, {
		info: moduleInfo,
		versions: Object.keys(moduleInfo.versions),
	});
}

export function isModuleFetchingInProgress(name: string): boolean {
	return cache.has(name) || fetchCache.has(name);
}

export async function fetchModuleInfoToCache(packageName: string): Promise<{}> {
	const prefix = `[${packageName}]`;

	if (cache.has(packageName)) {
		console.log(`${prefix} Already fetched`);
		return cache.get(packageName)!.info;
	}

	if (fetchCache.has(packageName)) {
		console.log(
			`${prefix} fetch already in progress, waiting for it to finish`,
		);
		await fetchCache.get(packageName);

		return cache.get(packageName)!.info;
	}

	// TODO - add some progress bar for overall packages download
	console.log(`${prefix} FETCHING`);
	const fetchPackagePromise = fetchPackage(packageName).then((packageInfo) => {
		addNewModule(packageName, packageInfo);

		return packageInfo;
	});

	fetchCache.set(packageName, fetchPackagePromise);
	const packageInfo = await fetchPackagePromise;
	fetchCache.delete(packageName);

	return packageInfo;
}

export function getLatestVersionForPackage(
	packageName: string,
): string | undefined {
	return cache.get(packageName)?.info?.["dist-tags"]?.latest;
}
