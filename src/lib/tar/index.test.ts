import assert from "node:assert";
import { describe, it } from "node:test";
import { createTmpTgzFile } from "../../../test/helpers/tar-files.js";
import { getFileContentFromTar, getListOfFilesFromTar } from "./index.js";

describe("Tar", () => {
  it("Get file content from glob should return the matching file content", async () => {
    const topPackageJson = JSON.stringify({
      name: "test-package",
      version: "1.0.0",
    });
    const otherPackageJson = JSON.stringify({
      name: "other-package",
      version: "2.0.0",
    });
    const packageJsonLists = {
      "package/package.json": topPackageJson,
      "package/something/package.json": otherPackageJson,
    };
    const tmpTarFile = await createTmpTgzFile({
      ...packageJsonLists,
      "package/index.js": 'console.log("Hello World")',
      "package/LICENSE": "MIT",
      "package/README.md": "# Test package\n\nThis is a test package\n",
    });

    const packageJsonContentBuffer = await getFileContentFromTar(
      tmpTarFile,
      "**/package.json",
    );

    const packageJsonContent = Object.fromEntries(
      Object.entries(packageJsonContentBuffer).map(([key, value]) => [
        key,
        value.toString(),
      ]),
    );

    assert.deepStrictEqual(packageJsonContent, packageJsonLists);
  });

  it("get list of files should return all files", async () => {
    const tarFileContent = {
      "package/index.js": 'console.log("Hello World")',
      "package/package.json": JSON.stringify({
        name: "test-package",
        version: "1.0.0",
      }),
      "package/LICENSE": "MIT",
      "package/README.md": "# Test package\n\nThis is a test package\n",
    };
    const tmpTarFile = await createTmpTgzFile(tarFileContent);

    const files = await getListOfFilesFromTar(tmpTarFile);

    assert.deepStrictEqual(files.sort(), Object.keys(tarFileContent).sort());
  });
});
