import { ExecaError, execa } from "execa";

export interface NpmOptions {
	registry?: string;
	cwd?: string;
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
	try {
		await execa(
			"npm",
			["view", `${packageName}@${version}`, "--json", ...extraCliArgs],
			{
				cwd: options.cwd,
			},
		);
	} catch (error) {
		if (!(error instanceof ExecaError)) {
			throw error;
		}

		const stdout = error.stdout as unknown as string;

		try {
			const parsed = JSON.parse(stdout);
			const errorCode = parsed?.error?.code;

			// Not published
			if (errorCode === "E404") {
				return false;
			}
		} catch {}

		throw error;
	}

	// If not failed than the package version exists
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
	const { stdout } = await execa(
		"npm",
		[
			"view",
			packageName,
			// Version returns the latest
			"version",
			"--json",
			...extraCliArgs,
		],
		{
			cwd: options.cwd,
		},
	);

	return JSON.parse(stdout) === version;
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
			cwd: options.cwd,
		},
	);
}

export async function publishPackage({
	packageName,
	version,
	tarFilePath,
	setLatest,
	options = {},
}: {
	packageName: string;
	version: string;
	tarFilePath: string;
	setLatest: boolean;
	options?: NpmOptions;
}) {
	const extraCliArgs = getNpmCliArgsFromOptions(options);

	const tag = setLatest ? "latest" : `${packageName}@${version}`;

	await execa("npm", ["publish", "--tag", tag, ...extraCliArgs, tarFilePath], {
		all: true,
		cwd: options.cwd,
	});
}
