import {execa} from "execa";

export interface NpmOptions {
    registry?: string;
}

function getNpmCliArgsFromOptions(options: NpmOptions): string {
    let cliArgs = "";

    if (options.registry) {
        cliArgs += ` --registry ${options.registry}`;
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
    const {stdout} = await execa(
        `npm view ${packageName}@${version}${extraCliArgs}`,
    );
    return stdout !== "";
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
    const {stdout} = await execa(
        `npm dist-tag ls ${packageName}${extraCliArgs}`,
    );
    const tags = stdout.split("\n");

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
        `npm dist-tag add ${packageName}@${version} latest${extraCliArgs}`,
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
    let tagString = "";

    if (!setLatest) {
        tagString = `--tag ${packageName}@${version}`;
    }

    await execa(`npm publish ${tagString}${extraCliArgs}`);
}
