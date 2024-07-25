import assert from "node:assert";
import { describe, it } from "node:test";
import { createTmpTgzFile } from "../../../test/helpers/tar-files.js";
import { getFileContentFromTar } from "./index.js";
import { modifyFilesInTar } from "./modify-files.js";

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
      "package/tar_in_deep_modify/package.json": otherPackageJson,
    };
    const tmpTarFile = await createTmpTgzFile({
      ...packageJsonLists,
      "package/index.js": 'console.log("Hello World")',
      "package/LICENSE": "MIT",
      "package/README.md": "# Test package\n\nThis is a test package\n",
    });

    const expectedUpdatedFilesContent = `${topPackageJson}\n"hello": "world"`;

    await modifyFilesInTar(tmpTarFile, {
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

  it("write file in tar with custom function", async () => {
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
      "package/tar_in_deep/package.json": otherPackageJson,
    };
    const tmpTarFile = await createTmpTgzFile({
      ...packageJsonLists,
      "package/index.js": 'console.log("Hello World")',
      "package/LICENSE": "MIT",
      "package/README.md": "# Test package\n\nThis is a test package\n",
    });

    const expectedUpdatedFilesContent = `${topPackageJson}\n"hello": "world"`;
    let gotPackageJson = "";

    await modifyFilesInTar(tmpTarFile, {
      "package/package.json": (content) => {
        gotPackageJson = content;
        return expectedUpdatedFilesContent;
      },
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
    assert.strictEqual(
      gotPackageJson,
      topPackageJson,
      "Should get the file content in the function parameter",
    );
  });
});
