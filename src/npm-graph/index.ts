import type { queueAsPromised } from "fastq";
import * as fastq from "fastq";
import {
	fetchModuleInfoToCache,
	isModuleFetchingInProgress,
	isModuleInCache,
} from "./module-cache.js";
import {
	type DependenciesType,
	getSpecificPackageDependencies,
	getSpecificPackageVersion,
} from "./module.js";
import {
	addNewNeededPackage,
	hasNeededPackageVersion,
} from "./needed-packages.js";

type Task = {
	id: number;
};

const q: queueAsPromised<Task> = q
	.push({ id: 42 })
	.catch((err) => console.error(err));

async function asyncWorker(arg: Task): Promise<void> {
	// No need for a try-catch block, fastq handles errors automatically
	console.log(arg.id);
}

enum AddPackageResult {
	Added = 0,
	AlreadyExist = 1,
	MissingPackageVersion = 2,
	MissingPackage = 3,
}

export class PackagesGraph {
	private fetchDataPool: queueAsPromised<unknown>;
	private include: DependenciesType;
	private addLatest: boolean;

	constructor({
		concurrency,
		include,
		addLatest,
	}: {
		concurrency: number;
		include: DependenciesType;
		addLatest: boolean;
	}) {
		this.fetchDataPool = fastq.promise(fetchModuleInfoToCache, concurrency);
		this.include = include;
		this.addLatest = addLatest;
	}

	async addNewPackage(packageName: string, versionRangeOrDistTag = "latest") {
		const promises: Promise<void>[] = [];

		promises.push(
			this.processSinglePackage({
				packageName,
				versionRangeOrDistTag,
			}),
		);

		if (versionRangeOrDistTag !== "latest" && this.addLatest) {
			promises.push(
				this.processSinglePackage({
					packageName,
					versionRangeOrDistTag: "latest",
				}),
			);
		}

		await Promise.all(promises);
	}

	// Allow to continue after failure

	private async processSinglePackage({
		packageName,
		versionRangeOrDistTag,
	}: {
		packageName: string;
		versionRangeOrDistTag: string;
	}): Promise<void> {
		const prefix = `[${packageName}:${versionRangeOrDistTag}]`;
		console.log(`${prefix} Adding`);

		// TODO - add some progress bar for overall packages download
		if (
			!isModuleInCache(packageName) &&
			isModuleFetchingInProgress(packageName)
		) {
			// Don't add to pool, so we won't take the pool by duplicate requests
			await fetchModuleInfoToCache(packageName);
		} else if (!isModuleInCache(packageName)) {
			await this.fetchDataPool.add(() => fetchModuleInfoToCache(packageName));
		}

		const version = getSpecificPackageVersion(
			packageName,
			versionRangeOrDistTag,
			{
				preferAlreadyDownloaded: versionRangeOrDistTag !== "latest",
			},
		);

		if (!version) {
			console.warn(`${prefix} missing`);
			return;
		}

		// Already processed

		if (hasNeededPackageVersion(packageName, version.version)) {
			// console.log(`${prefix} already exists`);
			return;
		}

		addNewNeededPackage(packageName, version);

		const deps = getSpecificPackageDependencies(version, this.include) || {};

		const allDepsProcessData = Object.entries(deps).flatMap(
			([depName, depVersion]) =>
				[
					{
						packageName: depName,
						versionRangeOrDistTag: depVersion,
					},
					this.addLatest && {
						packageName: depName,
						versionRangeOrDistTag: "latest",
					},
				].filter(Boolean),
		);

		// TODO - maybe do in parallel, but fetch only once, so if already in progress of fetching
		await Promise.all(
			allDepsProcessData.map((data) => data && this.processSinglePackage(data)),
		);

		console.log(`${prefix} finished`);

		// What about if dependency failed to add or something
		return;
	}
}
