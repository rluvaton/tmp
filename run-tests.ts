import { run } from "node:test";
import { spec as Spec } from "node:test/reporters";

import path from "node:path";
import { glob } from "glob";
import { runVerdaccio } from "./test/setup/verdaccio.js";

import inspector from "node:inspector";

const ROOT_DIR = import.meta.dirname;

function isInDebugMode() {
	return inspector.url() !== undefined;
}

// process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ""} --import ./load-ts.js`;

function getTestFiles() {
	const srcFiles = glob.sync("**/*.test.ts", {
		cwd: path.join(ROOT_DIR, "src"),
		nodir: true,
		absolute: true,
	});

	const testFiles = glob.sync("**/*.test.ts", {
		cwd: path.join(ROOT_DIR, "test"),
		nodir: true,
		absolute: true,
	});

	return srcFiles.concat(testFiles);
}

const testFiles = getTestFiles();

const { npmEnvironmentVars, tmpFolderWithToken } = await runVerdaccio();

process.env.VERDACCIO_ENV = JSON.stringify(npmEnvironmentVars);
process.env.CWD_WITH_VERDACCIO_TOKEN = tmpFolderWithToken;

run({
	files: testFiles,
	timeout: isInDebugMode() ? undefined : 60_000,
})
	.compose(new Spec())
	.pipe(process.stdout);
