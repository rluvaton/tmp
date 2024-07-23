import {run} from "node:test";
import {spec as Spec} from "node:test/reporters";

import {glob} from 'glob';
import path from "node:path";

const ROOT_DIR = import.meta.dirname;

process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --import ./load-ts.js`;

function getTestFiles() {
    const srcFiles = glob.sync('**/*.test.ts', {
        cwd: path.join(ROOT_DIR, 'src'),
        nodir: true,
        absolute: true,
    });

    const testFiles = glob.sync('**/*.test.ts', {
        cwd: path.join(ROOT_DIR, 'test'),
        nodir: true,
        absolute: true,
    });

    return srcFiles.concat(testFiles);
}

const testFiles = getTestFiles();

run({
    files: testFiles,
    timeout: 10000,
})
    .compose(new Spec())
    .pipe(process.stdout);
