import assert from "node:assert";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { doesPackageExist } from "./fetcher.js";

describe("Fetcher", () => {
  describe("doesPackageExist", () => {
    it("should return true package exists", async () => {
      const isPublished = await doesPackageExist("fastify");

      assert.strictEqual(isPublished, true);
    });

    it("should return false when package is missing", async () => {
      const missingPackageName = crypto.randomUUID();

      const isPublished = await doesPackageExist(missingPackageName);

      assert.strictEqual(isPublished, false);
    });
  });
});
