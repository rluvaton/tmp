import type * as npm from "@npm/types";
import { getLatestVersionForPackage } from "./module-cache.js";

interface SingleNeededPackageVersion {
	url: string;
	isLatest: boolean;
	shouldRemoveProvenance: boolean;
	shouldRemoveCustomRegistry: boolean;
}

export interface NeededPackage extends SingleNeededPackageVersion {
	name: string;
	version: string;
}

interface NeededPackages {
	[version: string]: SingleNeededPackageVersion;
}

// TODO - allow saving cache to disk

// Package name to versions
const neededPackages: Map<string, NeededPackages> = new Map();

export function getAllNeededPackages(): NeededPackage[] {
	return Array.from(neededPackages.entries()).flatMap(([name, versions]) =>
		Object.entries(versions).map(([version, info]) => ({
			name,
			version,
			...info,
		})),
	);
}

export function hasNeededPackageVersion(
	name: string,
	version: string,
): boolean {
	return !!neededPackages.get(name)?.[version];
}

export function hasNeededPackage(name: string): boolean {
	return !!neededPackages.get(name);
}

export function getAlreadyNeededPackageVersions(name: string) {
	return Object.keys(neededPackages.get(name) || {});
}

export function addNewNeededPackage(
	name: string,
	packageVersion: npm.PackumentVersion,
): void {
	const isLatest = getLatestVersionForPackage(name) === packageVersion.version;

	let neededPackage: NeededPackages | undefined = neededPackages.get(name);

	if (!neededPackage) {
		neededPackage = {};
		neededPackages.set(name, neededPackage);
	} else if (neededPackage[packageVersion.version]) {
		// Already exists
		return;
	}

	neededPackage[packageVersion.version] = {
		isLatest,
		url: packageVersion.dist.tarball,
		shouldRemoveProvenance: !!packageVersion.publishConfig?.provenance,
		shouldRemoveCustomRegistry: !!packageVersion.publishConfig?.registry,
	};
}
