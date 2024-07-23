import type * as npm from "@npm/types";

export async function fetchPackage(
	packageName: string,
): Promise<npm.Packument> {
	// Package info is what being returned from
	// https://registry.npmjs.org/@babel/generator/
	// TODO - change to undici
	const response = await fetch(`https://registry.npmjs.org/${packageName}/`);

	return (await response.json()) as npm.Packument;
}

export async function downloadUrl(url: string, isLatest: boolean) {
	// TODO
}
