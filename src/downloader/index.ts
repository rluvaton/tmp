import path from "node:path";
import type { NeededPackage } from "../npm-graph/needed-packages.js";
import { createFileNameFromPackage } from "../package-file-name.js";

// Worker to download the files and update the package json if needed
async function fixPackage(packageDetails: NeededPackage) {
	// TODO - remove the
}

async function downloadPackageUrl(
	packageDetails: NeededPackage,
	folder: string,
): Promise<string> {
	const fileName = createFileNameFromPackage(packageDetails);

	const fullPath = path.join(folder, fileName);

	return fullPath;
}

export async function downloadPackage(packageDetails: NeededPackage) {
	// TODO
	const filePath = await downloadPackageUrl(packageDetails);

	if (
		packageDetails.shouldRemoveCustomRegistry ||
		packageDetails.shouldRemoveProvenance
	) {
		await fixPackage(packageDetails);
	}

	return filePath;
}

function createFileName(packageDetails: NeededPackage): string {
	// Add not latest so when publishing we can see the difference
	return `${packageDetails.isLatest ? "latest-" : "not-latest"}-${packageDetails.name}-${packageDetails.version}.${packageDetails.url.split(".").pop()}`;
}
