import assert from "node:assert";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  createTmpPackage,
  getNpmOptions,
  publishTmpPackage,
} from "../../../test/helpers/npm-registry.js";
import {
  isPackagePublished,
  isPublishedPackageLatest,
  markPublishedPackageAsLatest,
  publishPackage,
} from "./registry.js";

describe("NPM registry", () => {
  describe("isPackagePublished", () => {
    describe("Specific package version not published", () => {
      it("should return false when package is published but does not have the provided version when no registry provided", async () => {
        const isPublished = await isPackagePublished({
          // The package is published but that specific version is not
          packageName: "fastify",
          version: "0.1.9999",
        });

        assert.strictEqual(isPublished, false);
      });

      it("should return false when package is published but does not have the provided version when registry provided", async () => {
        // Publishing package that we know won't exists in the regular npm registry,
        const { name } = await publishTmpPackage({
          version: "0.1.2",
        });

        const isPublished = await isPackagePublished({
          // The package is published but that specific version is not
          packageName: name,
          version: "3.4.5",
          options: getNpmOptions(),
        });

        assert.strictEqual(isPublished, false);
      });
    });

    describe("Package is missing", () => {
      it("should return false when package is not published when no registry provided", async () => {
        const randomPackageName = crypto.randomUUID();

        const isPublished = await isPackagePublished({
          packageName: randomPackageName,
          version: "0.1.9999",
        });

        assert.strictEqual(isPublished, false);
      });

      it("should return false when package is not published when registry provided", async () => {
        const randomPackageName = crypto.randomUUID();

        const isPublished = await isPackagePublished({
          packageName: randomPackageName,
          version: "0.1.9999",
          options: getNpmOptions(),
        });

        assert.strictEqual(isPublished, false);
      });
    });

    describe("The passed package version published", () => {
      it("should return true when package is published when no registry provided", async () => {
        const isPublished = await isPackagePublished({
          packageName: "fastify",
          version: "1.0.0",
        });

        assert.strictEqual(isPublished, true);
      });

      it("should return true when package is published when registry provided", async () => {
        // Publishing package that we know won't exist in the regular npm registry,
        const { name, version } = await publishTmpPackage();

        const isPublished = await isPackagePublished({
          // The package is published but that specific version is not
          packageName: name,
          version,
          options: getNpmOptions(),
        });

        assert.strictEqual(isPublished, true);
      });
    });
  });

  describe("isPublishedPackageLatest", () => {
    it("should return false when package is not latest when no registry provided", async () => {
      const isLatest = await isPublishedPackageLatest({
        packageName: "fastify",
        version: "0.43.0",
      });

      assert.strictEqual(isLatest, false);
    });

    it("should return false when package is not latest when registry provided", async () => {
      // Publishing package that we know won't exist in the regular npm registry,
      const { name } = await publishTmpPackage({
        version: "1.2.3",
        distTag: null,
      });

      await publishTmpPackage({
        packageName: name,
        version: "4.5.6",
        distTag: "latest",
      });

      const isLatest = await isPublishedPackageLatest({
        packageName: name,
        version: "1.2.3",
        options: getNpmOptions(),
      });

      assert.strictEqual(isLatest, false);
    });

    it("should return false when package is not latest but the version that is latest include in its string the latest version when registry provided", async () => {
      const { name } = await publishTmpPackage({
        version: "2.1.0",
        distTag: null,
      });

      await publishTmpPackage({
        packageName: name,
        version: "2.1.0-something",
        distTag: "latest",
      });

      const isLatest = await isPublishedPackageLatest({
        packageName: name,

        // The latest version include this version
        version: "2.1.0",
        options: getNpmOptions(),
      });

      assert.strictEqual(isLatest, false);
    });

    it("should return true when package is latest when no registry provided", async () => {
      const isLatest = await isPublishedPackageLatest({
        // This package is deprecated for 10 years, so it's safe to assume it won't get updated and break this test
        // https://www.npmjs.com/package/wifi-cc3000?activeTab=versions
        packageName: "wifi-cc3000",
        version: "0.0.1",
      });

      assert.strictEqual(isLatest, true);
    });

    it("should return true when package is latest when registry provided", async () => {
      const { name, version } = await publishTmpPackage({
        distTag: "latest",
      });

      const isLatest = await isPublishedPackageLatest({
        packageName: name,
        version,
        options: getNpmOptions(),
      });

      assert.strictEqual(isLatest, true);
    });
  });

  describe("markPublishedPackageAsLatest", () => {
    it("should mark package as latest when no registry provided", async () => {
      // TODO - should implement with env var without modifying other tests
    });

    it("should mark package as latest when registry provided", async () => {
      // Publishing package that we know won't exist in the regular npm registry,
      const { name } = await publishTmpPackage({
        version: "1.2.3",
        distTag: null,
      });

      await publishTmpPackage({
        packageName: name,
        version: "4.5.6",
        distTag: "latest",
      });

      await markPublishedPackageAsLatest({
        packageName: name,
        version: "1.2.3",
        options: getNpmOptions(),
      });

      const isLatest = await isPublishedPackageLatest({
        packageName: name,
        version: "1.2.3",
        options: getNpmOptions(),
      });

      assert.strictEqual(isLatest, true);
    });
  });

  describe("publishPackage", () => {
    it("should publish package and dont set it to latest when setLatest is false when no registry provided", async () => {
      // TODO
    });

    it("should publish package and dont set it to latest when setLatest is false when registry provided", async () => {
      const { name } = await publishTmpPackage({
        version: "4.5.6",
        distTag: "latest",
      });

      const { tarFilePath } = await createTmpPackage({
        packageName: name,
        version: "1.2.3",
      });

      await publishPackage({
        packageName: name,
        version: "1.2.3",
        tarFilePath,
        setLatest: false,
        options: getNpmOptions(),
      });

      const isLatest = await isPublishedPackageLatest({
        packageName: name,
        version: "1.2.3",
        options: getNpmOptions(),
      });

      assert.strictEqual(isLatest, false);
    });

    it("should publish package and set it to latest when setLatest is true when no registry provided", async () => {
      // TODO -
    });

    it("should publish package and set it to latest when setLatest is true when registry provided", async () => {
      const { name } = await publishTmpPackage({
        version: "4.5.6",
        distTag: "latest",
      });

      const { tarFilePath } = await createTmpPackage({
        packageName: name,
        version: "1.2.3",
      });

      await publishPackage({
        packageName: name,
        version: "1.2.3",
        tarFilePath,
        setLatest: true,
        options: getNpmOptions(),
      });

      const isLatest = await isPublishedPackageLatest({
        packageName: name,
        version: "1.2.3",
        options: getNpmOptions(),
      });

      assert.strictEqual(isLatest, true);
    });
  });
});
