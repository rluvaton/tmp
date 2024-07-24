import crypto from "node:crypto";
import type { NpmOptions } from "../../src/lib/npm/registry.js";

export function getLocalNpmRegistry() {
	return "http://localhost:4874";
}

export function getNpmOptions(): NpmOptions {
	return {
		registry: getLocalNpmRegistry(),
	};
}

export async function publishTmpPackage({
	packageName,
	version,
	distTag = "latest",
}: {
	packageName?: string;
	version?: string;
	distTag?: string | null;
} = {}): Promise<{ name: string; version: string }> {
	packageName ??= crypto.randomUUID();

	// We hope that this package version will not be published by us manually
	version ??= "94.28.53";

	// TODO:
	//  1. Create temporary tar file
	//  2. publish it to the local registry with provided version if exists and distTag
	//  3. return the package name and version that published

	return {
		name: packageName,
		version: version,
	};
}
