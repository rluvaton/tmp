import assert from "node:assert";
import { describe, it } from "node:test";
import { createTmpTgzFile } from "../../../test/helpers/tar-files.js";
import { getFileContentFromTar } from "./index.js";
import { writeFileInTar } from "./modify-files.js";

describe("Tar", () => {
  it("write file in tar", async () => {
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

    const expectedUpdatedFilesContent = `${topPackageJson}\n"hello": "world"`;

    await writeFileInTar(tmpTarFile, {
      "package/package.json": expectedUpdatedFilesContent,
    });

    const matchedContentAfterUpdate = await getFileContentFromTar(
      tmpTarFile,
      "package/package.json",
    );

    const actualUpdatedFileContent = Object.values(
      matchedContentAfterUpdate,
    )[0].toString();

    assert.strictEqual(
      actualUpdatedFileContent,
      expectedUpdatedFilesContent,
      "The file content should be updated",
    );
  });
});
