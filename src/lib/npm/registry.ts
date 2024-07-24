import { execa } from "execa";

export interface NpmOptions {
	registry?: string;
}

function getNpmCliArgsFromOptions(options: NpmOptions): string[] {
	const cliArgs: string[] = [];

	if (options.registry) {
		cliArgs.push("--registry", options.registry);
	}

	return cliArgs;
}

export async function isPackagePublished({
	packageName,
	version,
	options = {},
}: {
	packageName: string;
	version: string;
	options?: NpmOptions;
}): Promise<boolean> {
	const extraCliArgs = getNpmCliArgsFromOptions(options);
	const { stdout, stderr } = await execa(
		"npm",
		["view", `${packageName}@${version}`, "--json", ...extraCliArgs],
		{
			// Don't throw on process failure
			reject: false,
		},
	);

	// biome-ignore lint/suspicious/noExplicitAny: we don't know the type if it's not an error or something
	let parsed: any;

	try {
		parsed = JSON.parse(stdout);
	} catch (e) {
		console.error("Failed to parse JSON stdout", {
			stdout,
			stderr,
			parseJsonError: e,
		});

		throw e;
	}

	const errorCode = parsed?.error?.code;

	// Not published
	if (errorCode === "E404") {
		return false;
	}

	if (errorCode) {
		let errorMessageFromOutput: string;
		if (parsed.error.summary) {
			errorMessageFromOutput = parsed.error.summary;
			errorMessageFromOutput += parsed.error.detail || "";
		} else {
			errorMessageFromOutput = `Unknown error\n\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`;
		}

		throw new Error(errorMessageFromOutput);
	}

	return true;
}

export async function isPublishedPackageLatest({
	packageName,
	version,
	options = {},
}: {
	packageName: string;
	version: string;
	options?: NpmOptions;
}): Promise<boolean> {
	const extraCliArgs = getNpmCliArgsFromOptions(options);
	const { all } = await execa(
		"npm",
		["dist-tag", "ls", `${packageName}@${version}`, ...extraCliArgs],
		{
			all: true,
		},
	);

	const tags = all.split("\n");

	return tags.includes(`latest: ${version}`);
}

export async function markPublishedPackageAsLatest({
	packageName,
	version,
	options = {},
}: {
	packageName: string;
	version: string;
	options?: NpmOptions;
}) {
	const extraCliArgs = getNpmCliArgsFromOptions(options);

	await execa(
		"npm",
		["dist-tag", "add", `${packageName}@${version}`, "latest", ...extraCliArgs],
		{
			all: true,
		},
	);
}

export async function publishPackage({
	packageName,
	version,
	setLatest,
	options = {},
}: {
	packageName: string;
	version: string;
	setLatest: boolean;
	options?: NpmOptions;
}) {
	const extraCliArgs = getNpmCliArgsFromOptions(options);
	const tagOptions: string[] = [];

	if (!setLatest) {
		tagOptions.push("--tag", `${packageName}@${version}`);
	}

	await execa(
		"npm",
		["publish", `${packageName}@${version}`, ...tagOptions, ...extraCliArgs],
		{
			all: true,
		},
	);
}
