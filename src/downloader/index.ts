import path from "node:path";
import type { NeededPackage } from "../npm-graph/needed-packages.js";
import { createFileNameFromPackage } from "../package-file-name.js";
import {request} from "undici";
import {pipeline} from "node:stream/promises";
import * as fs from "node:fs";
import {
	getPackageJsonFromPackageTarFile,
	type PackageJsonDetails,
} from "../npm.js";
import {writeFileInTar} from "../lib/tar/modify-files.js";

// Worker to download the files and update the package json if needed
async function fixPackage(packageDetails: NeededPackage, packagePath: string) {
	const prettyPath = path.basename(packagePath);

	let packageJsonDetails: PackageJsonDetails;
	try {
		packageJsonDetails = await getPackageJsonFromPackageTarFile(packagePath);
	} catch (e) {
		if ((e as { code: string }).code === "TAR_BAD_ARCHIVE") {
			console.error(`${prettyPath} is not a valid tar file`, e);
		} else {
			console.error(`Failed to get package metadata for ${prettyPath}`);
		}
		throw e;
	}

	const removeKeys = [];

	if (packageDetails.shouldRemoveCustomRegistry) {
		removeKeys.push("registry");
		packageJsonDetails.packageJson.registry = undefined;
	}

	if (packageDetails.shouldRemoveProvenance) {
		removeKeys.push("provenance");
		packageJsonDetails.packageJson.provenance = undefined;
	}

	if (removeKeys.length) {
		console.log(
			`Removing ${removeKeys.join(", ")} from ${prettyPath} package.json`,
		);

		await writeFileInTar(packagePath, {
			[packageJsonDetails.packageJsonPathInsideTar]: JSON.stringify(
				packageJsonDetails.packageJson,
				null,
				2,
			),
		});
	}
}

async function downloadPackageUrl(
	packageDetails: NeededPackage,
	folder: string,
): Promise<string> {
	const fileName = createFileNameFromPackage(packageDetails);

	const fullPath = path.join(folder, fileName);

	const response = await request(packageDetails.url, {
		method: "GET",
	});

	if (response.statusCode >= 400) {
		console.error(
			"Failed to download file ",
			packageDetails.url,
			await response.body
				.text()
				.catch(() => "response.body.text().catch(() failed"),
		);

		throw new Error(`Failed to download file ${packageDetails.url}`);
	}

	await pipeline(response.body, fs.createWriteStream(fullPath));

	return fullPath;
}

export async function downloadPackage(
	packageDetails: NeededPackage,
	folder: string,
) {
	const filePath = await downloadPackageUrl(packageDetails, folder);

	if (
		packageDetails.shouldRemoveCustomRegistry ||
		packageDetails.shouldRemoveProvenance
	) {
		await fixPackage(packageDetails, filePath);
	}

	return filePath;
}
